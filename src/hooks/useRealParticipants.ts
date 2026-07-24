import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Participant } from '@/components/calling/meeting/ParticipantsPanel';

export function useRealParticipants(activeRoomId: string | null, currentUserId: string | null, currentUserName: string) {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    if (!activeRoomId) {
      setParticipants([]);
      return;
    }

    const loadParticipants = async () => {
      const { data, error } = await supabase
        .from('session_room_participants')
        .select('user_id, joined_at, profiles:user_id(id, username, full_name, avatar_url)')
        .eq('room_id', activeRoomId);

      if (error || !data) return;

      const mapped: Participant[] = data.map((p: any, i: number) => {
        const profile = p.profiles;
        const isHost = profile?.id === currentUserId;
        const displayName = profile?.full_name || profile?.username || 'Participant';
        return {
          id: profile?.id || `p-${i}`,
          name: displayName,
          role: isHost ? 'host' : 'participant',
          status: 'active',
          avatarUrl: profile?.avatar_url || undefined,
          avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
          isSpeaking: false,
        };
      });

      // Ensure current user is always first
      setParticipants(mapped.sort((a) => (a.id === currentUserId ? -1 : 1)));
    };

    loadParticipants();

    // Realtime subscription for new participants joining
    const channel = supabase
      .channel(`room-participants-${activeRoomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'session_room_participants',
        filter: `room_id=eq.${activeRoomId}`,
      }, () => {
        loadParticipants();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRoomId, currentUserId]);

  return participants;
}

const AVATAR_COLORS = [
  'linear-gradient(135deg, #7c3aed, #3b82f6)',
  'linear-gradient(135deg, #2563eb, #06b6d4)',
  'linear-gradient(135deg, #db2777, #f43f5e)',
  'linear-gradient(135deg, #d97706, #f59e0b)',
  'linear-gradient(135deg, #059669, #10b981)',
  'linear-gradient(135deg, #7c3aed, #a855f7)',
  'linear-gradient(135deg, #0891b2, #6366f1)',
];
