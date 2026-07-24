/**
 * useSocketTyping.tsx — Real-time typing indicator over Socket.IO
 *
 * Wraps socketMessagingBridge typing methods with:
 * - Automatic stop-typing after 3s of inactivity (debounced)
 * - Remote user typing state subscription
 * - Cleanup on unmount / conversation change
 *
 * Works independently of Supabase — no changes to useTypingIndicator required.
 *
 * Usage:
 * const { onTypingInput, remoteTypingUsers } = useSocketTyping(conversationId);
 * // Call onTypingInput() on every keypress in the message input
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { socketMessagingBridge } from '@/services/messaging/socketMessagingBridge';
import { useSocketIO } from '@/hooks/useSocketIO';

const TYPING_STOP_DELAY_MS = 3000;

interface TypingUser {
 userId: string;
 conversationId: string;
}

interface UseSocketTypingReturn {
 /** Call on every keypress in the message input */
 onTypingInput: () => void;
 /** Set of user IDs currently typing in this conversation */
 remoteTypingUsers: Set<string>;
 /** Whether anyone (other than self) is currently typing */
 isSomeoneTyping: boolean;
}

export function useSocketTyping(
 conversationId: string | null,
 currentUserId?: string | null
): UseSocketTypingReturn {
 const { isEnabled, on } = useSocketIO({ conversationId });
 const [remoteTypingUsers, setRemoteTypingUsers] = useState<Set<string>>(new Set());
 const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const isTypingRef = useRef(false);

 // Send typing_start, debounce typing_stop
 const onTypingInput = useCallback(() => {
 if (!isEnabled || !conversationId) return;

 if (!isTypingRef.current) {
 isTypingRef.current = true;
 socketMessagingBridge.sendTypingStart(conversationId);
 }

 // Reset stop timer on each keystroke
 if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
 stopTimerRef.current = setTimeout(() => {
 isTypingRef.current = false;
 socketMessagingBridge.sendTypingStop(conversationId);
 }, TYPING_STOP_DELAY_MS);
 }, [isEnabled, conversationId]);

 // Listen for remote typing events
 useEffect(() => {
 if (!isEnabled || !conversationId) return;

 const unsubStart = on('typing_start' as any, (data: TypingUser) => {
 if (!data.userId || data.userId === currentUserId) return;
 if (data.conversationId !== conversationId) return;
 setRemoteTypingUsers(prev => new Set([...prev, data.userId]));
 });

 const unsubStop = on('typing_stop' as any, (data: TypingUser) => {
 if (!data.userId) return;
 if (data.conversationId !== conversationId) return;
 setRemoteTypingUsers(prev => {
 const next = new Set(prev);
 next.delete(data.userId);
 return next;
 });
 });

 return () => {
 unsubStart();
 unsubStop();
 };
 }, [isEnabled, conversationId, currentUserId, on]);

 // Cleanup: send stop-typing and clear local state on unmount / conv change
 useEffect(() => {
 return () => {
 if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
 if (isTypingRef.current && conversationId) {
 isTypingRef.current = false;
 socketMessagingBridge.sendTypingStop(conversationId);
 }
 setRemoteTypingUsers(new Set());
 };
 }, [conversationId]);

 return {
 onTypingInput,
 remoteTypingUsers,
 isSomeoneTyping: remoteTypingUsers.size > 0,
 };
}
