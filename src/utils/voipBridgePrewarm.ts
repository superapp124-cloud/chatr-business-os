/**
 * voipBridgePrewarm.ts — React/JS Pre-warm Engine
 *
 * Responsibilities:
 *  1. Listen for the native "prewarm_boot" Capacitor event dispatched by
 *     VoIPPrewarmService / MainActivity when an incoming call FCM is received.
 *  2. Call getUserMedia() immediately to warm up camera/mic pipelines.
 *  3. Pre-create an RTCPeerConnection so ICE gathering starts before the
 *     user taps "Accept".
 *  4. Force H264 via setCodecPreferences (modern API) with an SDP-munging
 *     fallback for older Android WebView versions.
 *  5. Expose transferPrewarmState() so simpleWebRTC.ts can adopt the already-
 *     warmed stream + peer connection the instant the user accepts.
 *
 * Edge cases covered:
 *  • AbortError / NotReadableError on getUserMedia (hardware in use) → retry
 *  • OverconstrainedError on H264 codec negotiation → fall back to SDP munging
 *  • Multiple "prewarm_boot" events for the same callId → idempotent guard
 *  • Prewarm state TTL (60 s) — auto-cleanup matches VoIPPrewarmService lifetime
 */

import { getTurnConfig } from '@/utils/webrtcSignaling';
import { ChatrLowLatencySignaling } from '@/utils/chatLowLatencySignaling';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PrewarmState {
  callId: string;
  isVideo: boolean;
  localStream: MediaStream | null;
  pc: RTCPeerConnection | null;
  signalingClient: ChatrLowLatencySignaling | null;
  startedAt: number;
  mediaReady: boolean;
  iceGatheringStarted: boolean;
  error: string | null;
}

interface NativePrewarmPayload {
  callId: string;
  isVideo: boolean;
  callerId?: string;
  callerName?: string;
  conversationId?: string;
  prewarmAt?: number;
}

// ─── Module-level singleton (one active prewarm at a time) ────────────────────

let activePrewarm: PrewarmState | null = null;
let prewarmCleanupTimer: ReturnType<typeof setTimeout> | null = null;

const PREWARM_TTL_MS = 65_000; // slightly longer than the native service TTL
const MEDIA_RETRY_LIMIT = 3;
const MEDIA_RETRY_DELAY_MS = 1_200;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Called from App.tsx (or a dedicated useEffect) on mount.
 * Registers listeners for both the Capacitor native event and the DOM custom
 * event that the prewarm WebView dispatches.
 */
export function initVoIPPrewarm(): () => void {
  const handlePrewarm = (payload: NativePrewarmPayload) => {
    void runPrewarm(payload);
  };

  // Listen for Capacitor native plugin event (from MainActivity)
  const capListener = listenCapacitorPrewarm(handlePrewarm);

  // Listen for DOM event (from VoIPPrewarmService hidden WebView bootstrap JS)
  const domHandler = (e: Event) => {
    const detail = (e as CustomEvent<NativePrewarmPayload>).detail;
    if (detail?.callId) handlePrewarm(detail);
  };
  window.addEventListener('chatr_prewarm_boot', domHandler);

  // Consume any payload written before the React app finished loading
  consumeWindowPrewarmGlobal();

  return () => {
    capListener?.remove();
    window.removeEventListener('chatr_prewarm_boot', domHandler);
  };
}

/**
 * Returns the current prewarm state and marks it as consumed so the
 * RTCPeerConnection / stream are not double-used.
 * Call this from simpleWebRTC.ts immediately after the user accepts.
 */
export function transferPrewarmState(callId: string): PrewarmState | null {
  if (!activePrewarm || activePrewarm.callId !== callId) {
    console.warn('[Prewarm] No matching prewarm state for callId:', callId.slice(0, 8));
    return null;
  }

  const state = activePrewarm;
  activePrewarm = null; // hand off ownership
  clearPrewarmTimer();

  console.log(
    `[Prewarm] ✅ Transferred state to call engine. ` +
    `mediaReady=${state.mediaReady} iceStarted=${state.iceGatheringStarted} ` +
    `age=${Date.now() - state.startedAt}ms`
  );

  return state;
}

/** Manual teardown — call when a call is rejected, missed, or ends. */
export function cancelPrewarm(callId?: string): void {
  if (!activePrewarm) return;
  if (callId && activePrewarm.callId !== callId) return;

  console.log('[Prewarm] Cancelling prewarm for', activePrewarm.callId.slice(0, 8));
  destroyPrewarmState(activePrewarm);
  activePrewarm = null;
  clearPrewarmTimer();
}

// ─── Core prewarm logic ───────────────────────────────────────────────────────

async function runPrewarm(payload: NativePrewarmPayload): Promise<void> {
  const { callId, isVideo } = payload;

  // Idempotency guard — never prewarm the same call twice
  if (activePrewarm?.callId === callId) {
    console.log('[Prewarm] Already warming call', callId.slice(0, 8));
    return;
  }

  // Destroy any previous stale prewarm
  if (activePrewarm) {
    console.warn('[Prewarm] Replacing stale prewarm for', activePrewarm.callId.slice(0, 8));
    destroyPrewarmState(activePrewarm);
  }

  const state: PrewarmState = {
    callId,
    isVideo,
    localStream: null,
    pc: null,
    signalingClient: null,
    startedAt: Date.now(),
    mediaReady: false,
    iceGatheringStarted: false,
    error: null,
  };
  activePrewarm = state;

  // Schedule auto-cleanup so we never hold camera/mic indefinitely
  schedulePrewarmTTL();

  console.log(`[Prewarm] 🔥 Starting for call ${callId.slice(0, 8)} isVideo=${isVideo}`);

  // Run in parallel — media + ICE/TURN config fetch
  const [stream, iceServers] = await Promise.allSettled([
    acquireMediaWithRetry(isVideo),
    fetchIceServers(),
  ]);

  if (state !== activePrewarm) return; // superseded

  // ── Media ──────────────────────────────────────────────────────────────────
  if (stream.status === 'fulfilled' && stream.value) {
    state.localStream = stream.value;
    state.mediaReady  = true;
    console.log('[Prewarm] 🎤 Media stream acquired');
  } else {
    const err = stream.status === 'rejected' ? stream.reason : 'null stream';
    console.error('[Prewarm] ❌ Media acquisition failed:', err);
    state.error = String(err);
    // Non-fatal — continue with ICE prewarm even without media
  }

  // ── RTCPeerConnection pre-creation ────────────────────────────────────────
  const resolvedIce =
    iceServers.status === 'fulfilled' ? iceServers.value : getCloudflareIceFallback();

  try {
    const pc = new RTCPeerConnection({
      iceServers: resolvedIce,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      // Aggressive candidate pool reduces first-byte ICE latency by ~200 ms
      iceCandidatePoolSize: 10,
    });

    // Attach media tracks early so they're baked into the first offer
    if (state.localStream) {
      attachTracksAndForceH264(pc, state.localStream, isVideo);
    } else {
      // Add recvonly transceivers so the SDP has the right m-lines when we
      // eventually get media
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      if (isVideo) pc.addTransceiver('video', { direction: 'sendrecv' });
    }

    // Start ICE candidate gathering immediately by creating a throwaway offer.
    // This is the biggest single latency win — ICE is gathered before the user
    // even sees the "Accept" button.
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: isVideo });
    await pc.setLocalDescription(offer);

    state.pc = pc;
    state.iceGatheringStarted = true;
    console.log('[Prewarm] 🧊 ICE gathering started (candidate pool pre-loaded)');
  } catch (ex) {
    console.error('[Prewarm] ❌ RTCPeerConnection pre-creation failed:', ex);
    state.error = String(ex);
  }

  // ── Signaling client (optional — does not block the prewarm) ─────────────
  try {
    const socketUrl = import.meta.env.VITE_SOCKET_URL;
    if (socketUrl) {
      state.signalingClient = new ChatrLowLatencySignaling(socketUrl);
      await state.signalingClient.connect();
      console.log('[Prewarm] 📡 Low-latency signaling pre-connected');
    }
  } catch (ex) {
    console.warn('[Prewarm] Signaling pre-connect skipped:', ex);
    // Non-fatal — simpleWebRTC will create its own connection
  }

  console.log(
    `[Prewarm] ✅ Complete in ${Date.now() - state.startedAt}ms` +
    ` mediaReady=${state.mediaReady} iceStarted=${state.iceGatheringStarted}`
  );
}

// ─── Media acquisition with retry ─────────────────────────────────────────────

async function acquireMediaWithRetry(isVideo: boolean, attempt = 0): Promise<MediaStream | null> {
  const constraints: MediaStreamConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      // Prefer hardware processing when available
      sampleRate: 16_000,
    },
    video: isVideo
      ? {
          width:       { ideal: 640,  max: 1280 },
          height:      { ideal: 360,  max: 720  },
          frameRate:   { ideal: 24,   max: 30   },
          facingMode:  'user',
        }
      : false,
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (err: unknown) {
    const error = err as DOMException;
    const isRetryable =
      error.name === 'AbortError'        ||   // hardware momentarily unavailable
      error.name === 'NotReadableError'  ||   // device in use by another tab
      error.name === 'NotAllowedError';       // permission race during bg boot

    if (isRetryable && attempt < MEDIA_RETRY_LIMIT) {
      console.warn(`[Prewarm] Media retry ${attempt + 1}/${MEDIA_RETRY_LIMIT}: ${error.name}`);
      await sleep(MEDIA_RETRY_DELAY_MS * (attempt + 1)); // exponential back-off
      return acquireMediaWithRetry(isVideo, attempt + 1);
    }

    // OverconstrainedError: relax video constraints and retry once
    if (error.name === 'OverconstrainedError' && isVideo && attempt === 0) {
      console.warn('[Prewarm] Video overconstrained — retrying audio-only');
      return acquireMediaWithRetry(false, attempt + 1);
    }

    throw error;
  }
}

// ─── Codec forcing ─────────────────────────────────────────────────────────────

/**
 * Attach tracks and force H264 over VP8.
 * Prefers the modern setCodecPreferences API (Android 12+ WebView) and falls
 * back to SDP munging for older versions.
 */
function attachTracksAndForceH264(
  pc: RTCPeerConnection,
  stream: MediaStream,
  isVideo: boolean,
): void {
  for (const track of stream.getTracks()) {
    pc.addTrack(track, stream);
  }

  if (!isVideo) return;

  // ── Modern path: RTCRtpTransceiver.setCodecPreferences ───────────────────
  const videoTransceiver = pc.getTransceivers().find(
    t => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video'
  );

  if (videoTransceiver && typeof videoTransceiver.setCodecPreferences === 'function') {
    try {
      const supportedCodecs = RTCRtpSender.getCapabilities('video')?.codecs ?? [];

      // Build a preference list: H264 first, then the rest
      const h264Codecs  = supportedCodecs.filter(c => c.mimeType.toLowerCase() === 'video/h264');
      const otherCodecs = supportedCodecs.filter(c => c.mimeType.toLowerCase() !== 'video/h264');

      if (h264Codecs.length > 0) {
        videoTransceiver.setCodecPreferences([...h264Codecs, ...otherCodecs]);
        console.log(`[Prewarm] ✅ setCodecPreferences: H264 first (${h264Codecs.length} variants)`);
      } else {
        console.warn('[Prewarm] H264 not in getCapabilities() — WebView may be too old');
      }
      return;
    } catch (ex: unknown) {
      // InvalidModificationError can be thrown if the transceiver state is wrong
      const errName = ex instanceof DOMException ? ex.name : 'Unknown';
      console.warn(`[Prewarm] setCodecPreferences failed (${errName}) — falling back to SDP munging`);
    }
  }

  // ── Legacy path: SDP munging hook ─────────────────────────────────────────
  // We monkey-patch createOffer/createAnswer on this specific PC instance so
  // all future negotiation from simpleWebRTC also benefits.
  patchPcWithSdpMunging(pc);
  console.log('[Prewarm] 🔧 SDP munging patch applied (legacy WebView)');
}

/**
 * Patches createOffer / createAnswer on a single RTCPeerConnection instance to
 * reorder video codec payloads so H264 appears first.
 *
 * Works on Android WebView 67+ (Chrome 67+ equivalent).
 */
function patchPcWithSdpMunging(pc: RTCPeerConnection): void {
  const originalCreateOffer  = pc.createOffer.bind(pc);
  const originalCreateAnswer = pc.createAnswer.bind(pc);

  const munge = (desc: RTCSessionDescriptionInit): RTCSessionDescriptionInit => ({
    ...desc,
    sdp: desc.sdp ? sdpPreferH264(desc.sdp) : desc.sdp,
  });

  pc.createOffer  = async (...args) => munge(await originalCreateOffer(...args));
  pc.createAnswer = async (...args) => munge(await originalCreateAnswer(...args));
}

/**
 * Re-orders SDP video codec payloads so H264 appears before VP8/VP9.
 * Preserves all codec lines; only reorders the m= payload list.
 */
export function sdpPreferH264(sdp: string): string {
  const eol      = sdp.includes('\r\n') ? '\r\n' : '\n';
  const sections = sdp.split(`${eol}m=`);
  const session  = sections[0];

  const remapped = sections.slice(1).map(section => {
    const block = `m=${section}`;
    if (!block.startsWith('m=video ')) return block;

    const lines = block.split(eol);
    const mParts = lines[0].split(/\s+/);
    const payloads = mParts.slice(3);

    // Map payload → codec name
    const codecMap = new Map<string, string>();
    for (const line of lines) {
      const m = line.match(/^a=rtpmap:(\d+)\s+([^/\s]+)/i);
      if (m) codecMap.set(m[1], m[2].toLowerCase());
    }

    const h264 = payloads.filter(p => codecMap.get(p) === 'h264');
    const rest  = payloads.filter(p => codecMap.get(p) !== 'h264');

    if (!h264.length) return block; // no H264 in this SDP — leave untouched

    lines[0] = [...mParts.slice(0, 3), ...h264, ...rest].join(' ');
    console.log(`[Prewarm] SDP munge: ${h264.length} H264 payload(s) promoted`);
    return lines.join(eol);
  });

  return [session, ...remapped.map(s => s.replace(/^m=/, ''))].join(`${eol}m=`);
}

// ─── ICE server helpers ────────────────────────────────────────────────────────

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const config = await getTurnConfig();
    return config.iceServers ?? [];
  } catch {
    return getCloudflareIceFallback();
  }
}

function getCloudflareIceFallback(): RTCIceServer[] {
  return [
    {
      urls: [
        'stun:stun.cloudflare.com:3478',
        'turn:turn.cloudflare.com:3478?transport=udp',
        'turn:turn.cloudflare.com:3478?transport=tcp',
        'turns:turn.cloudflare.com:5349?transport=tcp',
      ],
      username:   'g0c53265fd3d77b1917f9d26a934e34f4cc2e358d65733e4285a7be2e4344489',
      credential: '5969d5f8b822bcd5a43c3c5257fd9cbca7a787db37e20aa1602746f6b77a393a',
    },
  ];
}

// ─── Capacitor native event listener ──────────────────────────────────────────

interface CapacitorListener { remove: () => void }

function listenCapacitorPrewarm(
  cb: (payload: NativePrewarmPayload) => void
): CapacitorListener | null {
  try {
    // Capacitor 5+ dynamic import pattern
    const cap = (window as Window & { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
    if (!cap) return null;

    // The native plugin emits 'voip_prewarm' via notifyListeners in MainActivity
    const handler = (event: CustomEvent) => {
      if (event.detail) cb(event.detail as NativePrewarmPayload);
    };
    window.addEventListener('chatr:voip_prewarm', handler as EventListener);
    return { remove: () => window.removeEventListener('chatr:voip_prewarm', handler as EventListener) };
  } catch {
    return null;
  }
}

/** Handle payloads written by VoIPPrewarmService before React mounted. */
function consumeWindowPrewarmGlobal(): void {
  const global = (window as Window & { __CHATR_PREWARM__?: NativePrewarmPayload }).__CHATR_PREWARM__;
  if (global?.callId) {
    console.log('[Prewarm] Consuming window.__CHATR_PREWARM__ written before React mounted');
    void runPrewarm(global);
  }
}

// ─── Cleanup helpers ──────────────────────────────────────────────────────────

function destroyPrewarmState(state: PrewarmState): void {
  try {
    state.localStream?.getTracks().forEach(t => t.stop());
    state.pc?.close();
    state.signalingClient?.disconnect();
  } catch (ex) {
    console.warn('[Prewarm] Error during state cleanup:', ex);
  }
}

function schedulePrewarmTTL(): void {
  clearPrewarmTimer();
  prewarmCleanupTimer = setTimeout(() => {
    if (activePrewarm) {
      console.warn('[Prewarm] TTL expired — releasing resources');
      destroyPrewarmState(activePrewarm);
      activePrewarm = null;
    }
  }, PREWARM_TTL_MS);
}

function clearPrewarmTimer(): void {
  if (prewarmCleanupTimer !== null) {
    clearTimeout(prewarmCleanupTimer);
    prewarmCleanupTimer = null;
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
