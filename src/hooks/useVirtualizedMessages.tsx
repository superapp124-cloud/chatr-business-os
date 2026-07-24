import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { notifyConversationParticipants } from '@/utils/pushNotifications';
import { socketMessagingBridge } from '@/services/messaging/socketMessagingBridge';
import { socketService } from '@/services/socketService';
import { mergeMessagesForParity, getOldestMessageTimestamp } from '@/core/platformParity/sharedPaginationEngine';
import { mergeRealtimeMessage, updateRealtimeMessage } from '@/core/platformParity/sharedRealtimeMerge';

interface Message {
 id: string;
 conversation_id: string;
 sender_id: string;
 content: string;
 message_type?: string | null;
 media_url?: string | null;
 media_attachments?: any;
 created_at: string;
 read_at?: string | null;
 status?: string | null;
 reactions?: any;
 is_starred?: boolean;
}

const MESSAGES_PER_PAGE = 30;
const MAX_MESSAGES_IN_MEMORY = 300;

export const useVirtualizedMessages = (conversationId: string | null, userId: string) => {
 const [messages, setMessages] = useState<Message[]>([]);
 const [isLoading, setIsLoading] = useState(false);
 const [hasMore, setHasMore] = useState(true);
 const [sending, setSending] = useState(false);
 const oldestMessageTimestamp = useRef<string | null>(null);
 const loadingOlderRef = useRef(false);

 // Load initial messages (most recent 30) - optimized for speed
 const loadMessages = useCallback(async () => {
 if (!conversationId) return;
 
 setIsLoading(true);
 try {
 // Use only essential columns for faster query
 const { data, error } = await supabase
 .from('messages')
 .select('id, conversation_id, sender_id, content, type, media_attachments, created_at, reactions, reply_to_id, is_edited, is_deleted')
 .eq('conversation_id', conversationId)
 .order('created_at', { ascending: false })
 .limit(MESSAGES_PER_PAGE);

 if (error) throw error;
 
 const reversedMessages = (data || []).reverse();
 setMessages(mergeMessagesForParity([], reversedMessages, {
 direction: 'replace',
 maxMessages: MAX_MESSAGES_IN_MEMORY,
 }));
 oldestMessageTimestamp.current = getOldestMessageTimestamp(reversedMessages);
 
 setHasMore(data && data.length === MESSAGES_PER_PAGE);
 } catch (error) {
 console.error('[useVirtualizedMessages] Error loading messages:', error);
 } finally {
 setIsLoading(false);
 }
 }, [conversationId]);

 // Load older messages (pagination) - optimized
 const loadOlderMessages = useCallback(async () => {
 if (!conversationId || !oldestMessageTimestamp.current || !hasMore || loadingOlderRef.current) return;
 
 loadingOlderRef.current = true;
 setIsLoading(true);
 try {
 const cursor = oldestMessageTimestamp.current;
 const { data, error } = await supabase
 .from('messages')
 .select('id, conversation_id, sender_id, content, message_type:type, media_attachments, created_at, reactions')
 .eq('conversation_id', conversationId)
 .lt('created_at', cursor)
 .order('created_at', { ascending: false })
 .limit(MESSAGES_PER_PAGE);

 if (error) throw error;
 
 if (data && data.length > 0) {
 const reversedMessages = data.reverse();
 setMessages(prev => {
 const combined = mergeMessagesForParity(prev, reversedMessages, {
 direction: 'prepend',
 maxMessages: MAX_MESSAGES_IN_MEMORY,
 });
 oldestMessageTimestamp.current = getOldestMessageTimestamp(combined);
 return combined;
 });
 setHasMore(data.length === MESSAGES_PER_PAGE);
 } else {
 setHasMore(false);
 }
 } catch (error) {
 console.error('[useVirtualizedMessages] Error loading older messages:', error);
 } finally {
 setIsLoading(false);
 loadingOlderRef.current = false;
 }
 }, [conversationId, hasMore]);

 // Send message with optimistic UI
 const sendMessage = useCallback(async (
 content: string, 
 type: string = 'text',
 mediaAttachments?: any[]
 ) => {
 if (!conversationId || !userId || !content.trim()) return;
 
 const tempId = `temp-${Date.now()}`;
 const optimisticMessage: Message = {
 id: tempId,
 conversation_id: conversationId,
 sender_id: userId,
 content: content.trim(),
 message_type: type,
 created_at: new Date().toISOString(),
 status: 'sending',
 media_attachments: mediaAttachments || []
 };
 
 // Add optimistically (instant UI update like WhatsApp)
 setMessages(prev => mergeMessagesForParity(prev, [optimisticMessage], {
 direction: 'append',
 maxMessages: MAX_MESSAGES_IN_MEMORY,
 }));
 setSending(true);
 
 try {
 const { data, error } = await supabase
 .from('messages')
 .insert({
 conversation_id: conversationId,
 sender_id: userId,
 content: content.trim(),
 message_type: type,
 media_attachments: mediaAttachments || []
 })
 .select()
 .single();

 if (error) throw error;
 
 // Replace temp message with real one
 setMessages(prev => prev.map(msg => 
 msg.id === tempId ? data : msg
 ));

 // ⚡ SOCKET BRIDGE: fire-and-forget emit for <100ms delivery to recipient
 // Runs AFTER Supabase INSERT so the real UUID is known.
 // Recipient's socket listener deduplicates by this same ID.
 if (data?.id) {
 socketMessagingBridge.emit({
 id: data.id,
 conversationId,
 content: content.trim(),
 senderId: userId,
 messageType: type,
 timestamp: new Date(data.created_at).getTime(),
 }).catch(() => {}); // non-blocking
 }

 // 🔔 Send push notification to all other participants via FCM v1 API
 // Fire-and-forget: don't block the UI on notification delivery
 if (data?.id) {
 // Get sender profile for notification display
 const { data: senderProfile } = await supabase
 .from('profiles')
 .select('username, avatar_url')
 .eq('id', userId)
 .single();

 notifyConversationParticipants(
 conversationId,
 userId,
 senderProfile?.username || 'Someone',
 senderProfile?.avatar_url || undefined,
 data.id,
 content.trim(),
 false // isGroup - could be enhanced later
 ).catch(err => console.warn('📲 Push notification failed (non-blocking):', err));
 }
 } catch (error) {
 console.error('[useVirtualizedMessages] Error sending message:', error);
 // Mark as failed
 setMessages(prev => prev.map(msg =>
 msg.id === tempId ? { ...msg, status: 'failed' } : msg
 ));
 throw error;
 } finally {
 setSending(false);
 }
 }, [conversationId, userId]);

 // Delete message
 const deleteMessage = useCallback(async (messageId: string) => {
 try {
 const { error } = await supabase
 .from('messages')
 .delete()
 .eq('id', messageId)
 .eq('sender_id', userId);

 if (error) throw error;
 } catch (error) {
 console.error('[useVirtualizedMessages] Error deleting message:', error);
 throw error;
 }
 }, [userId]);

 // Edit message
 const editMessage = useCallback(async (messageId: string, newContent: string) => {
 try {
 const { error } = await supabase
 .from('messages')
 .update({ content: newContent, is_edited: true })
 .eq('id', messageId)
 .eq('sender_id', userId);

 if (error) throw error;
 } catch (error) {
 console.error('[useVirtualizedMessages] Error editing message:', error);
 throw error;
 }
 }, [userId]);

 // React to message
 const reactToMessage = useCallback(async (messageId: string, emoji: string) => {
 try {
 const { data: message } = await supabase
 .from('messages')
 .select('reactions')
 .eq('id', messageId)
 .single();
 
 if (!message) return;

 const reactions: Record<string, string[]> = (message.reactions as any) || {};
 const userReactions = reactions[userId] || [];
 
 const newReactions = userReactions.includes(emoji)
 ? userReactions.filter((e: string) => e !== emoji)
 : [...userReactions, emoji];

 const updatedReactions = { ...reactions, [userId]: newReactions };

 const { error } = await supabase
 .from('messages')
 .update({ reactions: updatedReactions as any })
 .eq('id', messageId);

 if (error) throw error;
 } catch (error) {
 console.error('[useVirtualizedMessages] Error reacting to message:', error);
 throw error;
 }
 }, [userId]);

 // Mark messages as read when viewing conversation
 useEffect(() => {
 if (!conversationId || !userId) return;
 
 const markMessagesRead = async () => {
 try {
 // Mark all unread messages from other users as read
 const { data, error } = await supabase
 .from('messages')
 .update({ read_at: new Date().toISOString() })
 .eq('conversation_id', conversationId)
 .neq('sender_id', userId)
 .is('read_at', null)
 .select('id');
 
 if (error) {
 console.error('[Mark Read] Error:', error);
 } else if (data && data.length > 0) {
 // ⚡ SOCKET BRIDGE: Notify peer instantly that messages were read
 const messageIds = data.map(m => m.id);
 socketMessagingBridge.markRead(conversationId, messageIds);
 }
 } catch (error) {
 console.error('[Mark Read] Failed:', error);
 }
 };
 
 // Mark as read after a short delay
 const timer = setTimeout(markMessagesRead, 500);
 return () => clearTimeout(timer);
 }, [conversationId, userId]);

 // Aggressive real-time subscriptions (instant like WhatsApp)
 useEffect(() => {
 if (!conversationId) return;

 const channel = supabase
 .channel(`messages:${conversationId}`, {
 config: {
 broadcast: { self: true },
 presence: { key: userId }
 }
 })
 .on('postgres_changes', {
 event: 'INSERT',
 schema: 'public',
 table: 'messages',
 filter: `conversation_id=eq.${conversationId}`
 }, (payload) => {
 const newMessage = payload.new as Message;
 // Instant update - no batching
 setMessages(prev => {
 // Prevent duplicates
 if (prev.some(m => m.id === newMessage.id)) return prev;
 return mergeRealtimeMessage(prev, newMessage, MAX_MESSAGES_IN_MEMORY);
 });
 })
 .on('postgres_changes', {
 event: 'UPDATE',
 schema: 'public',
 table: 'messages',
 filter: `conversation_id=eq.${conversationId}`
 }, (payload) => {
 // Instant update for read receipts and edits
 setMessages(prev => updateRealtimeMessage(prev, payload.new as Message));
 })
 .on('postgres_changes', {
 event: 'DELETE',
 schema: 'public',
 table: 'messages',
 filter: `conversation_id=eq.${conversationId}`
 }, (payload) => {
 setMessages(prev => prev.filter(m => m.id !== payload.old.id));
 })
 .subscribe((status) => {
 if (status === 'SUBSCRIBED') {
 console.log('[Real-time] ✅ Connected to message stream');
 } else if (status === 'CHANNEL_ERROR') {
 console.error('[Real-time] ❌ Channel error');
 }
 });

 // ⚡ SOCKET FAST PATH: listen for incoming messages on this conversation
 // Deduplication is handled by the guard above: `if (prev.some(m => m.id === newMessage.id))`
 let unsubSocket: (() => void) | undefined;
 if (socketService.isEnabled) {
 const handleNewMsg = (msg: any) => {
 if (msg.conversationId !== conversationId && msg.conversation_id !== conversationId) return;
 const incomingId = msg.id;
 const incoming: Message = {
 id: incomingId,
 conversation_id: msg.conversationId || msg.conversation_id,
 sender_id: msg.senderId || msg.sender_id,
 content: msg.content,
 message_type: msg.messageType || msg.message_type || 'text',
 media_url: msg.mediaUrl || msg.media_url || null,
 created_at: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
 status: msg.status || 'delivered',
 };
 setMessages(prev => {
 if (prev.some(m => m.id === incomingId)) return prev; // dedupe
 return mergeRealtimeMessage(prev, incoming, MAX_MESSAGES_IN_MEMORY);
 });
 };

 const unsub1 = socketService.on('new_message' as any, handleNewMsg);
 const unsub2 = socketService.on('message' as any, handleNewMsg);
 const unsub3 = socketService.on('message_batch' as any, (batch: any) => {
 if (batch.conversationId === conversationId) {
 batch.messages.forEach((msg: any) => handleNewMsg(msg));
 }
 });
 const unsub4 = socketService.on('message_read' as any, (data: any) => {
 setMessages(prev => prev.map(m => 
 m.id === data.messageId ? { ...m, status: 'read' as const, read_at: new Date(data.timestamp).toISOString() } : m
 ));
 });
 const unsub5 = socketService.on('message_delivered' as any, (data: any) => {
 setMessages(prev => prev.map(m => 
 m.id === data.messageId ? { ...m, status: 'delivered' as const } : m
 ));
 });
 unsubSocket = () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
 }

 return () => {
 supabase.removeChannel(channel);
 unsubSocket?.();
 };
 }, [conversationId, userId]);

 // Load messages on conversation change
 useEffect(() => {
 oldestMessageTimestamp.current = null;
 loadingOlderRef.current = false;
 setHasMore(true);
 loadMessages();
 }, [conversationId, loadMessages]);

 return {
 messages,
 isLoading,
 hasMore,
 sending,
 sendMessage,
 loadMessages,
 loadOlderMessages,
 deleteMessage,
 editMessage,
 reactToMessage
 };
};

