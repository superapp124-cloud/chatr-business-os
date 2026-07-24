/**
 * useSocketPresence.tsx — Additive Socket.IO Presence Hook
 *
 * Augments the existing usePresenceTracking (Supabase Presence) with
 * presence_update events from the Socket.IO server.
 *
 * Key properties:
 * ✅ Falls back gracefully to Supabase-only when socket is off
 * ✅ Merges both presence sources into a unified online users Set
 * ✅ Does NOT replace usePresenceTracking — augments it
 * ✅ Handles multi-device (user stays online until ALL sockets disconnect)
 *
 * Usage:
 * const { isUserOnline } = useSocketPresence(userId);
 * // Returns combined presence from Supabase + Socket.IO
 */

import { useState, useEffect, useCallback } from 'react';
import { usePresenceTracking } from '@/hooks/usePresenceTracking';
import { useSocketIO } from '@/hooks/useSocketIO';
import { type PresenceUpdate } from '@/services/socketService';

interface UseSocketPresenceReturn {
 /** Merged set of online user IDs (Supabase + Socket.IO) */
 onlineUsers: Set<string>;
 /** Check if a specific user is online */
 isUserOnline: (userId: string) => boolean;
 /** Whether socket is providing augmented presence data */
 isSocketPresenceActive: boolean;
}

export function useSocketPresence(currentUserId: string | undefined): UseSocketPresenceReturn {
 // ── Supabase Presence (existing, unchanged) ────────────────────────────
 const { onlineUsers: supabaseOnlineUsers, isUserOnline: supabaseIsUserOnline } =
 usePresenceTracking(currentUserId);

 // ── Socket.IO presence augmentation ───────────────────────────────────
 const { isConnected, isEnabled, on } = useSocketIO();
 const [socketOnlineUsers, setSocketOnlineUsers] = useState<Set<string>>(new Set());

 // Load initial online users when socket connects
 useEffect(() => {
 if (!isEnabled || !isConnected) return;

 const unsubOnlineUsers = on('online_users', ({ userIds }) => {
 setSocketOnlineUsers(new Set(userIds));
 });

 return () => {
 unsubOnlineUsers();
 };
 }, [isEnabled, isConnected, on]);

 // Listen for presence updates
 useEffect(() => {
 if (!isEnabled) return;

 const unsubPresence = on('presence_update', (update: PresenceUpdate) => {
 setSocketOnlineUsers(prev => {
 const next = new Set(prev);
 if (update.isOnline) {
 next.add(update.userId);
 } else {
 next.delete(update.userId);
 }
 return next;
 });
 });

 return () => {
 unsubPresence();
 };
 }, [isEnabled, on]);

 // Clear socket presence when disconnected
 useEffect(() => {
 if (!isConnected) {
 setSocketOnlineUsers(new Set());
 }
 }, [isConnected]);

 // ── Merge: a user is online if EITHER source shows them as online ──────
 const mergedOnlineUsers = (() => {
 if (!isEnabled || !isConnected) return supabaseOnlineUsers;
 if (socketOnlineUsers.size === 0) return supabaseOnlineUsers;

 const merged = new Set([...supabaseOnlineUsers, ...socketOnlineUsers]);
 return merged;
 })();

 const isUserOnline = useCallback(
 (userId: string) => mergedOnlineUsers.has(userId),
 [mergedOnlineUsers]
 );

 return {
 onlineUsers: mergedOnlineUsers,
 isUserOnline,
 isSocketPresenceActive: isEnabled && isConnected && socketOnlineUsers.size > 0,
 };
}
