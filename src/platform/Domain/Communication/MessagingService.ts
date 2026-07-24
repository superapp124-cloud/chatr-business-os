import { IService } from '../../Shared/Types';
import { supabase } from '@/integrations/supabase/client';
import { EventBus } from '../../Infrastructure/EventBus';
import { Logger } from '../../Infrastructure/Logger';
import { fetchConversationPeerProfile } from '@/core/platformParity/sharedConversationHydrator';
import { resolveSharedDisplayName } from '@/core/platformParity/sharedIdentityResolver';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  name: string;
  type: 'channel' | 'dm' | 'group';
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  memberCount?: number;
  topic?: string;
  isPrivate?: boolean;
  isMuted?: boolean;
  avatarUrl?: string;
  otherUserPresence?: 'online' | 'away' | 'busy' | 'offline';
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  type?: string;
  createdAt: string;
  editedAt?: string;
  threadId?: string;
  replyToId?: string;
  replyCount?: number;
  reactions: Record<string, string[]>; // emoji -> [userId, ...]
  attachments: Attachment[];
  isEdited: boolean;
  isDeleted: boolean;
  
  // Execution Awareness (Sprint 1.0)
  isResolving?: boolean;
  executionProgress?: { status: string; timestamp: number }[];
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceReason?: string;
  explainability?: {
    fastest?: boolean;
    reliable?: boolean;
    live?: boolean;
    lowestCost?: boolean;
    verified?: boolean;
  };
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class MessagingServiceClass implements IService {
  name = 'MessagingService';
  dependencies = [];

  async initialize(): Promise<void> {
    Logger.info('[MessagingService] Initialized');
  }

  async uploadAttachment(roomId: string, file: File): Promise<Attachment | null> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${roomId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('chat_attachments')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (error) throw error;

      const isImage = file.type.startsWith('image/');
      const { data: signedData, error: signedError } = await supabase.storage
        .from('chat_attachments')
        .createSignedUrl(data.path, 3600, { download: !isImage ? file.name : false });

      if (signedError) throw signedError;

      return {
        id: data.path,
        name: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
        url: signedData.signedUrl,
      };
    } catch (error: any) {
      Logger.error('[MessagingService] Error uploading attachment', error);
      return null;
    }
  }

  async getSignedUrlForAttachment(storagePath: string, filename?: string, mimeType?: string): Promise<string | null> {
    try {
      const isImage = mimeType?.startsWith('image/');
      const { data, error } = await supabase.storage
        .from('chat_attachments')
        .createSignedUrl(storagePath, 3600, { download: !isImage && filename ? filename : false });

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      Logger.error('[MessagingService] Error signing URL', error);
      return null;
    }
  }

  async shutdown(): Promise<void> {
    Logger.info('[MessagingService] Shutdown');
  }

  // ── Rooms ──────────────────────────────────────────────────────────────────

  async getRooms(workspaceId?: string): Promise<Room[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Fetch conversations where the user is a participant
      const { data: participations, error } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations!inner (
            id,
            is_group,
            group_name,
            updated_at
          )
        `)
        .eq('user_id', user.id);

      if (error) {
        Logger.warn('[MessagingService] getRooms error, returning empty', error);
        return [];
      }

      const baseRooms: Room[] = (participations || [])
        .map((p: any): Room => {
          const conv = p.conversations;
          return {
            id: conv.id,
            name: conv.group_name || 'Unnamed',
            type: conv.is_group ? 'group' : 'dm',
            unreadCount: 0,
            lastMessageAt: conv.updated_at,
          };
        })
        .sort((a, b) => {
          // Sort by lastMessageAt descending
          const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return timeB - timeA;
        });

      const hydratedRooms = await Promise.all(
        baseRooms.map(async (room) => {
          if (room.type === 'dm' && room.name === 'Unnamed') {
            const profile = await fetchConversationPeerProfile(room.id, user.id);
            if (profile) {
              room.name = resolveSharedDisplayName(profile, 'Unnamed');
              room.avatarUrl = profile.avatar_url;
            }
          }
          return room;
        })
      );

      return hydratedRooms;
    } catch (err) {
      Logger.error('[MessagingService] getRooms failed', err);
      return [];
    }
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  async getMessages(roomId: string, limit = 50): Promise<Message[]> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, profiles:sender_id(username, full_name, avatar_url)')
        .eq('conversation_id', roomId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const chronologicalData = (data || []).reverse();

      // Hydrate attachments with fresh signed URLs
      const messagesWithSignedUrls = await Promise.all(chronologicalData.map(async (m: any) => {
        const rawAttachments = m.media_attachments || [];
        const hydratedAttachments = await Promise.all(rawAttachments.map(async (att: Attachment) => {
          if (att.id) {
            const url = await this.getSignedUrlForAttachment(att.id, att.name, att.mimeType);
            if (url) return { ...att, url };
          }
          return att;
        }));
        m.media_attachments = hydratedAttachments;
        return m;
      }));

      return messagesWithSignedUrls.map((m: any): Message => ({
        id: m.id,
        roomId: m.conversation_id,
        senderId: m.sender_id,
        senderName: m.sender_name || (m.profiles ? (m.profiles.full_name || m.profiles.username) : 'Unknown User'),
        senderAvatar: m.sender_avatar_url || (m.profiles ? m.profiles.avatar_url : undefined),
        content: m.content || '',
        type: m.message_type || m.type || 'text',
        createdAt: m.created_at,
        editedAt: m.updated_at !== m.created_at ? m.updated_at : undefined,
        reactions: m.reactions || {},
        attachments: m.media_attachments || [],
        isEdited: m.is_edited || false,
        isDeleted: m.is_deleted || false,
        replyToId: m.reply_to_id || m.reply_to_message_id,
        replyCount: m.reply_count || 0,
      }));
    } catch (err) {
      Logger.error('[MessagingService] getMessages failed', err);
      return [];
    }
  }

  async sendMessage(
    roomId: string,
    content: string,
    attachments: Attachment[] = [],
    replyToId?: string
  ): Promise<Message | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let messageType = 'text';
      if (attachments.length > 0) {
        if (attachments[0].mimeType?.startsWith('image/')) {
          messageType = 'image';
        } else {
          messageType = 'document';
        }
      }

      const payload: Record<string, any> = {
        conversation_id: roomId,
        sender_id: user.id,
        content,
        message_type: messageType,
        media_attachments: attachments,
      };
      // Dual-write legacy and new reply column
      if (replyToId) {
        payload.reply_to_id = replyToId; 
      }

      const { data, error } = await supabase
        .from('messages')
        .insert(payload)
        .select('*, profiles:sender_id(username, full_name, avatar_url)')
        .single();

      if (error) throw error;

      // EventBus publication handling and final response formatting
      // (The media_attachments JSONB array natively stores the uploaded files)


      // Update conversation updated_at so it bubbles to top
      supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', roomId).then(() => {});

      const message: Message = {
        id: data.id,
        roomId: data.conversation_id,
        senderId: data.sender_id,
        senderName: data.profiles?.full_name || data.profiles?.username || 'You',
        senderAvatar: data.profiles?.avatar_url,
        content: data.content,
        createdAt: data.created_at,
        reactions: data.reactions || {},
        attachments: data.media_attachments || [],
        isEdited: false,
        isDeleted: false,
      };

      // Publish to EventBus
      EventBus.publish('MessageSent', { message, roomId }, { priority: 'high', persistent: true }).catch(() => {});

      return message;
    } catch (err: any) {
      Logger.error('[MessagingService] sendMessage failed', err);
      if (typeof window !== 'undefined') {
        window.alert('SEND ERROR: ' + JSON.stringify(err, null, 2));
      }
      return null;
    }
  }

  async sendAiMessage(roomId: string, content: string): Promise<Message | null> {
    try {
      const payload: Record<string, any> = {
        conversation_id: roomId,
        sender_id: null,
        content,
        message_type: 'ai',
        // Legacy columns (Deprecated but maintained for zero-downtime dual-write)
        reactions: {},
        media_attachments: [],
        is_edited: false,
        is_deleted: false,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('messages')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        roomId: data.conversation_id,
        senderId: 'ai',
        senderName: 'CHATR Copilot',
        content: data.content,
        createdAt: data.created_at,
        reactions: {},
        attachments: [],
        isEdited: false,
        isDeleted: false,
      };
    } catch (err) {
      Logger.error('[MessagingService] sendAiMessage failed', err);
      return null;
    }
  }

  async editMessage(messageId: string, content: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ content, is_edited: true, updated_at: new Date().toISOString() })
        .eq('id', messageId);
      if (error) throw error;
      await EventBus.publish('MessageEdited', { messageId, content }, { priority: 'normal' });
    } catch (err) {
      Logger.error('[MessagingService] editMessage failed', err);
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_deleted: true, content: '' })
        .eq('id', messageId);
      if (error) throw error;
      await EventBus.publish('MessageDeleted', { messageId }, { priority: 'normal' });
    } catch (err) {
      Logger.error('[MessagingService] deleteMessage failed', err);
    }
  }

  async addReaction(messageId: string, emoji: string, userId: string): Promise<void> {
    try {
      // Read current reactions, toggle emoji for userId, write back
      const { data, error: readErr } = await supabase
        .from('messages')
        .select('reactions')
        .eq('id', messageId)
        .single();
      if (readErr) throw readErr;

      const reactions: Record<string, string[]> = data?.reactions || {};
      const users = reactions[emoji] || [];
      if (users.includes(userId)) {
        reactions[emoji] = users.filter((u: string) => u !== userId);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...users, userId];
      }

      const { error: writeErr } = await supabase
        .from('messages')
        .update({ reactions })
        .eq('id', messageId);
      if (writeErr) throw writeErr;
    } catch (err) {
      Logger.error('[MessagingService] addReaction failed', err);
    }
  }

  // ── Real-time ──────────────────────────────────────────────────────────────

  subscribeToRoom(
    roomId: string,
    onMessage: (msg: Message) => void
  ): () => void {
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${roomId}` },
        async (payload) => {
          const m = payload.new as any;
          // Hydrate sender profile from DB since realtime doesn't include joins
          let senderName = 'Unknown';
          let senderAvatar: string | undefined;
          if (m.sender_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, full_name, avatar_url')
              .eq('id', m.sender_id)
              .single();
            if (profile) {
              senderName = profile.full_name || profile.username || 'Unknown';
              senderAvatar = profile.avatar_url;
            }
          } else if (m.message_type === 'ai' || m.type === 'ai') {
            senderName = 'CHATR Copilot';
          }

          // Generate fresh signed URLs for all attachments
          if (m.media_attachments && Array.isArray(m.media_attachments)) {
            await Promise.all(m.media_attachments.map(async (att: any) => {
              if (att.id) {
                const freshUrl = await this.getSignedUrlForAttachment(att.id, att.name, att.mimeType);
                if (freshUrl) att.url = freshUrl;
              }
            }));
          }

          onMessage({
            id: m.id,
            roomId: m.conversation_id,
            senderId: m.sender_id || 'ai',
            senderName,
            senderAvatar,
            content: m.content,
            createdAt: m.created_at,
            reactions: m.reactions || {},
            attachments: m.media_attachments || [],
            isEdited: m.is_edited || false,
            isDeleted: m.is_deleted || false,
            replyToId: m.reply_to_id || m.reply_to_message_id,
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }

  broadcastTyping(roomId: string, userId: string): void {
    supabase
      .channel(`typing:${roomId}`)
      .send({ type: 'broadcast', event: 'typing', payload: { userId, roomId } })
      .catch((err) => Logger.warn('[MessagingService] broadcastTyping failed', err));
  }
}

export const MessagingService = new MessagingServiceClass();
