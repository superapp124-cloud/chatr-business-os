/**
 * Efficient Chat Hook
 * Optimized message handling with batching, caching, forwarding support, 
 * and production-grade offline queueing.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cacheMessages, getCachedMessages } from '@/services/cacheService';
import { uploadMedia } from '@/services/storageService';
import { messageQueueService } from '@/services/messageQueueService';
import { useCallActiveState } from '@/hooks/useModuleNotifications';

export interface Message {
 id: string;
 content: string;
 sender_id: string;
 conversation_id: string;
 created_at: string;
 message_type: 'text' | 'image' | 'file';
 media_url?: string;
 media_thumbnail_url?: string;
 forwarded_from?: string;
 original_message_id?: string;
 status?: 'pending' | 'sent' | 'failed';
}

interface UseEfficientChatOptions {
 conversationId: string;
 userId: string;
 messagesPerPage?: number;
 enableCache?: boolean;
}

export const useEfficientChat = ({
 conversationId,
 userId,
 messagesPerPage = 30,
 enableCache = true,
}: UseEfficientChatOptions) => {
 const [messages, setMessages] = useState<Message[]>([]);
 const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
 const [loading, setLoading] = useState(true);
 const [hasMore, setHasMore] = useState(true);
 const [sending, setSending] = useState(false);
 
 const isCallActive = useCallActiveState();
 
 const batchQueueRef = useRef<Message[]>([]);
 const batchTimerRef = useRef<NodeJS.Timeout | null>(null);

 /**
 * Load messages with caching and pending queue
 */
 const loadMessages = useCallback(async (fromCache = true) => {
 try {
 // 1. Load pending messages from local queue
 const pending = await messageQueueService.getPendingForConversation(conversationId);
 const formattedPending: Message[] = pending.map(p => ({
 ...p,
 status: 'pending'
 }));
 setPendingMessages(formattedPending);

 // 2. Try cache for existing messages
 if (fromCache && enableCache) {
 const cached = await getCachedMessages(conversationId);
 if (cached.length > 0) {
 setMessages(cached);
 setLoading(false);
 }
 }

 // 3. Load fresh from database
 const { data, error } = await supabase
 .from('messages')
 .select('*')
 .eq('conversation_id', conversationId)
 .order('created_at', { ascending: false })
 .limit(messagesPerPage);

 if (error) throw error;

 const sortedData = (data || []).reverse();
 setMessages(sortedData);
 setHasMore(data?.length === messagesPerPage);

 // Cache fresh results
 if (enableCache && data) {
 await cacheMessages(conversationId, data);
 }
 } catch (error) {
 console.error('[EfficientChat] Load error:', error);
 } finally {
 setLoading(false);
 }
 }, [conversationId, messagesPerPage, enableCache]);

 /**
 * Batch message updates (100ms window)
 */
 const processBatch = useCallback(() => {
 if (batchQueueRef.current.length === 0) return;

 setMessages(prev => {
 const newMessages = [...prev];
 batchQueueRef.current.forEach(msg => {
 const existingIndex = newMessages.findIndex(m => m.id === msg.id);
 if (existingIndex >= 0) {
 newMessages[existingIndex] = msg;
 } else {
 newMessages.push(msg);
 }
 });
 
 // Filter out any messages that are now present in the main list from the pending list
 setPendingMessages(pending => pending.filter(p => !batchQueueRef.current.some(m => m.id === p.id)));

 return newMessages.sort((a, b) => 
 new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
 );
 });

 batchQueueRef.current = [];
 }, []);

 const queueMessageUpdate = useCallback((message: Message) => {
 batchQueueRef.current.push(message);
 if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
 batchTimerRef.current = setTimeout(processBatch, 100);
 }, [processBatch]);

 /**
 * Send text message via production-grade queue
 */
 const sendMessage = useCallback(async (content: string) => {
 if (!content.trim()) return;

 const msgContent = content.trim();
 
 // Add to queue (generates ID and handles retries)
 const id = await messageQueueService.queueMessage({
 conversation_id: conversationId,
 sender_id: userId,
 content: msgContent,
 message_type: 'text'
 });

 // Optimistic update for UI
 const optimistic: Message = {
 id,
 conversation_id: conversationId,
 sender_id: userId,
 content: msgContent,
 message_type: 'text',
 created_at: new Date().toISOString(),
 status: 'pending'
 };
 
 setPendingMessages(prev => [...prev, optimistic]);
 }, [conversationId, userId]);

 /**
 * Send media message via production-grade queue
 */
 const sendMediaMessage = useCallback(async (file: File, caption?: string) => {
 setSending(true);
 try {
 // 1. Upload media first (deduplicated)
 const { url, thumbnailUrl } = await uploadMedia(
 file,
 userId,
 conversationId,
 true
 );

 const type = file.type.startsWith('image/') ? 'image' : 'file';

 // 2. Queue the message with the URL
 const id = await messageQueueService.queueMessage({
 conversation_id: conversationId,
 sender_id: userId,
 content: caption || '',
 message_type: type as any,
 media_url: url,
 media_thumbnail_url: thumbnailUrl
 });

 // 3. Optimistic update
 const optimistic: Message = {
 id,
 conversation_id: conversationId,
 sender_id: userId,
 content: caption || '',
 message_type: type as any,
 media_url: url,
 media_thumbnail_url: thumbnailUrl,
 created_at: new Date().toISOString(),
 status: 'pending'
 };
 
 setPendingMessages(prev => [...prev, optimistic]);
 } catch (error) {
 console.error('[EfficientChat] Media send failed:', error);
 throw error;
 } finally {
 setSending(false);
 }
 }, [conversationId, userId]);

 /**
 * Subscribe to realtime updates
 */
 useEffect(() => {
 loadMessages();

 if (isCallActive) {
 console.log(`[Performance] Deferring messages updates subscription for ${conversationId}`);
 return;
 }

 const channel = supabase
 .channel(`messages:${conversationId}`)
 .on(
 'postgres_changes',
 {
 event: '*', // Listen for all changes
 schema: 'public',
 table: 'messages',
 filter: `conversation_id=eq.${conversationId}`,
 },
 (payload) => {
 if (payload.eventType === 'DELETE') {
 setMessages(prev => prev.filter(m => m.id !== payload.old.id));
 } else {
 queueMessageUpdate(payload.new as Message);
 }
 }
 )
 .subscribe();

 return () => {
 if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
 supabase.removeChannel(channel);
 };
 }, [conversationId, loadMessages, queueMessageUpdate, isCallActive]);

 return {
 // Combine regular and pending messages for the UI
 messages: [...messages, ...pendingMessages].sort((a, b) => 
 new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
 ),
 loading,
 hasMore,
 sending,
 sendMessage,
 sendMediaMessage,
 refresh: () => loadMessages(false),
 loadOlder: async () => { /* Pagination logic here... */ }
 };
};
