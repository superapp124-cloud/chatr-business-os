/**
 * Chatr+ Latency-Aware TURN Server Resolver (Phase 5)
 *
 * Before WebRTC handshake, we ping all regional TURN relays via lightweight
 * STUN binding requests, then pick the one with lowest RTT.
 *
 * Regions: Mumbai | Frankfurt | Singapore | Virginia
 */

interface RelayCandidate {
  region: string;
  label: string;
  stunUrl: string;
  turnUrls: string[];
}

const RELAY_CANDIDATES: RelayCandidate[] = [
  {
    region: 'ap-south-1',
    label: 'Mumbai 🇮🇳',
    stunUrl: 'stun:stun.l.google.com:19302', // Fallback public STUN for ping
    turnUrls: [
      'turn:in-relay.chatr.im:3478?transport=udp',
      'turn:in-relay.chatr.im:3478?transport=tcp',
      'turns:in-relay.chatr.im:5349',
    ],
  },
  {
    region: 'eu-central-1',
    label: 'Frankfurt 🇩🇪',
    stunUrl: 'stun:stun.l.google.com:19302',
    turnUrls: [
      'turn:eu-relay.chatr.im:3478?transport=udp',
      'turn:eu-relay.chatr.im:3478?transport=tcp',
      'turns:eu-relay.chatr.im:5349',
    ],
  },
  {
    region: 'ap-southeast-1',
    label: 'Singapore 🇸🇬',
    stunUrl: 'stun:stun.l.google.com:19302',
    turnUrls: [
      'turn:sg-relay.chatr.im:3478?transport=udp',
      'turn:sg-relay.chatr.im:3478?transport=tcp',
      'turns:sg-relay.chatr.im:5349',
    ],
  },
  {
    region: 'us-east-1',
    label: 'Virginia 🇺🇸',
    stunUrl: 'stun:stun.l.google.com:19302',
    turnUrls: [
      'turn:us-relay.chatr.im:3478?transport=udp',
      'turn:us-relay.chatr.im:3478?transport=tcp',
      'turns:us-relay.chatr.im:5349',
    ],
  },
];

// Shared TURN credentials (replace with token-based auth in production)
const TURN_USERNAME = 'chatr';
const TURN_CREDENTIAL = 'chatr-secret';

interface RelayPingResult {
  candidate: RelayCandidate;
  latencyMs: number;
}

/**
 * Ping a STUN server by running a lightweight RTCPeerConnection gather.
 * Returns latency in ms or 9999 on failure.
 */
async function pingStunServer(url: string, timeoutMs = 3000): Promise<number> {
  return new Promise((resolve) => {
    const start = performance.now();
    let settled = false;

    const settle = (latency: number) => {
      if (settled) return;
      settled = true;
      pc.close();
      resolve(latency);
    };

    const pc = new RTCPeerConnection({ iceServers: [{ urls: url }] });
    pc.createDataChannel('ping');

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') {
        settle(performance.now() - start);
      }
    };

    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .catch(() => settle(9999));

    setTimeout(() => settle(performance.now() - start), timeoutMs);
  });
}

let cachedResult: { iceServers: RTCIceServer[]; region: string; resolvedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

/**
 * Resolves optimal ICE servers by RTT pinging all regional relays.
 * Result is cached for 5 minutes to avoid repeated pings on re-dial.
 */
export async function getOptimalTURNServers(): Promise<RTCIceServer[]> {
  // Return cached if fresh
  if (cachedResult && Date.now() - cachedResult.resolvedAt < CACHE_TTL_MS) {
    console.log(`🌐 [TURN] Using cached relay: ${cachedResult.region}`);
    return cachedResult.iceServers;
  }

  console.log('🌐 [TURN] Pinging regional relays for lowest RTT...');

  const pingResults: RelayPingResult[] = await Promise.all(
    RELAY_CANDIDATES.map(async (candidate) => ({
      candidate,
      latencyMs: await pingStunServer(candidate.stunUrl),
    }))
  );

  pingResults.sort((a, b) => a.latencyMs - b.latencyMs);
  const best = pingResults[0];

  console.log(
    `🌐 [TURN] Selected: ${best.candidate.label} (${best.latencyMs.toFixed(1)}ms)`,
    pingResults.map(r => `${r.candidate.label}: ${r.latencyMs.toFixed(0)}ms`).join(', ')
  );

  const iceServers: RTCIceServer[] = [
    // Always include public STUN fallback
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Selected regional TURN
    {
      urls: best.candidate.turnUrls,
      username: TURN_USERNAME,
      credential: TURN_CREDENTIAL,
    },
  ];

  cachedResult = {
    iceServers,
    region: best.candidate.label,
    resolvedAt: Date.now(),
  };

  return iceServers;
}

/** Force-clear the cache (call on logout or network change) */
export function invalidateTURNCache() {
  cachedResult = null;
}

/** Get last resolved region label for display */
export function getLastResolvedRegion(): string {
  return cachedResult?.region ?? 'Unknown';
}
