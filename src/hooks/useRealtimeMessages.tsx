/**
 * useRealtimeMessages.tsx — Additive Dual-Path Message Hook
 *
 * Wraps the existing useMessageSync (Supabase Realtime) and additionally
 * listens for Socket.IO events to get sub-100ms message delivery.
 *
 * Key properties:
 * ✅ BACKWARD COMPATIBLE — useMessageSync is called unchanged inside
 * ✅ DEDUPLICATION — messages are deduplicated by UUID
 * ✅ FALLBACK — if socket is off/disconnected, only Supabase CDC is used
 * ✅ NON-BREAKING — components can swap useMessageSync → useRealtimeMessages
 * and get the same return shape + faster delivery
 *
 * How deduplication works:
 * Both Supabase CDC and Socket.IO emit the same message.
 * We track message IDs in a Set. The first one to arrive wins.
 * The second path (usually CDC, ~200ms later) is silently discarded.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMessageSync } from '@/hooks/useMessageSync';
import { useSocketIO } from '@/hooks/useSocketIO';
import { type SocketMessage, type MessageBatch } from '@/services/socketService';

interface RealtimeMessage {
 id: string;
 content: string;
 sender_id: string;
 conversation_id: string;
 created_at: string;
 read_at: string | null;
 status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
 message_type?: string;
 media_url?: string;
 reply_to_id?: string;
}

type UseRealtimeMessagesReturn = ReturnType<typeof useMessageSync> & {
 /** Whether socket is providing the fast path */
 isSocketActive: boolean;
 /** Source of last received message */
 lastMessageSource: 'socket' | 'supabase' | null;
};

/**
 * Convert a SocketMessage (camelCase from server) to the app's snake_case format.
 */
function toRealtimeMessage(msg: SocketMessage, userId: string): RealtimeMessage {
 return {
 id: msg.id,
 content: msg.content,
 sender_id: msg.senderId,
 conversation_id: msg.conversationId,
 created_at: new Date(msg.timestamp).toISOString(),
 read_at: null,
 status: msg.senderId === userId ? 'sent' : 'delivered',
 message_type: msg.messageType || 'text',
 media_url: msg.mediaUrl ?? undefined,
 reply_to_id: msg.replyToId ?? undefined,
 };
}

export function useRealtimeMessages(
 conversationId: string | null,
 userId: string | null
): UseRealtimeMessagesReturn {
 // ── Supabase Realtime (existing, unchanged) ────────────────────────────
 const supabaseSync = useMessageSync(conversationId, userId);

 // ── Socket.IO (additive layer) ─────────────────────────────────────────
 const { isConnected, isEnabled, on } = useSocketIO({ conversationId });
 const [lastMessageSource, setLastMessageSource] = useState<'socket' | 'supabase' | null>(null);

 // Track seen message IDs for deduplication
 const seenIds = useRef<Set<string>>(new Set());

 // Sync seenIds when Supabase messages load (so socket dupes are dropped)
 useEffect(() => {
 supabaseSync.messages.forEach(msg => {
 seenIds.current.add(msg.id);
 });
 }, [supabaseSync.messages]);

 // ── Inject a socket message into the Supabase sync state ──────────────
 // We reach into the messages array from useMessageSync via the setter
 // pattern. Since useMessageSync exposes `messages` but not `setMessages`,
 // we keep a local "socket-injected" messages state and merge at render.
 const [socketMessages, setSocketMessages] = useState<RealtimeMessage[]>([]);

 const injectSocketMessage = useCallback(
 (msg: SocketMessage) => {
 if (!userId) return;
 // Deduplication check
 if (seenIds.current.has(msg.id)) return;
 seenIds.current.add(msg.id);

 const converted = toRealtimeMessage(msg, userId);
 setSocketMessages(prev => {
 // Guard against late duplicates
 if (prev.some(m => m.id === converted.id)) return prev;
 return [...prev, converted];
 });
 setLastMessageSource('socket');
 },
 [userId]
 );

 // ── Socket event listeners ────────────────────────────────────────────
 useEffect(() => {
 if (!isEnabled || !conversationId) return;

 // Fast path: individual new_message
 const unsubNewMsg = on('new_message', (msg: SocketMessage) => {
 if (msg.conversationId === conversationId) {
 injectSocketMessage(msg);
 }
 });

 // Fast path: batched messages
 const unsubBatch = on('message_batch', (batch: MessageBatch) => {
 if (batch.conversationId === conversationId) {
 batch.messages.forEach(msg => injectSocketMessage(msg));
 }
 });

 // Legacy 'message' event (existing server-enhanced.js event name)
 const unsubLegacy = on('message' as any, (msg: SocketMessage) => {
 if (msg.conversationId === conversationId) {
 injectSocketMessage(msg);
 }
 });

 return () => {
 unsubNewMsg();
 unsubBatch();
 unsubLegacy();
 };
 }, [isEnabled, conversationId, on, injectSocketMessage]);

 // Reset socket messages when conversation changes
 useEffect(() => {
 setSocketMessages([]);
 seenIds.current.clear();
 }, [conversationId]);

 // Track when Supabase messages arrive (mark source for metrics)
 const prevMessageCountRef = useRef(0);
 useEffect(() => {
 if (supabaseSync.messages.length > prevMessageCountRef.current) {
 setLastMessageSource('supabase');
 // Register all new IDs from Supabase in seenIds
 supabaseSync.messages
 .slice(prevMessageCountRef.current)
 .forEach(msg => seenIds.current.add(msg.id));
 }
 prevMessageCountRef.current = supabaseSync.messages.length;
 }, [supabaseSync.messages]);

 // ── Merge messages: Supabase base + socket-injected additions ──────────
 const mergedMessages = (() => {
 if (socketMessages.length === 0) return supabaseSync.messages;

 const base = [...supabaseSync.messages];
 const baseIds = new Set(base.map(m => m.id));

 // Add socket messages that haven't arrived via Supabase yet
 const additions = socketMessages.filter(m => !baseIds.has(m.id));

 if (additions.length === 0) return base;

 // Merge and sort by created_at
 return [...base, ...additions].sort(
 (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
 );
 })();

 return {
 ...supabaseSync,
 messages: mergedMessages as any,
 isSocketActive: isEnabled && isConnected,
 lastMessageSource,
 };
}
