/**
 * useSocketIO.tsx — React hook wrapping SocketService
 *
 * Provides a component-level interface to the global socket connection.
 * Handles:
 * - Joining / leaving conversation rooms
 * - Subscribing to socket events with automatic cleanup
 * - Connection state tracking
 *
 * Returns early with no-op functions when VITE_ENABLE_SOCKET is false.
 * Components can use this alongside useMessageSync — they are independent.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useSocketContext } from '@/contexts/SocketContext';
import { socketService, type SocketEventMap } from '@/services/socketService';

interface UseSocketIOOptions {
 /** Conversation ID to join on mount, leave on unmount */
 conversationId?: string | null;
}

interface UseSocketIOReturn {
 /** Is Socket.IO currently connected? */
 isConnected: boolean;
 /** Current connection state */
 connectionState: 'connected' | 'reconnecting' | 'disconnected';
 /** Is the socket feature enabled? */
 isEnabled: boolean;
 /** Emit an event (queued if offline) */
 emit: (event: string, data: any, ack?: (response: any) => void) => void;
 /** Subscribe to a socket event — auto-cleaned up on unmount */
 on: <K extends keyof SocketEventMap>(event: K, handler: SocketEventMap[K]) => () => void;
 /** Unsubscribe from a socket event */
 off: <K extends keyof SocketEventMap>(event: K, handler?: SocketEventMap[K]) => void;
}

export function useSocketIO(options: UseSocketIOOptions = {}): UseSocketIOReturn {
 const { conversationId } = options;
 const { isConnected, connectionState, isEnabled } = useSocketContext();
 const handlerCleanupRefs = useRef<Array<() => void>>([]);

 // Join conversation room on mount, leave on unmount
 useEffect(() => {
 if (!isEnabled || !conversationId) return;

 socketService.joinConversation(conversationId);

 return () => {
 socketService.leaveConversation(conversationId);
 };
 }, [isEnabled, conversationId]);

 // Re-join after reconnect
 useEffect(() => {
 if (!isEnabled || !conversationId || !isConnected) return;
 socketService.joinConversation(conversationId);
 }, [isEnabled, conversationId, isConnected]);

 // Clean up all event listeners registered by this hook instance on unmount
 useEffect(() => {
 return () => {
 handlerCleanupRefs.current.forEach(fn => fn());
 handlerCleanupRefs.current = [];
 };
 }, []);

 const emit = useCallback(
 (event: string, data: any, ack?: (response: any) => void) => {
 socketService.emit(event, data, ack);
 },
 []
 );

 const on = useCallback(
 <K extends keyof SocketEventMap>(event: K, handler: SocketEventMap[K]) => {
 const unsubscribe = socketService.on(event, handler);
 const trackedUnsubscribe = () => {
 handlerCleanupRefs.current = handlerCleanupRefs.current.filter(fn => fn !== trackedUnsubscribe);
 unsubscribe();
 };
 handlerCleanupRefs.current.push(trackedUnsubscribe);
 return trackedUnsubscribe;
 },
 []
 );

 const off = useCallback(
 <K extends keyof SocketEventMap>(event: K, handler?: SocketEventMap[K]) => {
 socketService.off(event, handler);
 },
 []
 );

 return {
 isConnected,
 connectionState,
 isEnabled,
 emit,
 on,
 off,
 };
}
