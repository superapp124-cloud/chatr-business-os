import { supabase } from '@/integrations/supabase/client';

export interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  callId: string;
  data: any;
  to: string;
}

let cachedIceServers: any[] | null = null;
let prefetchPromise: Promise<any[]> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 300000; // 5 minutes

const BLACKLISTED_ICE_HOSTS = [
  // Known problematic or slow public STUN servers
  'stun.mozilla.org',
  'stun.services.mozilla.com',
  // Metered.ca endpoints have been unstable and causing ICE failures
  'relay.metered.ca',
  'a.relay.metered.ca',
  // Xirsys STUN
  'fr-turn1.xirsys.com',
  'xirsys.com',
  // Dead TURN server causing DNS -105 resolution delays
  'turn.chatr.chat'
];

const CLOUDFLARE_TURN_SERVER = {
  urls: [
    'stun:stun.cloudflare.com:3478',
    'turn:turn.cloudflare.com:3478?transport=udp',
    'turn:turn.cloudflare.com:3478?transport=tcp',
    'turns:turn.cloudflare.com:5349?transport=tcp'
  ],
  username: 'g0c53265fd3d77b1917f9d26a934e34f4cc2e358d65733e4285a7be2e4344489',
  credential: '5969d5f8b822bcd5a43c3c5257fd9cbca7a787db37e20aa1602746f6b77a393a'
};

const FALLBACK_STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  CLOUDFLARE_TURN_SERVER,
];

function normalizeIceServers(input: any): any[] {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.iceServers)) return input.iceServers;
  if (input?.iceServers?.urls) return [input.iceServers];
  if (input?.urls) return [input];
  return [];
}

function sanitizeIceServers(servers: any[] | { iceServers?: any[] | any } | null | undefined): any[] {
  const dropped: string[] = [];
  const normalizedServers = normalizeIceServers(servers);
  const cleaned = normalizedServers.map(server => {
    if (!server?.urls) return null;

    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    const filteredUrls = urls.filter((url: string) => {
      const lower = String(url).toLowerCase();
      const blocked = BLACKLISTED_ICE_HOSTS.some(host => lower.includes(host));
      if (blocked) dropped.push(url);
      return !blocked;
    });

    if (filteredUrls.length === 0) return null;
    return {
      ...server,
      urls: filteredUrls.length === 1 ? filteredUrls[0] : filteredUrls,
    };
  }).filter(Boolean);

  if (dropped.length > 0) {
    console.warn('[WebRTC] Removed stale ICE servers:', dropped);
  }

  if (cleaned.length === 0) {
    return FALLBACK_STUN_SERVERS;
  }

  const hasStun = cleaned.some(server => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((url: string) => String(url).startsWith('stun:'));
  });

  return hasStun ? cleaned : [...FALLBACK_STUN_SERVERS, ...cleaned];
}

// Pre-fetch STUN/TURN credentials in the background to prevent blocking call setup
export const prefetchTurnConfig = (timeoutMs = 3000): Promise<any[]> => {
  const isCacheValid = cachedIceServers && (Date.now() - cacheTimestamp < CACHE_TTL_MS);

  if (isCacheValid) {
    return Promise.resolve(cachedIceServers!);
  }

  // If cache is expired, clear it to force a fresh fetch
  if (cachedIceServers && !isCacheValid) {
    console.log('[WebRTC] ICE cache expired, forcing a fresh pre-fetch...');
    cachedIceServers = null;
    prefetchPromise = null;
  }

  if (prefetchPromise) {
    return prefetchPromise;
  }

  console.log('[WebRTC] Pre-fetching TURN configurations in the background...');
  prefetchPromise = (async () => {
    try {
      const response = await Promise.race([
        supabase.functions.invoke('get-turn-credentials'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Edge Timeout')), timeoutMs))
      ]) as any;

      const { data, error } = response;

      if (!error && data?.iceServers) {
        console.log('[WebRTC] Background pre-fetch successful: Using edge function ICE servers');
        cachedIceServers = sanitizeIceServers(data.iceServers);
        cacheTimestamp = Date.now();
        return cachedIceServers!;
      }
    } catch (error) {
      console.log('[WebRTC] Background pre-fetch failed:', error);
    }
    
    // Clear in-flight promise on failure so we can retry later
    prefetchPromise = null;
    return FALLBACK_STUN_SERVERS;
  })();

  return prefetchPromise;
};

// Direct getter that resolves immediately from cache if pre-fetched
export const getTurnConfig = async () => {
  const isCacheValid = cachedIceServers && (Date.now() - cacheTimestamp < CACHE_TTL_MS);

  if (isCacheValid) {
    console.log('[WebRTC] Using cached ICE servers');
    return cachedIceServers;
  }
  if (prefetchPromise && !cachedIceServers) {
    console.log('[WebRTC] Waiting on in-flight background ICE pre-fetch');
    return prefetchPromise;
  }
  // During active call setup, allow up to 2000ms if no pre-fetch exists
  return prefetchTurnConfig(2000);
};

// Direct signaling through Supabase Realtime (no edge function)
export const sendSignalDirect = async (signalData: SignalData) => {
  const user = await supabase.auth.getUser();
  const { error } = await supabase
    .from('webrtc_signals')
    .insert([{
      call_id: signalData.callId,
      from_user: user.data.user?.id || '',
      to_user: signalData.to,
      signal_type: signalData.type,
      signal_data: signalData.data as any
    }]);

  if (error) throw error;
};

export const sendSignal = sendSignalDirect;

// Fetch ALL existing signals for a call (crucial for late joiners)
export const getSignals = async (callId: string, toUserId: string) => {
  console.log('Fetching past signals:', {
    callId,
    toUserId,
    timestamp: new Date().toISOString()
  });

  const { data, error } = await supabase
    .from('webrtc_signals')
    .select('*')
    .eq('call_id', callId)
    .eq('to_user', toUserId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[getSignals] Error fetching signals:', {
      error,
      callId,
      toUserId
    });
    throw error;
  }

  console.log(`[getSignals] Found ${data?.length || 0} past signals:`,
    data?.map(s => ({
      type: s.signal_type,
      from: s.from_user,
      to: s.to_user,
      created: s.created_at
    }))
  );

  return data || [];
};

// Delete processed signals to keep table clean
export const deleteProcessedSignals = async (callId: string, toUserId: string) => {
  await supabase
    .from('webrtc_signals')
    .delete()
    .eq('call_id', callId)
    .eq('to_user', toUserId);
};

export const subscribeToCallSignals = async (
  callId: string,
  currentUserId: string,
  onSignal: (signal: any) => void
) => {
  console.log('Subscribing to signals for call:', callId, 'user:', currentUserId);

  const channel = supabase
    .channel(`call-${callId}-${currentUserId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'webrtc_signals',
        filter: `call_id=eq.${callId}`
      },
      (payload) => {
        if (payload.new.to_user !== currentUserId) {
          console.log('Ignoring signal not meant for this user:', {
            type: payload.new.signal_type,
            from: payload.new.from_user,
            to: payload.new.to_user,
            currentUser: currentUserId
          });
          return;
        }

        console.log('Realtime signal received:', {
          type: payload.new.signal_type,
          from: payload.new.from_user,
          to: payload.new.to_user
        });
        onSignal(payload.new);
      }
    )
    .subscribe((status) => {
      console.log('Subscription status:', status);
    });

  return () => {
    console.log('Unsubscribing from call signals');
    supabase.removeChannel(channel);
  };
};
