import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PresenceStatus = 'online' | 'away' | 'busy' | 'on_call' | 'in_meeting' | 'sharing_screen' | 'recording' | 'offline';

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastSeen: string;
  statusMessage?: string;
}

const PRESENCE_CHANNEL = 'chatr_presence';
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes before marking as 'away'

const STATUS_LABELS: Record<PresenceStatus, string> = {
  online: 'Online',
  away: 'Away',
  busy: 'Busy / DND',
  on_call: 'On Call',
  in_meeting: 'In Meeting',
  sharing_screen: 'Sharing Screen',
  recording: 'Recording',
  offline: 'Offline',
};

const STATUS_COLORS: Record<PresenceStatus, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-400',
  busy: 'bg-red-500',
  on_call: 'bg-blue-500 animate-pulse',
  in_meeting: 'bg-purple-500',
  sharing_screen: 'bg-cyan-500',
  recording: 'bg-red-600 animate-pulse',
  offline: 'bg-zinc-400',
};

export function usePresence(userId?: string | null) {
  const [myStatus, setMyStatus] = useState<PresenceStatus>('online');
  const [presenceMap, setPresenceMap] = useState<Map<string, UserPresence>>(new Map());
  const channelRef = useRef<any>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const broadcastPresence = useCallback(async (status: PresenceStatus, message?: string) => {
    if (!channelRef.current || !userId) return;
    try {
      await channelRef.current.track({
        userId,
        status,
        lastSeen: new Date().toISOString(),
        statusMessage: message,
      });
    } catch (e) {
      // Silently fail — presence is best-effort
    }
  }, [userId]);

  const setStatus = useCallback((status: PresenceStatus, message?: string) => {
    setMyStatus(status);
    broadcastPresence(status, message);
  }, [broadcastPresence]);

  // Idle detection
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (myStatus === 'away') {
      setStatus('online');
    }
    idleTimerRef.current = setTimeout(() => {
      setStatus('away');
    }, IDLE_TIMEOUT_MS);
  }, [myStatus, setStatus]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: userId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const newMap = new Map<string, UserPresence>();
        Object.entries(state).forEach(([, presences]: [string, any]) => {
          const p = presences[0];
          if (p?.userId) {
            newMap.set(p.userId, {
              userId: p.userId,
              status: p.status || 'online',
              lastSeen: p.lastSeen || new Date().toISOString(),
              statusMessage: p.statusMessage,
            });
          }
        });
        setPresenceMap(newMap);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
        const p = newPresences[0];
        if (p?.userId) {
          setPresenceMap(prev => {
            const next = new Map(prev);
            next.set(p.userId, {
              userId: p.userId,
              status: p.status || 'online',
              lastSeen: p.lastSeen || new Date().toISOString(),
              statusMessage: p.statusMessage,
            });
            return next;
          });
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }: any) => {
        const p = leftPresences[0];
        if (p?.userId) {
          setPresenceMap(prev => {
            const next = new Map(prev);
            const existing = next.get(p.userId);
            if (existing) {
              next.set(p.userId, { ...existing, status: 'offline' });
            }
            return next;
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId,
            status: 'online',
            lastSeen: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    // Idle detection listeners
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));
    resetIdleTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const getPresence = useCallback((uid: string): UserPresence => {
    return presenceMap.get(uid) || {
      userId: uid,
      status: 'offline',
      lastSeen: new Date().toISOString(),
    };
  }, [presenceMap]);

  const getStatusColor = (status: PresenceStatus) => STATUS_COLORS[status] || STATUS_COLORS.offline;
  const getStatusLabel = (status: PresenceStatus) => STATUS_LABELS[status] || 'Offline';

  return {
    myStatus,
    setStatus,
    presenceMap,
    getPresence,
    getStatusColor,
    getStatusLabel,
  };
}
