import { supabase } from '@/integrations/supabase/client';
import { platformEventBus } from '@/platform/events/PlatformEventBus';
import type {
  ConversationApi,
  ConversationUpdateEvent,
  ListConversationsRequest,
  PlatformConversationSummary,
} from './types';

interface ConversationParticipantRow {
  conversation_id: string;
  conversations: {
    id: string;
    is_group: boolean | null;
    group_name: string | null;
    group_icon_url: string | null;
    updated_at: string | null;
  };
}

interface OtherParticipantRow {
  conversation_id: string;
  user_id: string;
  profiles: {
    username: string | null;
    avatar_url: string | null;
    is_online: boolean | null;
  };
}

interface LastMessageRow {
  conversation_id: string;
  content: string | null;
  created_at: string | null;
}

export class SupabaseConversationApi implements ConversationApi {
  async listForUser({
    userId,
  }: ListConversationsRequest): Promise<PlatformConversationSummary[]> {
    if (!userId) {
      return [];
    }

    const { data: participantData, error } = await (supabase as any)
      .from('conversation_participants')
      .select(`
        conversation_id,
        conversations!inner(
          id,
          is_group,
          group_name,
          group_icon_url,
          updated_at
        )
      `)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    const participantRows = (participantData ?? []) as ConversationParticipantRow[];
    if (participantRows.length === 0) {
      return [];
    }

    const conversationIds = participantRows.map((participant) => participant.conversation_id);

    const { data: allParticipants } = await (supabase as any)
      .from('conversation_participants')
      .select(`
        conversation_id,
        user_id,
        profiles!inner(username, avatar_url, is_online)
      `)
      .in('conversation_id', conversationIds)
      .neq('user_id', userId);

    const { data: allMessages } = await (supabase as any)
      .from('messages')
      .select('conversation_id, content, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });

    const lastMessageMap = new Map<string, LastMessageRow>();
    ((allMessages ?? []) as LastMessageRow[]).forEach((message) => {
      if (!lastMessageMap.has(message.conversation_id)) {
        lastMessageMap.set(message.conversation_id, message);
      }
    });

    const participantMap = new Map<string, OtherParticipantRow['profiles']>();
    ((allParticipants ?? []) as OtherParticipantRow[]).forEach((participant) => {
      if (!participantMap.has(participant.conversation_id)) {
        participantMap.set(participant.conversation_id, participant.profiles);
      }
    });

    const conversations = participantRows.map((participant) => {
      const conversation = participant.conversations;
      const otherUser = participantMap.get(conversation.id);
      const lastMessage = lastMessageMap.get(conversation.id);
      const isGroup = Boolean(conversation.is_group);

      return {
        id: conversation.id,
        name: isGroup ? conversation.group_name || 'Group' : otherUser?.username || 'Unknown',
        avatarUrl: isGroup ? conversation.group_icon_url : otherUser?.avatar_url ?? null,
        lastMessagePreview: lastMessage?.content || 'No messages yet',
        lastMessageAt: lastMessage?.created_at ?? null,
        isOnline: otherUser?.is_online || false,
        unreadCount: 0,
        isGroup,
      };
    });

    conversations.sort((a, b) => {
      const aTime = lastMessageMap.get(a.id)?.created_at || '';
      const bTime = lastMessageMap.get(b.id)?.created_at || '';
      return bTime.localeCompare(aTime);
    });

    return conversations;
  }

  subscribeToUpdates(
    options: { userId: string },
    onUpdate: (event: ConversationUpdateEvent) => void
  ): () => void {
    const channel = supabase
      .channel(`platform-conversations:${options.userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const conversationId = (payload.new as { conversation_id?: string }).conversation_id;
          const event: ConversationUpdateEvent = {
            reason: 'message.created',
            conversationId,
            payload,
          };

          void platformEventBus.publish({
            type: 'message.received',
            source: 'edge',
            conversationId,
            payload,
          });

          onUpdate(event);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          const conversationId = (payload.new as { id?: string }).id;
          const event: ConversationUpdateEvent = {
            reason: 'conversation.changed',
            conversationId,
            payload,
          };

          void platformEventBus.publish({
            type: 'conversation.updated',
            source: 'edge',
            conversationId,
            payload,
          });

          onUpdate(event);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const conversationApi: ConversationApi = new SupabaseConversationApi();
