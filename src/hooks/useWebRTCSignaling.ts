import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SignalData {
  id: string;
  call_id: string;
  from_user_id: string;
  to_user_id: string;
  signal_type: 'offer' | 'answer' | 'ice_candidate' | 'hangup';
  signal_data: any;
  created_at: string;
}

interface UseWebRTCSignalingProps {
  callId: string;
  onOffer?: (offer: RTCSessionDescriptionInit, fromUserId: string) => void;
  onAnswer?: (answer: RTCSessionDescriptionInit) => void;
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  onHangup?: () => void;
}

export function useWebRTCSignaling({
  callId,
  onOffer,
  onAnswer,
  onIceCandidate,
  onHangup,
}: UseWebRTCSignalingProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch ICE servers
  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('webrtc-signaling', {
          body: { action: 'get_ice_servers' },
        });

        if (error) throw error;
        if (data?.iceServers) {
          setIceServers(data.iceServers);
        }
      } catch (err) {
        console.error('Error fetching ICE servers:', err);
        // Fallback to Google STUN + Cloudflare TURN
        setIceServers([
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: [
              'stun:stun.cloudflare.com:3478',
              'turn:turn.cloudflare.com:3478?transport=udp',
              'turn:turn.cloudflare.com:3478?transport=tcp',
              'turns:turn.cloudflare.com:5349?transport=tcp'
            ],
            username: 'g0c53265fd3d77b1917f9d26a934e34f4cc2e358d65733e4285a7be2e4344489',
            credential: '5969d5f8b822bcd5a43c3c5257fd9cbca7a787db37e20aa1602746f6b77a393a'
          }
        ]);
      }
    };

    fetchIceServers();
  }, []);

  // Subscribe to realtime signals
  useEffect(() => {
    const setupChannel = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channelRef.current = supabase
        .channel(`webrtc:${callId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'webrtc_signals',
            filter: `to_user_id=eq.${user.id}`,
          },
          (payload) => {
            const signal = payload.new as SignalData;
            if (signal.call_id !== callId) return;

            console.log('Received signal:', signal.signal_type);

            switch (signal.signal_type) {
              case 'offer':
                onOffer?.(signal.signal_data, signal.from_user_id);
                break;
              case 'answer':
                onAnswer?.(signal.signal_data);
                break;
              case 'ice_candidate':
                onIceCandidate?.(signal.signal_data);
                break;
              case 'hangup':
                onHangup?.();
                break;
            }
          }
        )
        .subscribe((status) => {
          setIsConnected(status === 'SUBSCRIBED');
        });
    };

    setupChannel();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [callId, onOffer, onAnswer, onIceCandidate, onHangup]);

  // Send signal
  const sendSignal = useCallback(async (
    toUserId: string,
    signalType: 'offer' | 'answer' | 'ice_candidate' | 'hangup',
    signalData: any
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('webrtc-signaling', {
        body: {
          action: 'send_signal',
          call_id: callId,
          to_user_id: toUserId,
          signal_type: signalType,
          signal_data: signalData,
        },
      });

      if (error) throw error;
      console.log('Signal sent:', signalType);
      return data;
    } catch (err) {
      console.error('Error sending signal:', err);
      throw err;
    }
  }, [callId]);

  // Send offer
  const sendOffer = useCallback((toUserId: string, offer: RTCSessionDescriptionInit) => {
    return sendSignal(toUserId, 'offer', offer);
  }, [sendSignal]);

  // Send answer
  const sendAnswer = useCallback((toUserId: string, answer: RTCSessionDescriptionInit) => {
    return sendSignal(toUserId, 'answer', answer);
  }, [sendSignal]);

  // Send ICE candidate
  const sendIceCandidate = useCallback((toUserId: string, candidate: RTCIceCandidateInit) => {
    return sendSignal(toUserId, 'ice_candidate', candidate);
  }, [sendSignal]);

  // Send hangup
  const sendHangup = useCallback((toUserId: string) => {
    return sendSignal(toUserId, 'hangup', {});
  }, [sendSignal]);

  return {
    isConnected,
    iceServers,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    sendHangup,
  };
}
