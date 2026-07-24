import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { classifyNetwork, NetworkQuality, onNetworkChange } from "./networkClassification";
import { getCallPreset, getWebRTCConfig, applyBitrateLimits, CallPreset } from "./indiaCallPresets";
import { createICEMonitor, ICEMonitorState } from "./iceConnectionMonitor";
import { AdaptiveBitrateEngine, type VideoTier } from "./adaptiveBitrateEngine";
import { detectDeviceCapabilities, applyOptimalCodecs } from "./deviceCapabilities";
import { socketService } from "@/services/socketService";
import { getTurnConfig } from "./webrtcSignaling";
import { HybridSignalingManager, type SignalMessage } from "./webTransportSignaling";
import { getInsertableStreamsManager, type InsertableStreamsManager } from "./insertableStreams";
import { securityService } from "@/services/securityService";
import { shouldPreserveConnectedSession } from "@/core/platformParity/sharedCallStateResolver";
import { logSdpSummary, startWebRTCDiagnostics } from "./webrtcDiagnostics";
import { transferPrewarmState, cancelPrewarm } from "./voipBridgePrewarm";
import { looksLikeUuid } from "./callIdentity";
// ─── Premium Call Engine additions ───────────────────────────────────────────
import { TurnCache } from "@/services/turnCache";
import { shouldKeepCandidate } from "./iceFilter";
import { networkMonitor } from "./networkMonitor";
import { consumePrewarmStream } from "@/hooks/usePrewarmStream";
// ─────────────────────────────────────────────────────────────────────────────

type CallState = 'connecting' | 'connected' | 'recovering' | 'failed' | 'ended';
type SignalType = 'offer' | 'answer' | 'ice-candidate' | 'signal-ack' | 'video-request' | 'video-accept' | 'video-reject' | 'video-enable';

interface Signal {
  type: SignalType;
  data: unknown;
  from: string;
}

type EventHandler = (...args: unknown[]) => void;
type SocketSignalPayload = {
  callId?: string;
  targetId?: string;
  data?: unknown;
  from?: string;
};
type RealtimeSignalRow = {
  id: string;
  to_user: string;
  from_user: string;
  signal_type: SignalType;
  signal_data: unknown;
};
type ChatrSessionDescriptionInit = RTCSessionDescriptionInit & {
  __chatr?: { reason?: string };
};
type ZoomCapabilities = MediaTrackCapabilities & { zoom?: number };
type ZoomConstraint = MediaTrackConstraintSet & { zoom?: number };

// Video upgrade callback type
export type VideoUpgradeCallback = (fromUserId: string) => void;

// GLOBAL: Prevent duplicate WebRTC instances for same call
const activeCallInstances = new Map<string, SimpleWebRTCCall>();
// CRITICAL: Prevent race conditions during instance creation
const creationLocks = new Set<string>();
const ANDROID_SAFE_MAX_VIDEO_FRAMERATE = 30;

function disposeCallInstance(callId: string, reason: string): void {
  const existing = activeCallInstances.get(callId);
  activeCallInstances.delete(callId);
  creationLocks.delete(callId);

  if (!existing) return;

  console.warn(`[WebRTC] Disposing call instance ${callId.slice(0, 8)} (${reason})`);
  void existing.end().catch(error => {
    console.warn('[WebRTC] Failed to dispose call instance:', error);
  });
}

export function clearOtherCallInstances(activeCallId: string, reason = 'new call'): void {
  for (const callId of Array.from(activeCallInstances.keys())) {
    if (callId !== activeCallId) {
      disposeCallInstance(callId, reason);
    }
  }
}

// Get existing instance (TRUE singleton pattern)
export function getExistingCall(callId: string): SimpleWebRTCCall | undefined {
  const existing = activeCallInstances.get(callId);
  if (!existing) return undefined;

  if (!existing.hasValidPartnerId()) {
    console.warn(`[WebRTC] Dropping cached call ${callId.slice(0, 8)} with invalid partner id before reuse`);
    disposeCallInstance(callId, 'invalid partner id');
    return undefined;
  }

  return existing;
}

// Check if instance exists or is being created
export function hasActiveCall(callId: string): boolean {
  return !!getExistingCall(callId) || creationLocks.has(callId);
}

// Clear existing instance for a call
export function clearCallInstance(callId: string): void {
  disposeCallInstance(callId, 'explicit clear');
}

/**
 * SimpleWebRTCCall - Robust, Fast WebRTC Implementation
 * 
 * Key improvements:
 * - TRUE SINGLETON per call ID (factory pattern with creation lock)
 * - Faster ICE gathering with aggressive candidate pool
 * - Single offer per connection attempt (no spam)
 * - Proper answer timeout handling
 * - Graceful media fallback
 * - Clear state management
 */
export class SimpleWebRTCCall {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private signalChannel: RealtimeChannel | null = null;
  private callState: CallState = 'connecting';
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private pendingIceCandidates: RTCIceCandidate[] = [];
  private hasReceivedAnswer: boolean = false;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private offerSent: boolean = false;
  private answerSent: boolean = false;
  private processedSignalIds: Set<string> = new Set();
  private started: boolean = false;
  private instanceId: string; // For debugging
  
  // India-first: Network-aware configuration
  private networkQuality: NetworkQuality = 'HOSTILE'; // Default to worst-case
  private callPreset: CallPreset | null = null;
  private iceMonitor: (ICEMonitorState & { cleanup: () => void }) | null = null;
  private abrEngine: AdaptiveBitrateEngine | null = null;
  private networkChangeCleanup: (() => void) | null = null;
  private signalingManager: HybridSignalingManager | null = null;
  private insertableStreams: InsertableStreamsManager | null = null;
  private iceRefreshInterval: NodeJS.Timeout | null = null;
  private socketSignalUnsubscribers: Array<() => void> = [];
  private signalsSubscribed: boolean = false;
  private mediaSessionAuthoritative: boolean = false;
  private lastConnectedAt: number | null = null;
  private recoveryTimer: NodeJS.Timeout | null = null;
  private recoveryAttempts: number = 0;
  private readonly connectedRecoveryWindowMs: number = 20_000;
  private readonly maxConnectedRecoveryAttempts: number = 4;
  private explicitEnding: boolean = false;
  private bufferedSignals: Signal[] = [];
  private signalSeqCounter: number = 0;
  private pendingAcks: Map<string, { signal: Signal; attempts: number; timer: NodeJS.Timeout }> = new Map();
  private remoteStream: MediaStream = new MediaStream();
  private diagnosticsCleanup: (() => void) | null = null;
  private activeStatusUpdateInFlight: boolean = false;
  private activeStatusUpdated: boolean = false;
  private lastAnsweredOfferFingerprint: string | null = null;
  private cleanupStarted: boolean = false;
  private audioWantedEnabled: boolean = true;
  private outboundAudioWatchdog: NodeJS.Timeout | null = null;

  // Factory method - use this instead of constructor
  static create(
    callId: string,
    partnerId: string,
    isVideo: boolean,
    isInitiator: boolean,
    userId: string,
    initialLocalStream: MediaStream | null = null
  ): SimpleWebRTCCall {
    clearOtherCallInstances(callId, 'creating new call');

    // STRICT SINGLETON CHECK 1: Return existing instance
    const existing = activeCallInstances.get(callId);
    if (existing) {
      console.log('⚠️ [WebRTC] Returning existing instance for call:', callId.slice(0, 8));
      return existing;
    }
    
    // STRICT SINGLETON CHECK 2: Block if creation in progress
    if (creationLocks.has(callId)) {
      console.log('🔒 [WebRTC] Creation in progress, waiting for existing instance:', callId.slice(0, 8));
      // Return existing if it appeared during the lock
      const waitingInstance = activeCallInstances.get(callId);
      if (waitingInstance) return waitingInstance;
      // This shouldn't happen, but create anyway with warning
      console.warn('⚠️ [WebRTC] Lock exists but no instance - creating anyway');
    }
    
    // Acquire creation lock BEFORE creating instance
    creationLocks.add(callId);
    console.log('🔐 [WebRTC] Acquired creation lock for:', callId.slice(0, 8));
    
    const instance = new SimpleWebRTCCall(callId, partnerId, isVideo, isInitiator, userId, initialLocalStream);
    activeCallInstances.set(callId, instance);
    
    // Release lock (instance is now in map)
    creationLocks.delete(callId);
    
    return instance;
  }

  private constructor(
    private callId: string,
    private partnerId: string,
    private isVideo: boolean,
    private isInitiator: boolean,
    private userId: string,
    initialLocalStream: MediaStream | null = null
  ) {
    // Generate unique instance ID for debugging duplicate detection
    this.instanceId = `${callId.slice(0, 8)}-${Date.now().toString(36)}`;
    
    if (initialLocalStream) {
      this.localStream = initialLocalStream;
      console.log('🎤 [WebRTC] Using pre-acquired media stream');
    }
    console.log(`🎬 [WebRTC] Init [${this.instanceId}]:`, { isVideo, isInitiator, userId: userId.slice(0, 8) });
    
    // India-first: Classify network immediately
    this.networkQuality = classifyNetwork();
    this.callPreset = getCallPreset(this.networkQuality, isVideo);
    console.log(`🇮🇳 [WebRTC] India-first preset: ${this.callPreset.name} (network: ${this.networkQuality})`);
    
    // Security Governance: Log call initiation
    securityService.logEvent({
      eventType: 'call_initiate',
      severity: 'info',
      metadata: { callId: this.callId, isVideo: this.isVideo, isInitiator: this.isInitiator, networkQuality: this.networkQuality }
    });
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream.getTracks().length > 0 ? this.remoteStream : null;
  }

  hasValidPartnerId(): boolean {
    return looksLikeUuid(this.partnerId);
  }

  private describeStream(stream: MediaStream | null): string {
    if (!stream) return 'none';
    const tracks = stream.getTracks().map(track =>
      `${track.kind}:${track.readyState}:${track.enabled ? 'enabled' : 'disabled'}`
    );
    return tracks.length > 0 ? tracks.join(',') : 'empty';
  }

  private describeSenders(): string {
    if (!this.pc) return 'no-pc';
    const senders = this.pc.getSenders().map((sender, index) => {
      const track = sender.track;
      return `${index}:${track?.kind || 'none'}:${track?.readyState || 'n/a'}:${track?.enabled ? 'enabled' : 'disabled'}`;
    });
    return senders.length > 0 ? senders.join(',') : 'none';
  }

  private addRemoteTrackToAggregate(track: MediaStreamTrack, incomingStream?: MediaStream): MediaStream {
    const tracks = incomingStream?.getTracks?.() ?? [track];

    for (const candidate of tracks) {
      if (!this.remoteStream.getTracks().some(existing => existing.id === candidate.id)) {
        this.remoteStream.addTrack(candidate);
      }
    }

    return this.remoteStream;
  }

  private getLiveVideoTracks(stream: MediaStream | null = this.localStream): MediaStreamTrack[] {
    return stream?.getVideoTracks().filter(track => track.readyState === 'live') ?? [];
  }

  private getLiveLocalStreamTrack(kind: 'audio' | 'video'): MediaStreamTrack | null {
    return this.localStream
      ?.getTracks()
      .find(track => track.kind === kind && track.readyState === 'live') ?? null;
  }

  private getLiveSender(kind: 'audio' | 'video'): RTCRtpSender | null {
    return this.pc
      ?.getSenders()
      .find(sender => sender.track?.kind === kind && sender.track.readyState === 'live') ?? null;
  }

  private hasLiveLocalTrack(kind: 'audio' | 'video'): boolean {
    const streamHasTrack = this.localStream
      ?.getTracks()
      .some(track => track.kind === kind && track.readyState === 'live') ?? false;
    const senderHasTrack = this.pc
      ?.getSenders()
      .some(sender => sender.track?.kind === kind && sender.track.readyState === 'live') ?? false;

    return streamHasTrack || senderHasTrack;
  }

  private buildAudioConstraints(): MediaTrackConstraints {
    const activePreset = this.callPreset || getCallPreset(this.networkQuality, this.isVideo);

    return {
      ...(typeof activePreset.audio === 'object' ? activePreset.audio : {}),
      echoCancellation: { ideal: true },
      noiseSuppression: { ideal: true },
      autoGainControl: { ideal: true },
      sampleRate: activePreset.maxAudioBitrate <= 20 ? { ideal: 24000 } : { ideal: 48000 },
      sampleSize: { ideal: 16 },
      channelCount: activePreset.audio.channelCount || { ideal: 1 },
      // Chrome/Edge advanced constraints for superior noise cancellation
      // @ts-expect-error - experimental constraints
      googEchoCancellation: true,
      // @ts-expect-error - Chrome audio constraint
      googAutoGainControl: true,
      // @ts-expect-error - Chrome audio constraint
      googNoiseSuppression: true,
      // @ts-expect-error - Chrome audio constraint
      googNoiseReduction: true,
      // @ts-expect-error - Chrome audio constraint
      googHighpassFilter: true,
      // @ts-expect-error - Chrome audio constraint
      googTypingNoiseDetection: true,
      // @ts-expect-error - Chrome audio constraint
      googExperimentalNoiseSuppression: true,
      // @ts-expect-error - Chrome audio constraint
      googBeamforming: true,
    };
  }

  private async ensureAudioTrackForNegotiation(reason: string): Promise<boolean> {
    const streamAudio = this.getLiveLocalStreamTrack('audio');
    const senderAudio = this.getLiveSender('audio')?.track ?? null;

    if (streamAudio) {
      streamAudio.enabled = this.audioWantedEnabled;
      console.log(
        `[WebRTC] Local audio already live (${reason}): stream=${this.describeStream(this.localStream)} ` +
        `senders=${this.describeSenders()}`,
      );
      return false;
    }

    if (senderAudio) {
      senderAudio.enabled = this.audioWantedEnabled;
      if (!this.localStream) {
        this.localStream = new MediaStream();
      }
      if (!this.localStream.getAudioTracks().some(track => track.id === senderAudio.id)) {
        this.localStream.addTrack(senderAudio);
      }
      console.log(
        `[WebRTC] Reusing live audio sender track (${reason}): stream=${this.describeStream(this.localStream)} ` +
        `senders=${this.describeSenders()}`,
      );
      return false;
    }

    const startTime = Date.now();

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: this.buildAudioConstraints(),
        video: false,
      });
      const audioTrack = audioStream.getAudioTracks()[0] ?? null;

      if (!audioTrack) {
        audioStream.getTracks().forEach(track => track.stop());
        console.warn(`[WebRTC] No audio track returned before negotiation (${reason})`);
        return false;
      }

      if (!this.localStream) {
        this.localStream = new MediaStream();
      }

      for (const oldTrack of this.localStream.getAudioTracks()) {
        this.localStream.removeTrack(oldTrack);
        oldTrack.stop();
      }

      this.localStream.addTrack(audioTrack);
      console.log(
        `[WebRTC] Added local audio track before negotiation (${reason}) in ${Date.now() - startTime}ms: ` +
        `stream=${this.describeStream(this.localStream)}`,
      );
      this.emit('localStream', this.localStream);
      return true;
    } catch (error) {
      console.warn(`[WebRTC] Could not acquire local audio before negotiation (${reason}); continuing anyway`, error);
      return false;
    }
  }

  private async attachAudioForNegotiation(reason: string): Promise<void> {
    await this.ensureAudioTrackForNegotiation(reason);
    if (this.localStream) {
      await this.attachLocalStreamTracks(this.localStream, reason);
    }
    await this.forceOutboundAudioSender(reason);
  }

  private remoteOfferRequestsLocalVideo(description: RTCSessionDescriptionInit): boolean {
    if (!description.sdp) return false;

    const eol = this.getSdpLineSeparator(description.sdp);
    const sections = description.sdp.split(`${eol}m=`);
    const mediaSections = sections.slice(1).map(section => `m=${section}`);

    return mediaSections.some(section => {
      if (!section.startsWith('m=video ')) return false;

      const lines = section.split(eol);
      const mLineParts = lines[0].trim().split(/\s+/);
      if (mLineParts[1] === '0') return false;

      const direction = lines.find(line =>
        line === 'a=sendrecv' ||
        line === 'a=sendonly' ||
        line === 'a=recvonly' ||
        line === 'a=inactive'
      )?.replace('a=', '') || 'sendrecv';

      return direction === 'sendrecv' || direction === 'recvonly';
    });
  }

  private async acquireVideoTrackForLocalStream(reason: string): Promise<MediaStreamTrack | null> {
    let lastError: unknown = null;
    const startTime = Date.now();

    for (const profile of this.getVideoCaptureProfiles('user')) {
      try {
        console.log(`[WebRTC] Trying video top-up profile (${reason}): ${profile.label}`);
        const videoStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: profile.constraints,
        });
        const [videoTrack, ...extraVideoTracks] = videoStream.getVideoTracks();
        extraVideoTracks.forEach(track => track.stop());

        if (videoTrack) {
          const settings = videoTrack.getSettings();
          console.log(
            `[WebRTC] Video top-up acquired (${reason}): ` +
              `${settings.width || '?'}x${settings.height || '?'}@${settings.frameRate || '?'}fps ` +
              `(${profile.label}) in ${Date.now() - startTime}ms`,
          );
          return videoTrack;
        }

        videoStream.getTracks().forEach(track => track.stop());
      } catch (error) {
        lastError = error;
        console.log(`[WebRTC] Video top-up ${profile.label} failed (${reason})`, error);
      }
    }

    try {
      console.log(`[WebRTC] Trying basic video top-up (${reason})`);
      const videoStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user' },
      });
      const videoTrack = videoStream.getVideoTracks()[0] ?? null;
      if (!videoTrack) {
        videoStream.getTracks().forEach(track => track.stop());
        return null;
      }
      console.log(`[WebRTC] Basic video top-up acquired (${reason}) in ${Date.now() - startTime}ms`);
      return videoTrack;
    } catch (error) {
      console.warn(`[WebRTC] Video top-up failed (${reason}); continuing without local video`, error || lastError);
      return null;
    }
  }

  private async ensureVideoTrackForVideoCall(reason: string): Promise<boolean> {
    if (!this.isVideo) return false;

    if (this.getLiveVideoTracks().length > 0) {
      console.log(`[WebRTC] Local video already live (${reason}): stream=${this.describeStream(this.localStream)}`);
      return false;
    }

    if (!this.localStream) {
      this.localStream = new MediaStream();
    }

    for (const track of this.localStream.getVideoTracks()) {
      this.localStream.removeTrack(track);
      track.stop();
    }

    const videoTrack = await this.acquireVideoTrackForLocalStream(reason);
    if (!videoTrack) return false;

    this.localStream.addTrack(videoTrack);
    console.log(`[WebRTC] Added local video track (${reason}): stream=${this.describeStream(this.localStream)}`);
    this.emit('localStream', this.localStream);
    return true;
  }

  private ensureMediaTransceivers() {
    if (!this.pc || this.isAndroidRuntime()) return;

    const ensure = (kind: 'audio' | 'video') => {
      const existing = this.pc!.getTransceivers().find(transceiver =>
        transceiver.sender.track?.kind === kind ||
        transceiver.receiver.track?.kind === kind
      );

      if (!existing) {
        this.pc!.addTransceiver(kind, { direction: 'sendrecv' });
        console.log(`[WebRTC] Pre-created ${kind} sendrecv transceiver for stable SDP`);
      } else if (existing.direction === 'recvonly' || existing.direction === 'inactive') {
        existing.direction = 'sendrecv';
      }
    };

    ensure('audio');
    if (this.isVideo) {
      ensure('video');
    }
  }

  private findReusableSender(kind: 'audio' | 'video'): RTCRtpSender | null {
    if (!this.pc) return null;

    const senderWithLiveTrack = this.pc.getSenders().find(sender =>
      sender.track?.kind === kind && sender.track.readyState === 'live'
    );
    if (senderWithLiveTrack) return senderWithLiveTrack;

    const senderWithTrack = this.pc.getSenders().find(sender => sender.track?.kind === kind);
    if (senderWithTrack) return senderWithTrack;

    const transceiver = this.pc.getTransceivers().find(candidate =>
      candidate.receiver.track?.kind === kind && !candidate.sender.track
    );

    return transceiver?.sender || null;
  }

  private async forceOutboundAudioSender(reason: string, forceFreshTrack = false): Promise<boolean> {
    if (!this.pc) return false;

    if (!this.localStream) {
      this.localStream = new MediaStream();
    }

    let audioTrack = this.getLiveLocalStreamTrack('audio');

    if (forceFreshTrack) {
      try {
        for (const oldTrack of this.localStream.getAudioTracks()) {
          this.localStream.removeTrack(oldTrack);
          oldTrack.stop();
        }
        audioTrack = null;

        const freshAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: this.buildAudioConstraints(),
          video: false,
        });
        const freshAudioTrack = freshAudioStream.getAudioTracks()[0] ?? null;

        if (freshAudioTrack) {
          audioTrack = freshAudioTrack;
          this.localStream.addTrack(freshAudioTrack);
          this.emit('localStream', this.localStream);
          console.log(`[WebRTC] Reacquired fresh mic track for outbound audio repair (${reason})`);
        } else {
          freshAudioStream.getTracks().forEach(track => track.stop());
        }
      } catch (error) {
        console.warn('[WebRTC] Fresh mic reacquire failed during audio repair:', error);
      }
    }

    if (!audioTrack) {
      const senderTrack = this.getLiveSender('audio')?.track ?? null;
      if (senderTrack) {
        audioTrack = senderTrack;
        if (!this.localStream.getAudioTracks().some(track => track.id === senderTrack.id)) {
          this.localStream.addTrack(senderTrack);
        }
      }
    }

    if (!audioTrack) {
      await this.ensureAudioTrackForNegotiation(`${reason}: audio sender repair`);
      audioTrack = this.getLiveLocalStreamTrack('audio');
    }

    if (!audioTrack) {
      console.warn(`[WebRTC] Cannot verify outbound audio sender (${reason}) - no live audio track`);
      return false;
    }

    audioTrack.enabled = this.audioWantedEnabled;

    for (const staleTrack of this.localStream.getAudioTracks()) {
      if (staleTrack.id === audioTrack.id) continue;
      this.localStream.removeTrack(staleTrack);
      staleTrack.stop();
    }

    this.ensureMediaTransceivers();

    for (const transceiver of this.pc.getTransceivers()) {
      const isAudio =
        transceiver.sender.track?.kind === 'audio' ||
        transceiver.receiver.track?.kind === 'audio';

      if (!isAudio || transceiver.direction === 'sendrecv') {
        continue;
      }

      try {
        transceiver.direction = 'sendrecv';
        console.log(`[WebRTC] Forced audio transceiver to sendrecv (${reason})`);
      } catch (error) {
        console.warn('[WebRTC] Failed to force audio transceiver direction:', error);
      }
    }

    const sender = this.findReusableSender('audio');
    let changed = false;

    if (sender) {
      const currentTrack = sender.track;
      const needsReplace =
        forceFreshTrack ||
        !currentTrack ||
        currentTrack.id !== audioTrack.id ||
        currentTrack.readyState !== 'live';

      if (needsReplace) {
        await sender.replaceTrack(audioTrack);
        changed = true;
        console.log(`[WebRTC] Repaired outbound audio sender with live mic track (${reason})`);
      }
    } else {
      this.pc.addTrack(audioTrack, this.localStream);
      changed = true;
      console.log(`[WebRTC] Added missing outbound audio sender (${reason})`);
    }

    console.log(
      `[WebRTC] Audio sender verified (${reason}): track=${audioTrack.readyState}:` +
      `${audioTrack.enabled ? 'enabled' : 'disabled'} senders=${this.describeSenders()}`,
    );

    return changed;
  }

  private startOutboundAudioWatchdog(): void {
    if (this.outboundAudioWatchdog || !this.pc || !this.audioWantedEnabled) return;
    if ((this as any)._audioWatchdogDisabledByAI) return;

    let zeroOutboundTicks = 0;
    let lastOutboundPackets = 0;

    this.outboundAudioWatchdog = setInterval(async () => {
      if (!this.pc || this.callState === 'ended') {
        if (this.outboundAudioWatchdog) {
          clearInterval(this.outboundAudioWatchdog);
          this.outboundAudioWatchdog = null;
        }
        return;
      }

      try {
        const stats = await this.pc.getStats();
        let inboundPackets = 0;
        let outboundPackets = 0;

        stats.forEach(report => {
          const record = report as unknown as Record<string, unknown>;
          const kind = record.kind || record.mediaType;
          if (kind !== 'audio') return;

          const packets = typeof record.packetsReceived === 'number'
            ? record.packetsReceived
            : typeof record.packetsSent === 'number'
              ? record.packetsSent
              : 0;

          if (report.type === 'inbound-rtp') {
            inboundPackets += packets;
          } else if (report.type === 'outbound-rtp') {
            outboundPackets += packets;
          }
        });

        const outboundProgressed = outboundPackets > lastOutboundPackets;
        lastOutboundPackets = outboundPackets;

        if (!this.audioWantedEnabled || outboundProgressed) {
          zeroOutboundTicks = 0;
          return;
        }

        if (inboundPackets <= 0) {
          return;
        }

        zeroOutboundTicks += 1;

        if (zeroOutboundTicks === 1) {
          await this.forceOutboundAudioSender('audio watchdog zero outbound');
          return;
        }

        if (zeroOutboundTicks >= 2) {
          zeroOutboundTicks = 0;
          await this.forceOutboundAudioSender('audio watchdog fresh mic repair', true);
        }
      } catch (error) {
        console.warn('[WebRTC] Outbound audio watchdog failed:', error);
      }
    }, 2_000);
  }

  public setAudioWatchdogEnabled(enabled: boolean): void {
    (this as any)._audioWatchdogDisabledByAI = !enabled;
    if (!enabled && this.outboundAudioWatchdog) {
      clearInterval(this.outboundAudioWatchdog);
      this.outboundAudioWatchdog = null;
      console.log('🛑 [WebRTC] Audio watchdog disabled by AI Interceptor');
    } else if (enabled && !this.outboundAudioWatchdog) {
      console.log('🟢 [WebRTC] Audio watchdog re-enabled by AI Interceptor');
      this.startOutboundAudioWatchdog();
    }
  }

  public async setAIAudioTrack(aiTrack: MediaStreamTrack | null): Promise<void> {
    if (!this.pc) return;
    
    // Find all current audio senders
    const senders = this.pc.getSenders().filter(s => s.track && s.track.kind === 'audio');
    console.log(`[WebRTC-Debug] Found ${senders.length} audio senders. Total senders: ${this.pc.getSenders().length}`);

    try {
      if (aiTrack) {
        console.log(`🎙️ [WebRTC] Swapping outbound audio to AI Track via full renegotiation`);
        this.setAudioWatchdogEnabled(false);
        
        for (const sender of senders) {
          try {
            // FORCE full renegotiation instead of replaceTrack to bypass Chromium WebAudio track bugs
            this.pc.removeTrack(sender);
            this.pc.addTrack(aiTrack, this.localStream!);
            console.log(`[WebRTC-Debug] Removed original track, added AI track.`);
            
            if (this.callState === 'connected') {
              console.log(`[WebRTC-Debug] Triggering renegotiation offer for AI track...`);
              const offer = await this.pc.createOffer();
              const localOffer = await this.setAndReturnLocalDescription(offer, 'AI track injection');
              this.emitSocketSignal({ type: 'offer', data: localOffer, from: this.userId });
            }
          } catch (err) {
            console.error('⚠️ [WebRTC] Failed to inject AI track via renegotiation', err);
          }
        }
      } else {
        console.log('🎤 [WebRTC] Restoring outbound audio to Microphone');
        this.setAudioWatchdogEnabled(true);
        const micTrack = this.getLiveLocalStreamTrack('audio');
        
        for (const sender of senders) {
          if (micTrack) {
            try {
              await sender.replaceTrack(micTrack);
            } catch (err) {
              console.warn('⚠️ [WebRTC] replaceTrack failed, falling back to remove/add', err);
              this.pc.removeTrack(sender);
              this.pc.addTrack(micTrack, this.localStream!);
              if (this.callState === 'connected') {
                const offer = await this.pc.createOffer();
                const localOffer = await this.setAndReturnLocalDescription(offer, 'Mic track restoration');
                this.emitSocketSignal({ type: 'offer', data: localOffer, from: this.userId });
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('❌ [WebRTC] Failed to set AI audio track:', e);
    }
  }

  private async attachLocalTrackToPeerConnection(
    track: MediaStreamTrack,
    stream: MediaStream,
    reason: string,
  ): Promise<{ addedMLine: boolean; replacedTrack: boolean }> {
    if (!this.pc) return { addedMLine: false, replacedTrack: false };

    const kind = track.kind as 'audio' | 'video';
    const reusableSender = kind === 'audio' || kind === 'video'
      ? this.findReusableSender(kind)
      : null;

    if (reusableSender) {
      console.log(`[WebRTC] Reusing ${kind} transceiver via replaceTrack (${reason})`);
      await reusableSender.replaceTrack(track);
      if (kind === 'video') {
        this.isVideo = true;
        this.promoteVideoTransceiversToSendrecv(reason);
        if (this.isAndroidRuntime()) {
          this.preferAndroidH264Codec();
          await this.applyAndroidVideoSenderCaps(`${reason}: replaceTrack`);
        }
      }
      return { addedMLine: false, replacedTrack: true };
    }

    if (kind === 'video') {
      this.isVideo = true;

      if (this.isAndroidRuntime() && typeof this.pc.addTransceiver === 'function') {
        this.pc.addTransceiver(track, { direction: 'sendrecv', streams: [stream] });
        console.log(`[WebRTC] Adding new video transceiver with track (${reason})`);
      } else {
        this.pc.addTrack(track, stream);
        console.log(`[WebRTC] Adding new video m-line (${reason})`);
      }

      this.promoteVideoTransceiversToSendrecv(reason);
      if (this.isAndroidRuntime()) {
        this.preferAndroidH264Codec();
        await this.applyAndroidVideoSenderCaps(`${reason}: addTransceiver`);
      }
      return { addedMLine: true, replacedTrack: false };
    }

    console.log(`[WebRTC] Adding new ${track.kind} m-line (${reason})`);
    this.pc.addTrack(track, stream);
    return { addedMLine: true, replacedTrack: false };
  }

  private promoteVideoTransceiversToSendrecv(reason: string): void {
    if (!this.pc) return;

    for (const transceiver of this.pc.getTransceivers()) {
      const isVideoTransceiver =
        transceiver.sender.track?.kind === 'video' ||
        transceiver.receiver.track?.kind === 'video';

      if (!isVideoTransceiver || transceiver.direction === 'sendrecv') {
        continue;
      }

      try {
        transceiver.direction = 'sendrecv';
        console.log(`[WebRTC] Promoted video transceiver to sendrecv (${reason})`);
      } catch (error) {
        console.warn('[WebRTC] Failed to promote video transceiver to sendrecv:', error);
      }
    }
  }

  private forceSendrecvTransceiversBeforeAnswer(reason: string): void {
    if (!this.pc) return;

    this.ensureMediaTransceivers();

    for (const transceiver of this.pc.getTransceivers()) {
      const kind = transceiver.sender.track?.kind || transceiver.receiver.track?.kind;
      const shouldForce =
        kind === 'audio' ||
        (kind === 'video' && (this.isVideo || this.hasLiveLocalTrack('video')));

      if (!shouldForce || transceiver.direction === 'sendrecv') {
        continue;
      }

      try {
        transceiver.direction = 'sendrecv';
        console.log(`[WebRTC] Forced ${kind} transceiver to sendrecv before answer (${reason})`);
      } catch (error) {
        console.warn(`[WebRTC] Failed to force ${kind} transceiver to sendrecv:`, error);
      }
    }
  }

  private async applyAndroidVideoSenderCaps(reason: string): Promise<void> {
    if (!this.isAndroidRuntime() || !this.pc) return;

    const videoSenders = this.pc.getSenders().filter(sender => sender.track?.kind === 'video');
    if (!videoSenders.length) return;

    for (const sender of videoSenders) {
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }

        params.encodings = params.encodings.map(encoding => ({
          ...encoding,
          maxFramerate: Math.min(
            typeof encoding.maxFramerate === 'number'
              ? encoding.maxFramerate
              : ANDROID_SAFE_MAX_VIDEO_FRAMERATE,
            ANDROID_SAFE_MAX_VIDEO_FRAMERATE,
          ),
        }));

        await sender.setParameters(params);
        console.log(
          `[WebRTC] Android video sender capped at ${ANDROID_SAFE_MAX_VIDEO_FRAMERATE}fps ` +
          `(${reason}, layers=${params.encodings.length})`,
        );
      } catch (error) {
        console.warn('[WebRTC] Failed to apply Android video sender caps:', error);
      }
    }
  }

  private async attachLocalStreamTracks(
    stream: MediaStream,
    reason: string,
  ): Promise<{ addedMLine: boolean; replacedTrack: boolean }> {
    if (!this.pc) return { addedMLine: false, replacedTrack: false };

    this.ensureMediaTransceivers();

    let addedMLine = false;
    let replacedTrack = false;

    for (const track of stream.getTracks()) {
      const kind = track.kind as 'audio' | 'video';
      const result = await this.attachLocalTrackToPeerConnection(track, stream, reason);
      addedMLine = addedMLine || result.addedMLine;
      replacedTrack = replacedTrack || result.replacedTrack;

      if (kind === 'video') {
        this.isVideo = true;
      }
    }

    console.log(
      `[WebRTC] Local tracks attached (${reason}): stream=${this.describeStream(stream)} senders=${this.describeSenders()}`,
    );

    return { addedMLine, replacedTrack };
  }

  private getSdpLineSeparator(sdp: string): '\r\n' | '\n' {
    return sdp.includes('\r\n') ? '\r\n' : '\n';
  }

  private withSdp(
    description: RTCSessionDescriptionInit,
    sdp: string,
  ): ChatrSessionDescriptionInit {
    const prepared: ChatrSessionDescriptionInit = {
      type: description.type,
      sdp,
    };
    const meta = (description as ChatrSessionDescriptionInit).__chatr;
    if (meta) {
      prepared.__chatr = meta;
    }
    return prepared;
  }

  private getRemoteOfferDirection(kind: 'audio' | 'video'): RTCRtpTransceiverDirection | null {
    const sdp = this.pc?.remoteDescription?.sdp;
    if (!sdp) return null;

    const eol = this.getSdpLineSeparator(sdp);
    const sections = sdp.split(`${eol}m=`);
    const mediaSection = sections
      .slice(1)
      .map(section => `m=${section}`)
      .find(section => section.startsWith(`m=${kind} `));

    if (!mediaSection) return null;

    const direction = mediaSection
      .split(eol)
      .find(line =>
        line === 'a=sendrecv' ||
        line === 'a=sendonly' ||
        line === 'a=recvonly' ||
        line === 'a=inactive'
      )
      ?.replace('a=', '') as RTCRtpTransceiverDirection | undefined;

    return direction || 'sendrecv';
  }

  private getForcedAnswerDirection(kind: 'audio' | 'video'): RTCRtpTransceiverDirection | null {
    if (!this.hasLiveLocalTrack(kind)) return null;

    const remoteDirection = this.getRemoteOfferDirection(kind) || 'sendrecv';
    
    // If a bidirectional video upgrade is intended, we must force sendrecv 
    // even if the remote offer temporarily came in as recvonly.
    if (kind === 'video' && this.isVideo) {
      return 'sendrecv';
    }

    if (remoteDirection === 'sendrecv') return 'sendrecv';
    if (remoteDirection === 'recvonly') return 'sendrecv'; // Force bidirectional instead of unidirectional
    return null;
  }

  private forceAnswerMediaDirections(description: RTCSessionDescriptionInit): RTCSessionDescriptionInit {
    if (description.type !== 'answer' || !description.sdp) {
      return description;
    }

    const eol = this.getSdpLineSeparator(description.sdp);
    const sections = description.sdp.split(`${eol}m=`);
    const sessionSection = sections[0];
    let changed = false;

    const mediaSections = sections.slice(1).map(section => {
      const mediaSection = `m=${section}`;
      const kind: 'audio' | 'video' | null = mediaSection.startsWith('m=audio ')
        ? 'audio'
        : mediaSection.startsWith('m=video ')
          ? 'video'
          : null;

      if (!kind) return mediaSection;

      const lines = mediaSection.split(eol);
      const mLineParts = lines[0].trim().split(/\s+/);
      if (mLineParts[1] === '0') return mediaSection;

      const forcedDirection = this.getForcedAnswerDirection(kind);
      if (!forcedDirection) return mediaSection;
      let sectionChanged = false;

      const directionIndex = lines.findIndex(line =>
        line === 'a=sendrecv' ||
        line === 'a=sendonly' ||
        line === 'a=recvonly' ||
        line === 'a=inactive'
      );

      if (directionIndex >= 0) {
        if (lines[directionIndex] !== `a=${forcedDirection}`) {
          lines[directionIndex] = `a=${forcedDirection}`;
          sectionChanged = true;
        }
      } else {
        lines.push(`a=${forcedDirection}`);
        sectionChanged = true;
      }

      if (sectionChanged) {
        changed = true;
        console.log(`[WebRTC] Forced local ${kind} answer direction to ${forcedDirection}`);
      }

      return lines.join(eol);
    });

    if (!changed) {
      return description;
    }

    return this.withSdp(
      description,
      [sessionSection, ...mediaSections.map(section => section.replace(/^m=/, ''))].join(`${eol}m=`),
    );
  }

  private capAndroidVideoFramerateLines(lines: string[]): { lines: string[]; changed: boolean } {
    let changed = false;
    let hasFramerateLine = false;

    const cappedLines = lines.map(line => {
      const framerate = line.match(/^a=framerate:(\d+(?:\.\d+)?)/i);
      if (framerate) {
        hasFramerateLine = true;
        const value = Number(framerate[1]);
        if (!Number.isFinite(value) || value > ANDROID_SAFE_MAX_VIDEO_FRAMERATE) {
          changed = true;
          return `a=framerate:${ANDROID_SAFE_MAX_VIDEO_FRAMERATE}`;
        }
        return line;
      }

      let nextLine = line.replace(
        /(x-google-max-framerate=)\d+/gi,
        `$1${ANDROID_SAFE_MAX_VIDEO_FRAMERATE}`,
      );
      nextLine = nextLine.replace(
        /(\bmax-fr=)\d+/gi,
        `$1${ANDROID_SAFE_MAX_VIDEO_FRAMERATE}`,
      );
      if (nextLine !== line) {
        changed = true;
      }
      return nextLine;
    });

    if (!hasFramerateLine) {
      const insertIndex = cappedLines[cappedLines.length - 1] === ''
        ? cappedLines.length - 1
        : cappedLines.length;
      cappedLines.splice(insertIndex, 0, `a=framerate:${ANDROID_SAFE_MAX_VIDEO_FRAMERATE}`);
      changed = true;
    }

    return { lines: cappedLines, changed };
  }

  private forceAndroidH264Sdp(description: RTCSessionDescriptionInit): RTCSessionDescriptionInit {
    if (!this.isAndroidRuntime() || !description.sdp) {
      return description;
    }

    const eol = this.getSdpLineSeparator(description.sdp);
    const sections = description.sdp.split(`${eol}m=`);
    const sessionSection = sections[0];
    let changed = false;

    const mediaSections = sections.slice(1).map(section => {
      const mediaSection = `m=${section}`;
      if (!mediaSection.startsWith('m=video ')) {
        return mediaSection;
      }

      const lines = mediaSection.split(eol);
      const mLineParts = lines[0].trim().split(/\s+/);
      if (mLineParts[1] === '0') {
        return mediaSection;
      }

      const payloadTypes = mLineParts.slice(3);
      const codecByPayload = new Map<string, string>();
      const fmtpByPayload = new Map<string, string>();
      const rtxAptByPayload = new Map<string, string>();
      let filteredLines = lines;
      let sectionChanged = false;

      for (const line of lines) {
        const rtpmap = line.match(/^a=rtpmap:(\d+)\s+([^/\s]+)/i);
        if (rtpmap) {
          codecByPayload.set(rtpmap[1], rtpmap[2].toLowerCase());
        }

        const fmtp = line.match(/^a=fmtp:(\d+)\s+(.+)$/i);
        if (fmtp) {
          fmtpByPayload.set(fmtp[1], fmtp[2]);
          const apt = fmtp[2].match(/(?:^|[;\s])apt=(\d+)(?:$|[;\s])/i);
          if (apt) {
            rtxAptByPayload.set(fmtp[1], apt[1]);
          }
        }
      }

      const h264Payloads = payloadTypes.filter(payload => codecByPayload.get(payload) === 'h264');
      if (!h264Payloads.length) {
        console.warn('[WebRTC] Android H264 SDP filter skipped: remote SDP has no H264 payload');
      } else {
        const preferredH264Payloads = h264Payloads.filter(payload =>
          this.isAndroidPreferredH264Fmtp(fmtpByPayload.get(payload)),
        );
        const selectedH264Payloads = preferredH264Payloads.length ? preferredH264Payloads : h264Payloads;
        const keepPayloads = new Set(selectedH264Payloads);
        for (const [rtxPayload, aptPayload] of rtxAptByPayload.entries()) {
          if (keepPayloads.has(aptPayload) && codecByPayload.get(rtxPayload) === 'rtx') {
            keepPayloads.add(rtxPayload);
          }
        }

        const keptPayloads = payloadTypes.filter(payload => keepPayloads.has(payload));
        if (keptPayloads.length !== payloadTypes.length) {
          sectionChanged = true;
          filteredLines = lines.filter((line, index) => {
            if (index === 0) return true;

            const payloadMatch = line.match(/^a=(?:rtpmap|fmtp|rtcp-fb):(\d+|\*)/i);
            if (!payloadMatch) return true;
            if (payloadMatch[1] === '*') return true;

            return keepPayloads.has(payloadMatch[1]);
          });

          filteredLines[0] = [...mLineParts.slice(0, 3), ...keptPayloads].join(' ');
          console.log(
            `[WebRTC] Android SDP codec filter: H264-only video ` +
            `(${selectedH264Payloads.length} H264 payload(s), ${keptPayloads.length}/${payloadTypes.length} total kept)`,
          );
        }
      }

      const capped = this.capAndroidVideoFramerateLines(filteredLines);
      if (capped.changed) {
        sectionChanged = true;
        console.log(`[WebRTC] Android SDP video framerate capped at ${ANDROID_SAFE_MAX_VIDEO_FRAMERATE}fps`);
      }

      changed = changed || sectionChanged;
      return capped.lines.join(eol);
    });

    if (!changed) {
      return description;
    }

    return this.withSdp(
      description,
      [sessionSection, ...mediaSections.map(section => section.replace(/^m=/, ''))].join(`${eol}m=`),
    );
  }

  private isAndroidPreferredH264Fmtp(fmtpLine: string | undefined): boolean {
    if (!fmtpLine) return true;

    const lower = fmtpLine.toLowerCase();
    const packetizationMode = lower.match(/(?:^|[;\s])packetization-mode=(\d+)/)?.[1];
    if (packetizationMode && packetizationMode !== '1') {
      return false;
    }

    const profileLevelId = lower.match(/(?:^|[;\s])profile-level-id=([0-9a-f]+)/)?.[1];
    if (!profileLevelId) return true;

    // Prefer constrained baseline / baseline / main profile for Android hardware encoders.
    return profileLevelId.startsWith('42') || profileLevelId.startsWith('4d');
  }

  private prepareAndroidRemoteDescription<T extends RTCSessionDescriptionInit>(
    description: T,
    label: string,
  ): RTCSessionDescriptionInit {
    const prepared = this.forceAndroidH264Sdp(description);
    if (prepared.sdp && prepared.sdp !== description.sdp) {
      logSdpSummary(`[${this.instanceId}] ${label} (android H264-filtered)`, prepared);
    }
    return prepared;
  }

  private async setAndReturnLocalDescription<T extends RTCSessionDescriptionInit>(
    description: T,
    label: string,
  ): Promise<RTCSessionDescriptionInit> {
    await this.applyAndroidVideoSenderCaps(`before ${label}`);
    const prepared = this.forceAndroidH264Sdp(this.forceAnswerMediaDirections(description));
    
    if (prepared.sdp) {
      let sdp = prepared.sdp;
      if (!sdp.includes("b=AS:2500")) {
        sdp = sdp.replace(/(m=video .*?\r\n)/g, "$1b=AS:2500\r\n");
      }
      if (!sdp.includes("b=AS:128")) {
        sdp = sdp.replace(/(m=audio .*?\r\n)/g, "$1b=AS:128\r\n");
      }
      if (!sdp.includes("usedtx=1")) {
        sdp = sdp.replace(/useinbandfec=1/g, "useinbandfec=1;usedtx=1");
      }
      prepared.sdp = sdp;
    }

    logSdpSummary(`[${this.instanceId}] ${label}`, prepared);
    await this.pc!.setLocalDescription(prepared);
    return prepared;
  }

  private isAndroidRuntime(): boolean {
    return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  }

  private getTargetMaxFramerate(): number {
    if (this.networkQuality === 'HOSTILE') {
      return 15;
    }

    if (this.networkQuality === 'MODERATE') {
      return this.isAndroidRuntime() ? 20 : 24;
    }

    return this.isAndroidRuntime() ? 24 : 30;
  }

  private getInitialVideoTier(): VideoTier {
    if (this.networkQuality === 'HOSTILE') {
      return '240p';
    }

    if (this.networkQuality === 'MODERATE') {
      return this.isAndroidRuntime() ? '360p' : '480p';
    }

    return this.isAndroidRuntime() ? '480p' : '720p';
  }

  private getMaxVideoTier(): VideoTier {
    if (this.networkQuality === 'HOSTILE') {
      return '360p';
    }

    if (this.networkQuality === 'MODERATE') {
      return this.isAndroidRuntime() ? '480p' : '720p';
    }

    return this.isAndroidRuntime() ? '720p' : '1080p';
  }

  private lowerVideoTier(left: VideoTier, right: VideoTier): VideoTier {
    const order: VideoTier[] = ['240p', '360p', '480p', '720p', '1080p', '1440p', '4k'];
    return order.indexOf(left) <= order.indexOf(right) ? left : right;
  }

  private getVideoCaptureProfiles(
    targetFacing: 'user' | 'environment' = 'user',
  ): Array<{ label: string; constraints: MediaTrackConstraints }> {
    const baseConstraints = { facingMode: targetFacing };
    const androidConstraints = this.isAndroidRuntime() ? { resizeMode: 'none' as any } : {};

    if (this.networkQuality === 'HOSTILE') {
      return [
        {
          label: '360p@20fps',
          constraints: { ...baseConstraints, ...androidConstraints, width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 20, max: 24 } },
        },
        {
          label: '240p@15fps',
          constraints: { ...baseConstraints, ...androidConstraints, width: { ideal: 426 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 20 } },
        },
      ];
    }

    if (this.networkQuality === 'MODERATE') {
      return [
        {
          label: '720p@30fps',
          constraints: { ...baseConstraints, ...androidConstraints, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
        },
        {
          label: '480p@24fps',
          constraints: { ...baseConstraints, ...androidConstraints, width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
        },
      ];
    }

    // Default (Excellent network or standard fallback)
    // FaceTime-like quality: 1080p or 720p at 30-60fps
    return [
      {
        label: '1080p@60fps (FaceTime Quality)',
        constraints: {
          ...baseConstraints,
          ...androidConstraints,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: this.isAndroidRuntime() ? 30 : 60, max: 60 },
        },
      },
      {
        label: '720p@30fps',
        constraints: {
          ...baseConstraints,
          ...androidConstraints,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 60 },
        },
      },
    ];
  }

  on(event: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);

    if (event === 'localStream' && this.localStream) {
      setTimeout(() => handler(this.localStream), 0);
    } else if (event === 'remoteStream' && this.remoteStream.getTracks().length > 0) {
      setTimeout(() => handler(this.remoteStream), 0);
    } else if (event === 'connected' && this.callState === 'connected') {
      setTimeout(() => handler(), 0);
    }

    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler) {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;
    const nextHandlers = handlers.filter(h => h !== handler);
    if (nextHandlers.length) {
      this.eventHandlers.set(event, nextHandlers);
    } else {
      this.eventHandlers.delete(event);
    }
  }

  detachPresentationHandlers() {
    this.eventHandlers.clear();
    if (this.shouldDisposeDetachedInstance()) {
      console.warn(`[WebRTC] Detached call ${this.callId.slice(0, 8)} has no active native connection; disposing stale peer connection`);
      this.callState = 'ended';
      activeCallInstances.delete(this.callId);
      creationLocks.delete(this.callId);
      void this.cleanup().catch(error => {
        console.warn('[WebRTC] Detached stale cleanup failed:', error);
      });
    }
  }

  private emit(event: string, ...args: unknown[]) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }

  private shouldDisposeDetachedInstance(): boolean {
    if (this.explicitEnding || this.callState === 'ended') return false;
    if (typeof window === 'undefined') return false;

    try {
      const hasActiveConnection = window.ChatrCall?.hasActiveConnection;
      if (typeof hasActiveConnection !== 'function') return false;
      return hasActiveConnection() === false;
    } catch (error) {
      console.warn('[WebRTC] Unable to query native call state while detaching handlers:', error);
      return false;
    }
  }

  private getOfferFingerprint(description: RTCSessionDescriptionInit | unknown): string {
    const sdp = typeof description === 'object' && description !== null && 'sdp' in description
      ? String((description as RTCSessionDescriptionInit).sdp || '')
      : '';
    const iceUfrag = sdp.match(/^a=ice-ufrag:(.+)$/m)?.[1] || 'no-ice';
    const mediaLines = sdp
      .split('\r\n')
      .filter(line => line.startsWith('m=') || line === 'a=sendrecv' || line === 'a=sendonly' || line === 'a=recvonly')
      .join('|');
    return `${iceUfrag}:${mediaLines}:${sdp.length}`;
  }

  async start() {
    // Prevent double-start
    if (this.started || this.pc) {
      console.log('⚠️ [WebRTC] Already started, skipping');
      return;
    }
    this.started = true;
    const startTime = Date.now();
    
    try {
      console.log('🚀 [WebRTC] FAST START - targeting <2s connection...');

      // ── PREWARM ADOPTION ────────────────────────────────────────────────────
      // If VoIPPrewarmService booted a background WebView during ringing, inherit
      // its already-warmed media tracks and pre-gathered ICE candidates.
      // This skips: getUserMedia cold-start (~400ms) + ICE first-candidate (~300ms)
      const prewarm = transferPrewarmState(this.callId);
      if (prewarm) {
        const age = Date.now() - prewarm.startedAt;
        console.log(`⚡ [WebRTC] Adopting prewarm (age=${age}ms mediaReady=${prewarm.mediaReady} iceStarted=${prewarm.iceGatheringStarted})`);

        if (prewarm.mediaReady && prewarm.localStream) {
          this.localStream = prewarm.localStream;
          this.emit('localStream', this.localStream);
        }

        // Adopt the pre-created PC only if ICE is still fresh (< 30 s).
        // Beyond that the ICE credentials may have expired.
        if (prewarm.pc && prewarm.iceGatheringStarted && age < 30_000) {
          this.pc = prewarm.pc;
          this.diagnosticsCleanup = startWebRTCDiagnostics(this.pc, {
            callId:     this.callId,
            instanceId: this.instanceId,
            isVideo:    () => this.isVideo,
            emit:       (event, payload) => this.emit(event, payload),
          });
          console.log('⚡ [WebRTC] Adopted pre-warmed RTCPeerConnection — skipping cold PCE init');

          // Re-attach any new tracks to the inherited PC
          if (this.localStream) {
            await this.ensureVideoTrackForVideoCall('prewarm adopt');
            await this.attachLocalStreamTracks(this.localStream, 'prewarm adopt');
            if (this.isAndroidRuntime() && this.isVideo) {
              this.preferAndroidH264Codec();
            }
          }
        }
      }
      // ── END PREWARM ADOPTION ────────────────────────────────────────────────

      // Unblock setup: Create peer connection and transceivers immediately
      if (!this.pc) {
        await this.createPeerConnection();
      }

      // Pre-create transceivers so SDP contains stable media lines before negotiation
      this.ensureMediaTransceivers();

      // Launch media acquisition completely in the background (NON-BLOCKING)
      const backgroundMediaPromise = (async () => {
        if (!this.localStream) {
          try {
            await this.acquireMedia();
            if (this.localStream && this.pc) {
              await this.ensureVideoTrackForVideoCall('background media attach');
              await this.attachLocalStreamTracks(this.localStream, 'background media attach');
              if (this.isAndroidRuntime() && this.isVideo) {
                this.preferAndroidH264Codec();
              }
            }
          } catch (mediaError) {
            console.warn('⚠️ [WebRTC] Background media acquisition failed:', mediaError);
          }
        } else {
          this.emit('localStream', this.localStream);
          if (this.pc) {
            await this.attachLocalStreamTracks(this.localStream, 'pre-acquired media attach');
            if (this.isAndroidRuntime() && this.isVideo) {
              this.preferAndroidH264Codec();
            }
          }
        }
      })();
      // Intentionally NOT awaiting backgroundMediaPromise to achieve sub-200ms connection!

      // Avoid passthrough encoded transforms on Android WebView; they add
      // worker overhead and can push low-end devices into software codec paths.
      if (this.shouldUseInsertableStreams()) {
        this.insertableStreams = getInsertableStreamsManager();
        this.insertableStreams.initialize();
      } else {
        console.log('[WebRTC] Insertable Streams disabled for Android/WebView performance');
      }

      // Initialize signaling after the media graph is stable.
      console.log('⏳ [WebRTC] Waiting for media tracks to attach...');
      await backgroundMediaPromise;
      
      this.signalingManager = new HybridSignalingManager();
      const signalingType = await this.signalingManager.initialize(
        null,
        this.userId,
        this.callId,
        (msg: SignalMessage) => this.handleSignal({ type: msg.type as SignalType, data: msg.data, from: msg.from })
      );

      console.log(`🔌 [WebRTC] Signaling initialized: ${signalingType}`);
      this.subscribeToSignals();

      // Fetch past signals (for late joiners) with retry for race condition
      await this.fetchPastSignals();
      
      // RECEIVER: If no offer found/processed, retry (race condition with INSERT)
      // Check if remote description was set (means offer was processed)
      // RECEIVER: If no offer found/processed, wait using a high-performance 50ms dynamic loop.
      // The instant the offer is received via Socket.IO or Supabase, the loop exits immediately.
      if (!this.isInitiator && !this.pc?.remoteDescription) {
        console.log('🔄 [WebRTC] Receiver: No offer processed yet, starting high-performance polling loop...');
        const maxWaitMs = 3000;
        const loopStartTime = Date.now();
        while (!this.pc?.remoteDescription && Date.now() - loopStartTime < maxWaitMs) {
          await this.delay(50);
          // Periodically fetch past signals from database as a backup/fallback every 500ms
          if (Math.floor((Date.now() - loopStartTime) / 500) > Math.floor((Date.now() - loopStartTime - 50) / 500)) {
            await this.fetchPastSignals();
          }
        }
      }

      // Create offer IMMEDIATELY (no delay - receiver subscription is already active)
      if (this.isInitiator && !this.offerSent) {
        await this.createAndSendOffer();
      }

      // Set connection timeout
      this.startConnectionTimeout();

      console.log(`✅ [WebRTC] Setup complete in ${Date.now() - startTime}ms`);
    } catch (error: unknown) {
      console.error('❌ [WebRTC] Setup failed:', error);
      this.callState = 'failed';
      this.emit('failed', error);
      throw error;
    }
  }

  private async acquireMedia() {
    const startTime = Date.now();

    try {
      // Phase 4 — Warm Mic: try pre-warmed stream first (VoIPPrewarmService acquired mic before answer)
      const prewarm = consumePrewarmStream();
      if (prewarm) {
        this.localStream = prewarm;
        await this.ensureVideoTrackForVideoCall('prewarmed stream top-up');
        console.log(`[WebRTC] Using pre-warmed media stream: ${this.describeStream(this.localStream)}`);
        this.emit('localStream', prewarm);
        console.log('🎙️ [WebRTC] ✅ Using pre-warmed mic stream — zero getUserMedia latency');
        return;
      }

      // Release existing streams first
      if (this.localStream) {
        this.localStream.getTracks().forEach(t => t.stop());
        this.localStream = null;
        await this.delay(100);
      }

      const audioConstraints = this.buildAudioConstraints();

      console.log('🎬 [WebRTC] Requesting network-adaptive media with AUTO NOISE CANCELLATION...');

      const videoProfiles = this.isVideo ? this.getVideoCaptureProfiles('user') : [];
      
      let acquired = false;
      
      for (const profile of videoProfiles) {
        if (acquired) break;
        try {
          const profileConstraints: MediaStreamConstraints = {
            audio: audioConstraints,
            video: profile.constraints
          };
          this.localStream = await navigator.mediaDevices.getUserMedia(profileConstraints);
          const videoTrack = this.localStream.getVideoTracks()[0];
          if (videoTrack) {
            const settings = videoTrack.getSettings();
            console.log(`✅ [WebRTC] Video acquired: ${settings.width}x${settings.height}@${settings.frameRate}fps (${profile.label}) in ${Date.now() - startTime}ms`);
          }
          acquired = true;
        } catch (e) {
          console.log(`⚠️ [WebRTC] ${profile.label} failed, trying lower...`);
        }
      }
      
      // Final fallback: audio only or basic video
      if (!acquired) {
        if (this.isVideo) {
          try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
              audio: audioConstraints, 
              video: { facingMode: 'user' } 
            });
            console.log(`✅ [WebRTC] Basic video acquired in ${Date.now() - startTime}ms`);
          } catch (basicVideoError) {
            // Audio only fallback
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
              audio: audioConstraints, 
              video: false 
            });
            console.log(`✅ [WebRTC] Audio-only fallback in ${Date.now() - startTime}ms`);
          }
        } else {
          this.localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: audioConstraints, 
            video: false 
          });
          console.log(`✅ [WebRTC] Audio acquired in ${Date.now() - startTime}ms`);
        }
      }
      
      this.emit('localStream', this.localStream);
    } catch (error: unknown) {
      const mediaError = error instanceof Error ? error : new Error('Unknown media error');
      console.error('❌ [WebRTC] Media failed:', mediaError.name, mediaError.message);
      
      // Try audio-only fallback for video calls
      if (this.isVideo && mediaError.name !== 'NotAllowedError') {
        try {
          console.log('⚠️ [WebRTC] Trying audio-only fallback...');
          this.localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
              echoCancellation: true, 
              noiseSuppression: true, 
              autoGainControl: true,
              // @ts-expect-error - Chrome audio constraint
              googNoiseSuppression: true,
              // @ts-expect-error - Chrome audio constraint
              googHighpassFilter: true,
            },
            video: false,
          });
          this.emit('localStream', this.localStream);
          console.log(`[WebRTC] Audio-only fallback acquired in ${Date.now() - startTime}ms`);
          return;
        } catch (fallbackError) {
          console.error('[WebRTC] Audio-only fallback failed:', fallbackError);
        }
      }

      throw mediaError;
    }
  }

  private async createPeerConnection() {
    // Detect Android WebView
    const isAndroid = this.isAndroidRuntime();
    const activePreset = this.callPreset || getCallPreset(this.networkQuality, this.isVideo);
    const baseConfig = getWebRTCConfig(activePreset);
    let iceServers = activePreset.iceServers;

    const cachedTurn = TurnCache.get();
    if (cachedTurn) {
      iceServers = cachedTurn;
      console.log('⚡ [WebRTC] Using cached TURN credentials');
    } else {
      try {
        iceServers = await getTurnConfig();
        TurnCache.set(iceServers);
      } catch (error) {
        console.warn('[WebRTC] Falling back to preset STUN-only ICE configuration:', error);
      }
    }

    // ULTRA-FAST: Minimal ICE config for <2s connections
    const config: RTCConfiguration = {
      ...baseConfig,
      iceServers,
      iceCandidatePoolSize: Math.max(
        2,
        Math.min(activePreset.iceCandidatePoolSize, isAndroid ? 20 : 30),
      ),
    };

    console.log(`🔧 [WebRTC] Creating FAST peer connection (Android: ${isAndroid})`);
    this.pc = new RTCPeerConnection(config);
    this.pc.createDataChannel('chatr_signaling_fast_connect');
    this.ensureMediaTransceivers();
    this.diagnosticsCleanup = startWebRTCDiagnostics(this.pc, {
      callId: this.callId,
      instanceId: this.instanceId,
      isVideo: () => this.isVideo,
      emit: (event, payload) => this.emit(event, payload),
    });

    this.pc.onnegotiationneeded = async () => {
      console.log('🔄 [WebRTC] Negotiation needed fired (signalingState: ' + this.pc?.signalingState + ')');
      if (this.pc?.signalingState !== 'stable') {
        return; // Will fire again when state becomes stable if tracks were added mid-negotiation
      }
      if (this.callState === 'connected') {
        try {
          this.offerSent = false;
          await this.createAndSendOffer();
        } catch (err) {
          console.error('🔄 [WebRTC] Renegotiation failed:', err);
        }
      }
    };

    // Phase 7 -- ICE Candidate Filter: drop VPN/virtual/loopback before signaling
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        if (!shouldKeepCandidate(event.candidate, { dropVPN: true, dropVirtual: true })) { return; }
        const signalData = {
          type: 'ice-candidate',
          data: event.candidate.toJSON(),
          from: this.userId,
          callId: this.callId,
          targetId: this.partnerId
        };
        if (socketService.isConnected) { socketService.emit('call-candidate', signalData); }
        this.sendSignal(signalData);
      } else {
        console.log('[WebRTC] ICE gathering complete');
      }
    };

    this.pc.onicegatheringstatechange = () => {
      console.log('[WebRTC] ICE gathering state:', this.pc?.iceGatheringState);
    };

    this.pc.ontrack = (event) => {
      const track = event.track;
      const stream = this.addRemoteTrackToAggregate(track, event.streams[0]);
      console.log(
        `[WebRTC] Remote track received: ${track.kind}, id: ${track.id.slice(0,8)} ` +
        `aggregate=${this.describeStream(stream)}`,
      );

      this.emit('remoteStream', stream);
      
      if (track.kind === 'video') {
        this.emit('remoteVideoTrack', { track, stream });
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc!.connectionState;
      console.log('[WebRTC] Connection state:', state);
      if (state === 'connected') {
        this.handleConnected();
      } else if (state === 'disconnected') {
        this.handleTransientDisconnect('peer-connection-disconnected');
      } else if (state === 'failed') {
        this.handleConnectionFailed('peer-connection-failed');
      } else if (state === 'closed') {
        if (this.explicitEnding && this.callState === 'connected') {
          this.emit('ended');
        } else if (!this.explicitEnding) {
          console.warn('[WebRTC] Peer connection closed without explicit end; preserving session ownership');
        }
      }
    };

    const toleranceMs = this.callPreset?.iceDisconnectToleranceMs || 8000;
    const maxAttempts = this.callPreset?.maxReconnectAttempts || 3;

    this.iceMonitor = createICEMonitor(this.pc, {
      disconnectToleranceMs: toleranceMs,
      maxReconnectAttempts: maxAttempts,
      onRecoveryStart: () => { this.emit('recoveryStatus', { message: 'Reconnecting...' }); },
      onRecoverySuccess: () => {
        console.log('[WebRTC] Recovery successful');
        this.emit('recoveryStatus', { message: null });
      },
      onRecoveryFailed: () => {
        console.log('[WebRTC] Recovery failed after max attempts');
        this.handleConnectionFailed('ice-monitor-recovery-exhausted');
      },
      onQualityChange: (quality) => { this.emit('networkQuality', quality); }
    });

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc!.iceConnectionState;
      console.log('[WebRTC] ICE connection state:', state);
      if (state === 'connected' || state === 'completed') {
        this.handleConnected();
      } else if (state === 'disconnected') {
        this.handleTransientDisconnect('ice-disconnected');
      } else if (state === 'failed') {
        this.handleConnectionFailed('ice-failed');
      }
    };

    console.log('[WebRTC] Peer connection created, toleranceMs=' + toleranceMs);
    await this.flushBufferedSignals();
  }

  private async flushBufferedSignals() {
    if (!this.pc || this.bufferedSignals.length === 0) return;

    const buffered = [...this.bufferedSignals];
    this.bufferedSignals = [];

    const orderedSignals = [
      ...buffered.filter(signal => signal.type === 'offer'),
      ...buffered.filter(signal => signal.type === 'answer'),
      ...buffered.filter(signal => signal.type === 'ice-candidate'),
      ...buffered.filter(signal =>
        signal.type !== 'offer' &&
        signal.type !== 'answer' &&
        signal.type !== 'ice-candidate'
      ),
    ];

    console.log(`[WebRTC] Flushing ${orderedSignals.length} buffered signals`);

    for (const signal of orderedSignals) {
      await this.handleSignal(signal);
    }
  }


  private handleConnected() {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    this.mediaSessionAuthoritative = true;
    this.lastConnectedAt = Date.now();
    this.recoveryAttempts = 0;
    
    // Background Continuity: Enforce MediaSession active lock
    this.setupMediaSession();
    void this.forceOutboundAudioSender('connected').catch(error => {
      console.warn('[WebRTC] Connected audio sender repair failed:', error);
    });
    this.startOutboundAudioWatchdog();

    if (this.callState === 'connected') return;
    
    console.log(`🎉 [WebRTC] CONNECTED! [${this.instanceId}]`);
    this.callState = 'connected';
    this.clearConnectionTimeout();
    this.emit('connected');
    this.emit('networkQuality', 'good');
    
    // CRITICAL: Update call status to 'active' in database
    // This ensures UI and native shells know the call is truly connected
    this.updateCallToActive();
    
    // ADAPTIVE BITRATE ENGINE: Start smart quality scaling with sane mobile ceilings.
    // CRITICAL: Serialize - apply initial bitrate FIRST, then start ABR engine AFTER
    if (this.pc && this.isVideo && !this.abrEngine) {
      this.applyAdaptiveVideoBitrate().then(() => {
        // Only start ABR engine AFTER initial bitrate is applied (prevents setParameters race)
        return detectDeviceCapabilities();
      }).then(caps => {
        if (!this.pc) return;
        const deviceMaxTier: VideoTier =
          caps.maxCameraHeight >= 1080 ? '1080p' :
          caps.maxCameraHeight >= 720 ? '720p' :
          caps.maxCameraHeight >= 480 ? '480p' :
          caps.maxCameraHeight >= 360 ? '360p' :
          '240p';
        const maxTier = this.lowerVideoTier(deviceMaxTier, this.getMaxVideoTier());
        const initialTier = this.lowerVideoTier(this.getInitialVideoTier(), maxTier);
        this.abrEngine = new AdaptiveBitrateEngine(this.pc, {
          maxTier,
          initialTier,
          callId: this.callId,
          userId: this.userId,
          maxFps: this.isAndroidRuntime() ? ANDROID_SAFE_MAX_VIDEO_FRAMERATE : undefined,
          onTierChange: (tier, reason) => {
            this.emit('tierChange', { tier, reason });
          },
        });
        this.abrEngine.start();
        console.log(`📊 [WebRTC] ABR engine started (max: ${maxTier})`);
      }).catch((e) => {
        console.warn('⚠️ [WebRTC] ABR setup error (non-fatal):', e);
      });
    }
    
    // India-first: Apply bitrate limits based on preset (only for hostile networks)
    if (this.pc && this.callPreset && this.networkQuality === 'HOSTILE') {
      applyBitrateLimits(this.pc, this.callPreset).then(() => {
        console.log(`🇮🇳 [WebRTC] Applied ${this.callPreset?.name} bitrate limits`);
      }).catch(e => {
        console.warn('⚠️ [WebRTC] Failed to apply bitrate limits:', e);
      });
    }
  }
  
  /**
   * Apply ADAPTIVE video bitrate for stability from 10kbps to 2Gbps
   * Priority: STABILITY over quality - smooth video at any bandwidth
   */
  private async applyAdaptiveVideoBitrate() {
    if (!this.pc) return;
    
    try {
      const videoSender = this.pc.getSenders().find(s => s.track?.kind === 'video');
      if (!videoSender) return;
      
      // CRITICAL: getParameters() MUST be called before setParameters()
      // This initializes the sender's internal transaction state
      const params = videoSender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      
      const preset = this.callPreset || getCallPreset(this.networkQuality, this.isVideo);
      const maxBitrate = Math.max(120_000, preset.maxVideoBitrate * 1000);
      const maxFramerate = this.getTargetMaxFramerate();

      // STABILITY-FIRST: stay inside the current preset instead of pushing 4K/60.
      params.encodings = params.encodings.map(encoding => ({
        ...encoding,
        maxBitrate: typeof encoding.maxBitrate === 'number'
          ? Math.min(encoding.maxBitrate, maxBitrate)
          : maxBitrate,
        maxFramerate,
      }));
      
      // @ts-expect-error - scaleResolutionDownBy allows dynamic scaling
      params.encodings[0].scaleResolutionDownBy = 1;
      
      // @ts-expect-error - Priority hints for stability
      params.encodings[0].priority = 'high';
      // @ts-expect-error - Chromium network priority hint
      params.encodings[0].networkPriority = 'high';
      
      // Enable degradation preference for maintaining framerate over resolution
      const track = videoSender.track;
      if (track) {
        try {
          await track.applyConstraints({
            // @ts-expect-error - degradationPreference is experimental
            degradationPreference: 'maintain-framerate',
          });
        } catch (e) {
          // Ignore if not supported
        }
      }
      
      await videoSender.setParameters(params);
      console.log(`🎬 [WebRTC] Applied adaptive bitrate cap: ${Math.round(maxBitrate / 1000)}kbps @ ${maxFramerate}fps`);
      
      // Start continuous quality monitoring for adaptive adjustment
      this.startAdaptiveBitrateMonitor();
    } catch (e) {
      console.warn('⚠️ [WebRTC] Could not apply adaptive bitrate:', e);
    }
  }
  
  private adaptiveMonitorInterval: NodeJS.Timeout | null = null;
  
  /**
   * Monitor connection quality and adapt bitrate for stability
   */
  private startAdaptiveBitrateMonitor() {
    // Clear existing monitor
    if (this.adaptiveMonitorInterval) {
      clearInterval(this.adaptiveMonitorInterval);
    }
    
    let lastBytesReceived = 0;
    let lastTimestamp = Date.now();
    
    this.adaptiveMonitorInterval = setInterval(async () => {
      if (!this.pc || this.callState !== 'connected') {
        if (this.adaptiveMonitorInterval) {
          clearInterval(this.adaptiveMonitorInterval);
          this.adaptiveMonitorInterval = null;
        }
        return;
      }
      
      try {
        const stats = await this.pc.getStats();
        let packetLoss = 0;
        let rtt = 0;
        let currentBitrate = 0;
        
        stats.forEach(report => {
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            const packetsLost = report.packetsLost || 0;
            const packetsSent = report.packetsSent || 0;
            packetLoss = packetsSent > 0 ? (packetsLost / packetsSent) * 100 : 0;
            
            // Calculate current outbound bitrate
            if (report.bytesSent && report.timestamp) {
              const now = Date.now();
              const bytesDelta = report.bytesSent - lastBytesReceived;
              const timeDelta = (now - lastTimestamp) / 1000;
              if (timeDelta > 0) {
                currentBitrate = (bytesDelta * 8) / timeDelta / 1000; // kbps
              }
              lastBytesReceived = report.bytesSent;
              lastTimestamp = now;
            }
          }
          
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            rtt = (report.currentRoundTripTime || 0) * 1000;
          }
        });
        
        // Emit quality for UI updates (without noisy logs)
        if (packetLoss > 10 || rtt > 500) {
          this.emit('networkQuality', 'poor');
        } else if (packetLoss > 3 || rtt > 200) {
          this.emit('networkQuality', 'good');
        } else {
          this.emit('networkQuality', 'excellent');
        }
      } catch (e) {
        // Ignore stats errors
      }
    }, 3000); // Check every 3 seconds
  }
  
  /**
   * Setup HTML5 MediaSession to lock background thread execution and bind lockscreen buttons.
   */
  private setupMediaSession() {
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
    
    console.log('🎵 [WebRTC] Configuring HTML5 MediaSession for background continuity');
    
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Chatr Call with ${this.partnerId.slice(0, 8)}`,
        artist: this.isVideo ? 'ChatrPlus Video Call' : 'ChatrPlus Audio Call',
        album: 'ChatrOS Secure VoIP',
        artwork: [
          { src: '/logo.png', sizes: '512x512', type: 'image/png' }
        ]
      });
      
      navigator.mediaSession.playbackState = 'playing';
      
      navigator.mediaSession.setActionHandler('hangup', () => {
        console.log('🎵 [MediaSession] Lockscreen Hangup clicked');
        this.end();
      });
      
      navigator.mediaSession.setActionHandler('mute', () => {
        console.log('🎵 [MediaSession] Lockscreen Mute clicked');
        this.toggleAudio(false);
      });
      
      navigator.mediaSession.setActionHandler('unmute', () => {
        console.log('🎵 [MediaSession] Lockscreen Unmute clicked');
        this.toggleAudio(true);
      });
    } catch (e) {
      console.warn('⚠️ [WebRTC] MediaSession setup failed:', e);
    }
  }

  private async updateCallToActive() {
    if (this.activeStatusUpdated || this.activeStatusUpdateInFlight) {
      return;
    }

    this.activeStatusUpdateInFlight = true;
    try {
      const connectedAt = new Date().toISOString();
      const { data: currentCall } = await supabase
        .from('calls')
        .select('started_at')
        .eq('id', this.callId)
        .maybeSingle();

      const { error } = await supabase
        .from('calls')
        .update({ 
          status: 'active', 
          webrtc_state: 'connected',
          ...(currentCall?.started_at ? {} : { started_at: connectedAt })
        })
        .eq('id', this.callId);
      
      if (error) {
        console.warn('⚠️ [WebRTC] Failed to update call to active:', error);
      } else {
        this.activeStatusUpdated = true;
        console.log('✅ [WebRTC] Call status updated to active');
      }
    } catch (e) {
      console.warn('⚠️ [WebRTC] Error updating call status:', e);
    } finally {
      this.activeStatusUpdateInFlight = false;
    }
  }

  private handleTransientDisconnect(trigger: string) {
    if (this.callState === 'ended') return;

    console.warn(`[WebRTC] Transient disconnect observed (${trigger})`);

    if (this.mediaSessionAuthoritative || shouldPreserveConnectedSession(this.callState)) {
      this.scheduleConnectedSessionRecovery(trigger);
      return;
    }

    this.emit('recoveryStatus', { message: 'Reconnecting...' });
  }

  private handleConnectionFailed(trigger: string = 'unknown') {
    if (this.callState === 'ended') return;

    if (this.mediaSessionAuthoritative || shouldPreserveConnectedSession(this.callState)) {
      this.scheduleConnectedSessionRecovery(trigger);
      return;
    }
    
    console.warn('⚠️ [WebRTC] Connection failed - attempting recovery...');
    
    // Try ICE restart if we have remote description
    if (this.pc?.remoteDescription && this.isInitiator) {
      this.attemptIceRestart();
    } else {
      this.emit('recoveryStatus', { message: 'Reconnecting...' });
    }
  }

  private scheduleConnectedSessionRecovery(trigger: string) {
    if (!this.pc || this.callState === 'ended') return;

    const pcState = this.pc.connectionState;
    const iceState = this.pc.iceConnectionState;

    if (pcState === 'connected' || iceState === 'connected' || iceState === 'completed') {
      this.handleConnected();
      return;
    }

    if (this.recoveryTimer) {
      console.log(`[WebRTC] Recovery already active; ignoring duplicate trigger: ${trigger}`);
      return;
    }

    this.callState = 'recovering';
    this.recoveryAttempts += 1;
    this.emit('recoveryStatus', { message: 'Reconnecting...' });

    securityService.logEvent({
      eventType: 'call_recovery_start',
      severity: 'info',
      metadata: {
        callId: this.callId,
        trigger,
        attempts: this.recoveryAttempts,
        pcState,
        iceState,
        lastConnectedAt: this.lastConnectedAt,
      }
    });

    this.attemptIceRestart();

    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null;
      if (!this.pc || this.callState === 'ended') return;

      const currentPcState = this.pc.connectionState;
      const currentIceState = this.pc.iceConnectionState;
      const recovered = currentPcState === 'connected'
        || currentIceState === 'connected'
        || currentIceState === 'completed';

      if (recovered) {
        this.handleConnected();
        this.emit('recoveryStatus', { message: null });
        return;
      }

      if (this.recoveryAttempts < this.maxConnectedRecoveryAttempts) {
        console.warn(`[WebRTC] Recovery window expired (${trigger}); retrying without tearing down media`);
        this.scheduleConnectedSessionRecovery(`${trigger}:retry`);
        return;
      }

      console.error(`[WebRTC] Connected media recovery exhausted (${trigger})`);
      this.callState = 'failed';
      this.emit('failed', new Error(`Call recovery exhausted after ${this.recoveryAttempts} attempts`));
    }, this.connectedRecoveryWindowMs);
  }

  private async attemptIceRestart() {
    if (!this.pc || this.callState === 'ended') return;
    
    try {
      console.log('🔄 [WebRTC] ICE restart...');
      this.pc.restartIce();
      if (!this.isInitiator || !this.pc.remoteDescription) {
        return;
      }
      await this.attachAudioForNegotiation('local ICE-restart offer');
      console.log(
        `[WebRTC] ICE-restart offer media ready: stream=${this.describeStream(this.localStream)} ` +
        `senders=${this.describeSenders()}`,
      );
      const offer = await this.pc.createOffer({ iceRestart: true });
      const localOffer = await this.setAndReturnLocalDescription(offer, 'local ICE-restart offer');
      this.emitSocketSignal({ type: 'offer', data: localOffer, from: this.userId });
      await this.sendSignal({ type: 'offer', data: localOffer, from: this.userId });
    } catch (e) {
      console.error('❌ [WebRTC] ICE restart failed:', e);
    }
  }

  /**
   * India-first: Handle network quality changes during call
   */
  private handleNetworkChange(newQuality: NetworkQuality) {
    const oldQuality = this.networkQuality;
    this.networkQuality = newQuality;
    this.callPreset = getCallPreset(newQuality, this.isVideo);
    
    // Only adapt if quality degraded
    if (newQuality === 'HOSTILE' && oldQuality !== 'HOSTILE') {
      console.log('📶 [WebRTC] Network degraded to HOSTILE - reducing quality');
      this.emit('networkQuality', 'poor');
      this.emit('recoveryStatus', { message: 'Weak network - prioritizing audio stability' });
      
      // Apply bitrate limits if connected
      if (this.pc && this.callState === 'connected' && this.callPreset) {
        const survivalPreset = getCallPreset('HOSTILE', this.isVideo);
        applyBitrateLimits(this.pc, survivalPreset).catch(e => 
          console.warn('⚠️ [WebRTC] Failed to apply bitrate limits:', e)
        );
      }
    } else if (newQuality === 'MODERATE' && oldQuality !== 'MODERATE') {
      console.log('ðŸ“¶ [WebRTC] Network shifted to MODERATE');
      this.emit('networkQuality', 'fair');
      if (this.pc && this.callState === 'connected' && this.callPreset) {
        applyBitrateLimits(this.pc, this.callPreset).catch(e =>
          console.warn('âš ï¸ [WebRTC] Failed to apply moderate bitrate limits:', e)
        );
      }
    } else if (newQuality === 'GOOD' && oldQuality !== 'GOOD') {
      console.log('📶 [WebRTC] Network improved to GOOD');
      this.emit('networkQuality', 'excellent');
      this.emit('recoveryStatus', { message: null });
      if (this.pc && this.callState === 'connected' && this.callPreset) {
        applyBitrateLimits(this.pc, this.callPreset).catch(e =>
          console.warn('âš ï¸ [WebRTC] Failed to restore bitrate limits:', e)
        );
      }
    }
  }

  private shouldUseInsertableStreams(): boolean {
    if (this.isAndroidRuntime()) {
      return false;
    }
    return this.isVideo;
  }

  /**
   * Choose an Android-safe codec order. Prefer H264 when exposed because many
   * low-end Android WebViews encode VP8 through software libvpx, which causes
   * frozen-looking video and severe UI jank under load. VP8 remains fallback
   * only when H264 is unavailable.
   */
  private preferAndroidH264Codec() {
    if (!this.pc) return;
    
    const transceivers = this.pc.getTransceivers();
    transceivers.forEach(transceiver => {
      if (transceiver.sender.track?.kind === 'video' || transceiver.receiver.track?.kind === 'video') {
        const senderCodecs = typeof RTCRtpSender !== 'undefined'
          ? RTCRtpSender.getCapabilities?.('video')?.codecs || []
          : [];
        const receiverCodecs = typeof RTCRtpReceiver !== 'undefined'
          ? RTCRtpReceiver.getCapabilities?.('video')?.codecs || []
          : [];
        const codecs = senderCodecs.length ? senderCodecs : receiverCodecs;
        const codecList = codecs.map(c => c.mimeType).join(', ') || 'none';
        
        const h264Codecs = codecs.filter(c => c.mimeType.toLowerCase().includes('h264'));
        const preferredH264Codecs = h264Codecs.filter(c =>
          this.isAndroidPreferredH264Fmtp((c as RTCRtpCodecCapability & { sdpFmtpLine?: string }).sdpFmtpLine),
        );
        const androidH264Codecs = preferredH264Codecs.length ? preferredH264Codecs : h264Codecs;
        const vp8Codecs = codecs.filter(c => c.mimeType.toLowerCase().includes('vp8'));
        const repairCodecs = codecs.filter(c => {
          const mimeType = c.mimeType.toLowerCase();
          return (
            mimeType.includes('rtx') ||
            mimeType.includes('red') ||
            mimeType.includes('ulpfec') ||
            mimeType.includes('flexfec')
          );
        });
        const otherCodecs = codecs.filter(c => {
          const mimeType = c.mimeType.toLowerCase();
          return (
            !mimeType.includes('vp8') &&
            !mimeType.includes('h264') &&
            !mimeType.includes('vp9') &&
            !mimeType.includes('av1') &&
            !mimeType.includes('rtx') &&
            !mimeType.includes('red') &&
            !mimeType.includes('ulpfec') &&
            !mimeType.includes('flexfec')
          );
        });
        const vp9Codecs = codecs.filter(c => c.mimeType.toLowerCase().includes('vp9'));
        
        const orderedCodecs = this.isAndroidRuntime() && h264Codecs.length > 0
          ? [...androidH264Codecs, ...repairCodecs]
          : [...vp8Codecs, ...h264Codecs, ...otherCodecs, ...vp9Codecs, ...repairCodecs];
        
        if (!h264Codecs.length && this.isAndroidRuntime()) {
          console.warn(`[WebRTC] Android H264 unavailable in RTP capabilities. Codecs: ${codecList}`);
        }

        if (!transceiver.setCodecPreferences) {
          console.warn(`[WebRTC] setCodecPreferences unavailable; relying on SDP filter. Codecs: ${codecList}`);
          return;
        }

        if (orderedCodecs.length > 0 && transceiver.setCodecPreferences) {
          try {
            transceiver.setCodecPreferences(orderedCodecs);
            console.log(
              `[WebRTC] Codec preference applied: ${orderedCodecs[0]?.mimeType || 'default'} ` +
              `(androidH264Only=${this.isAndroidRuntime() && h264Codecs.length > 0}, ` +
              `transceiver=${transceiver.direction}/${transceiver.currentDirection || 'new'}, codecs=${codecList})`,
            );
          } catch (e) {
            console.warn('⚠️ [WebRTC] Could not set codec preferences:', e);
          }
        }
      }
    });
  }

  private async fetchPastSignals() {
    console.log('📥 [WebRTC] Fetching past signals...');
    
    try {
      const { data: signals, error } = await supabase
        .from('webrtc_signals')
        .select('*')
        .eq('call_id', this.callId)
        .eq('to_user', this.userId)
        .order('created_at', { ascending: false }); // Get NEWEST first

      if (error) {
        console.error('❌ [WebRTC] Signals query error:', error);
        return;
      }

      console.log(`📥 [WebRTC] Found ${signals?.length || 0} past signals for user ${this.userId.slice(0, 8)}`);

      if (signals?.length) {
        // Log all found signals for debugging
        signals.forEach(s => {
          console.log(`  → ${s.signal_type} from ${s.from_user.slice(0, 8)} (id: ${s.id.slice(0, 8)})`);
        });
        
        // Mark all as processed to prevent duplicates from realtime
        signals.forEach(s => this.processedSignalIds.add(s.id));
        
        if (!this.isInitiator) {
          // RECEIVER: Process ONLY the LATEST offer
          const latestOffer = signals.find(s => s.signal_type === 'offer');
          if (latestOffer) {
            console.log(`📥 [WebRTC] Processing LATEST offer from ${latestOffer.from_user.slice(0, 8)}`);
            await this.handleSignal({ type: 'offer', data: latestOffer.signal_data, from: latestOffer.from_user });
          } else {
            console.log('⚠️ [WebRTC] No offer found in past signals (receiver mode)');
          }
        } else {
          // INITIATOR: Check if receiver already sent an answer
          const latestAnswer = signals.find(s => s.signal_type === 'answer');
          if (latestAnswer) {
            console.log(`📥 [WebRTC] Found answer from ${latestAnswer.from_user.slice(0, 8)}`);
            await this.handleSignal({ type: 'answer', data: latestAnswer.signal_data, from: latestAnswer.from_user });
          }
        }
        
        // Process ICE candidates for both roles (in ascending order for proper sequencing)
        const candidates = signals
          .filter(s => s.signal_type === 'ice-candidate')
          .reverse(); // Reverse to process oldest first
          
        console.log(`📥 [WebRTC] Processing ${candidates.length} ICE candidates`);
        for (const c of candidates) {
          await this.handleSignal({ type: 'ice-candidate', data: c.signal_data, from: c.from_user });
        }
      } else {
        console.log('📥 [WebRTC] No past signals found - waiting for realtime...');
      }
    } catch (error) {
      console.error('❌ [WebRTC] Failed to fetch past signals:', error);
    }
  }

  private subscribeToSignals(): void {
    if (this.signalsSubscribed) {
      console.log('[WebRTC] Signal subscriptions already active; skipping duplicate attach');
      return;
    }
    this.signalsSubscribed = true;

    console.log('📡 [WebRTC] Subscribing to signals (DUAL-PATH: Socket + Supabase)...');
    
    // FAST PATH: Socket.IO listeners are registered before/after connect.
    // SocketService reattaches deferred handlers across reconnects.
    if (socketService.isEnabled) {
      this.socketSignalUnsubscribers.push(socketService.on('call-offer', async (payload: SocketSignalPayload) => {
        if (this.callState === 'ended') return;
        if (payload.callId === this.callId && payload.targetId === this.userId) {
          console.log('? [WebRTC] Signal received via SOCKET: offer');
          await this.handleSignal({ type: 'offer', data: payload.data, from: payload.from });
        }
      }));

      this.socketSignalUnsubscribers.push(socketService.on('call-answer', async (payload: SocketSignalPayload) => {
        if (this.callState === 'ended') return;
        if (payload.callId === this.callId && payload.targetId === this.userId) {
          console.log('? [WebRTC] Signal received via SOCKET: answer');
          await this.handleSignal({ type: 'answer', data: payload.data, from: payload.from });
        }
      }));

      this.socketSignalUnsubscribers.push(socketService.on('call-candidate', async (payload: SocketSignalPayload) => {
        if (this.callState === 'ended') return;
        if (payload.callId === this.callId && payload.targetId === this.userId) {
          // console.log('⚡ [WebRTC] Signal received via SOCKET: ice-candidate');
          await this.handleSignal({ type: 'ice-candidate', data: payload.data, from: payload.from });
        }
      }));
    }

    this.signalChannel = supabase
      .channel(`webrtc-${this.callId}-${this.userId}`)
        .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webrtc_signals',
          filter: `call_id=eq.${this.callId}`
        },
        (payload) => {
          const signal = payload.new as RealtimeSignalRow;
          if (signal.to_user === this.userId) {
            // DEDUPE: Skip already processed signals
            if (this.processedSignalIds.has(signal.id)) {
              console.log('⏭️ [WebRTC] Skipping duplicate signal:', signal.id.slice(0, 8));
              return;
            }
            this.processedSignalIds.add(signal.id);
            
            console.log('📥 [WebRTC] Signal received via realtime:', signal.signal_type);
            this.handleSignal({
              type: signal.signal_type as SignalType,
              data: signal.signal_data,
              from: signal.from_user
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [WebRTC] Subscription status:', status);
      });
  }

  private async handleSignal(signal: Signal) {
    if (!this.pc) { 
      console.warn(`📥 [WebRTC] Peer connection not ready yet — buffering incoming signal: ${signal.type}`); 
      this.bufferedSignals.push(signal); 
      return; 
    } 

    if (signal.type === 'signal-ack') {
      const ackKey = (signal.data as any)?.idempotencyKey;
      if (ackKey) {
        const pending = this.pendingAcks.get(ackKey);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingAcks.delete(ackKey);
          console.log(`❇️ [Signaling] Received ACK for signal: ${pending.signal.type}`);
        }
      }
      return;
    }

    if (signal.data && typeof signal.data === 'object' && '__chatr' in (signal.data as any)) {
      const meta = (signal.data as any).__chatr;
      if (meta?.idempotencyKey) {
        if (this.processedSignalIds.has(meta.idempotencyKey)) {
          console.log(`⏭️ [Signaling] Duplicate suppressed: already processed key ${meta.idempotencyKey.slice(0, 8)}`);
          return;
        }
        this.processedSignalIds.add(meta.idempotencyKey);

        if (meta.require_ack) {
          console.log(`📤 [Signaling] Auto-acknowledging incoming ${signal.type} (key: ${meta.idempotencyKey.slice(0, 8)})`);
          this.sendSignal({
            type: 'signal-ack',
            data: { idempotencyKey: meta.idempotencyKey },
            from: this.userId,
            to: signal.from,
          } as Signal).catch(() => {});
        }
      }
    }

    try {
      switch (signal.type) {
        case 'offer': {
          // For initial offers: initiators ignore (they send offers)
          // For renegotiation: ALLOW if call is already connected (e.g., adding video)
          const isRenegotiation = this.callState === 'connected';
          const offerFingerprint = this.getOfferFingerprint(signal.data);
          const shouldReanswerInitialOffer =
            this.answerSent &&
            !isRenegotiation &&
            (
              this.lastAnsweredOfferFingerprint !== offerFingerprint ||
              this.pc.connectionState === 'failed' ||
              this.pc.connectionState === 'disconnected' ||
              this.pc.iceConnectionState === 'failed' ||
              this.pc.iceConnectionState === 'disconnected'
            );
          if (shouldReanswerInitialOffer) {
            console.warn(
              `[WebRTC] Re-answering initial offer during recovery ` +
              `(pc=${this.pc.connectionState}, ice=${this.pc.iceConnectionState})`,
            );
            this.answerSent = false;
          }
          
          const isPolite = !this.isInitiator;
          const offerCollision = this.pc ? this.pc.signalingState !== 'stable' : false;
          
          if (offerCollision && this.pc) {
            if (!isPolite) {
              console.log('⚔️ [Negotiation] Glare Collision: Impolite peer (Initiator) ignoring remote offer');
              return;
            }
            console.log('⚔️ [Negotiation] Glare Collision: Polite peer (Receiver) rolling back local offer for remote offer');
            await this.pc.setLocalDescription({ type: 'rollback' });
          }

          if (this.isInitiator && !isRenegotiation) {
            console.log('⏭️ [WebRTC] Ignoring initial offer (I am initiator)');
            return;
          }
          
          // CRITICAL: Prevent duplicate answers for same offer
          // Only allow ONE answer per offer (except renegotiation)
          if (this.answerSent && !isRenegotiation) {
            console.log('⏭️ [WebRTC] Already sent initial answer, skipping duplicate offer');
            return;
          }
          
          // Ignore identical duplicate offers arriving late (e.g., via Supabase fallback)
          if (this.lastAnsweredOfferFingerprint === offerFingerprint) {
            console.log('⏭️ [WebRTC] Ignoring identical duplicate offer');
            return;
          }
          this.lastAnsweredOfferFingerprint = offerFingerprint;
          
          console.log(`📥 [WebRTC] Processing ${isRenegotiation ? 'RENEGOTIATION' : 'INITIAL'} OFFER...`);
          logSdpSummary(`[${this.instanceId}] remote offer`, signal.data as RTCSessionDescriptionInit);
          const remoteOffer = this.prepareAndroidRemoteDescription(
            signal.data as RTCSessionDescriptionInit,
          );
          await this.pc.setRemoteDescription(new RTCSessionDescription(remoteOffer));

          if (this.remoteOfferRequestsLocalVideo(remoteOffer)) {
            if (!this.isVideo) {
              console.log('[WebRTC] Remote offer requests local video; promoting call to video before answer');
              this.isVideo = true;
              this.callPreset = getCallPreset(this.networkQuality, true);
            }
          }

          // FaceTime-style auto video upgrade:
          // If partner renegotiates specifically for video upgrade, auto-enable OUR camera too
          const upgradeReason =
            (remoteOffer as ChatrSessionDescriptionInit)?.__chatr?.reason ||
            (signal.data as ChatrSessionDescriptionInit)?.__chatr?.reason;
          if (isRenegotiation && upgradeReason === 'video-upgrade') {
            try {
              const hasLocalVideo = (this.localStream?.getVideoTracks()?.length || 0) > 0;
              if (!hasLocalVideo) {
                console.log('📹 [WebRTC] Auto-enabling local video for bidirectional upgrade...');
                // No renegotiation here; we are responding with an answer.
                await this.enableLocalVideoAfterAccept();
              }
            } catch (e) {
              console.warn('⚠️ [WebRTC] Could not auto-enable local video:', e);
            }
          }
          
          if (this.isAndroidRuntime()) {
            this.preferAndroidH264Codec();
            await this.applyAndroidVideoSenderCaps('remote offer before answer');
          }

          // Always send answer for offers (including renegotiation)
          this.forceSendrecvTransceiversBeforeAnswer(isRenegotiation ? 'renegotiation' : 'initial offer');
          console.log(
            `[WebRTC] Answer media ready: stream=${this.describeStream(this.localStream)} ` +
            `senders=${this.describeSenders()}`,
          );
          const answer = await this.pc.createAnswer();
          const localAnswer = await this.setAndReturnLocalDescription(answer, 'local answer');
          
          const answerSignal = { type: 'answer', data: localAnswer, from: this.userId, callId: this.callId, targetId: this.partnerId };
          
          // ⚡ FAST PATH: Socket.IO
          if (socketService.isConnected) {
            socketService.emit('call-answer', answerSignal);
          }
          
          // RELIABILITY PATH: Supabase
          await this.sendSignal(answerSignal);
          console.log('✅ [WebRTC] ANSWER sent');
          this.answerSent = true;
          this.lastAnsweredOfferFingerprint = offerFingerprint;
          
          // Process queued ICE candidates
          await this.flushPendingCandidates();
          
          // Emit event so UI knows video was added
          if (isRenegotiation) {
            this.emit('renegotiationComplete');
          }
          break;
        }

        case 'answer': {
          // Only accept answers when we actually have a local offer outstanding.
          // This is critical for mid-call renegotiation (video upgrades) where offerSent may be reset.
          if (this.pc.signalingState !== 'have-local-offer') {
            console.log(
              '⏭️ [WebRTC] Ignoring answer (not expecting one), signalingState:',
              this.pc.signalingState
            );
            return;
          }

          console.log('📥 [WebRTC] Processing ANSWER...');
          this.hasReceivedAnswer = true;
          logSdpSummary(`[${this.instanceId}] remote answer`, signal.data as RTCSessionDescriptionInit);
          await this.pc.setRemoteDescription(new RTCSessionDescription(signal.data as RTCSessionDescriptionInit));
          console.log('✅ [WebRTC] ANSWER processed');

          // Process queued ICE candidates
          await this.flushPendingCandidates();
          break;
        }

        case 'ice-candidate': {
          if (this.pc.remoteDescription) {
            await this.pc.addIceCandidate(new RTCIceCandidate(signal.data as RTCIceCandidateInit));
          } else {
            this.pendingIceCandidates.push(new RTCIceCandidate(signal.data as RTCIceCandidateInit));
          }
          break;
        }
          
        case 'video-request':
          console.log('📹 [WebRTC] Video upgrade request received');
          this.emit('videoUpgradeRequest', signal.from);
          break;
          
        case 'video-accept':
          console.log('📹 [WebRTC] Video upgrade accepted by partner');
          this.emit('videoUpgradeAccepted', signal.from);
          break;
          
        case 'video-reject':
          console.log('📹 [WebRTC] Video upgrade rejected by partner');
          this.emit('videoUpgradeRejected', signal.from);
          break;

        case 'video-enable':
          console.log('📹 [WebRTC] Video enable requested by partner');
          this.emit('videoEnableRequested', signal.from);
          break;
      }
    } catch (error) {
      console.error(`❌ [WebRTC] Signal error (${signal.type}):`, error);
    }
  }

  private async flushPendingCandidates() {
    if (this.pendingIceCandidates.length === 0) return;
    
    console.log(`📥 [WebRTC] Flushing ${this.pendingIceCandidates.length} queued candidates`);
    for (const candidate of this.pendingIceCandidates) {
      try {
        await this.pc?.addIceCandidate(candidate);
      } catch (e) {
        console.warn('⚠️ [WebRTC] Failed to add queued candidate:', e);
      }
    }
    this.pendingIceCandidates = [];
  }

  private async createAndSendOffer() {
    if (!this.pc || this.offerSent) return;

    try {
      console.log('📤 [WebRTC] Creating offer...');
      this.offerSent = true;
      console.log('?? [WebRTC] Creating offer with dummy transceivers instantly...');
      this.offerSent = true;

      const offer = await this.pc.createOffer();
      const localOffer = await this.setAndReturnLocalDescription(offer, 'local offer');
      
      const offerSignal = { type: 'offer', data: localOffer, from: this.userId, callId: this.callId, targetId: this.partnerId };
      
      // ⚡ FAST PATH: Socket.IO
      if (socketService.isConnected) {
        socketService.emit('call-offer', offerSignal);
      }
      
      // RELIABILITY PATH: Supabase
      await this.sendSignal(offerSignal);
      console.log('✅ [WebRTC] Offer sent');
    } catch (error) {
      console.error('❌ [WebRTC] Failed to create offer:', error);
      this.offerSent = false;
      throw error;
    }
  }

  private enqueueForGuaranteedDelivery(signal: Signal, idempotencyKey: string, attempt = 0) {
    if (this.callState === 'ended') return;
    
    // Schedule retry if ACK is not received
    // Calibrate adaptive base timeout based on India network presets & NetworkBridge mode
    let baseTimeoutMs = 400; // Default baseline
    const netMode = typeof window !== 'undefined' && (window as any).CHATR_NETWORK_MODE;

    if (this.callPreset?.name === 'INDIA_SURVIVAL' || netMode === 1 || netMode === 2) {
      baseTimeoutMs = 1200; // INDIA_SURVIVAL_HIGH
    } else if (this.callPreset?.name === 'INDIA_SURVIVAL_MODERATE' || netMode === 3) {
      baseTimeoutMs = 800;  // INDIA_SURVIVAL_MODERATE
    }

    const timeoutMs = Math.min(baseTimeoutMs * Math.pow(1.5, attempt), 5000);
    const timer = setTimeout(() => {
      const pending = this.pendingAcks.get(idempotencyKey);
      if (pending) {
        if (attempt >= 5) {
          console.error(`🚨 [Signaling] Fatal Delivery Collapse: Failed to deliver signal ${signal.type} after 5 attempts.`);
          this.pendingAcks.delete(idempotencyKey);
          return;
        }
        
        console.warn(`⚠️ [Signaling] ACK timeout for ${signal.type} (Attempt ${attempt + 1}). Retrying transmission...`);
        this.pendingAcks.delete(idempotencyKey);
        
        // Retransmit same stamped signal
        this.sendSignal(signal).catch(() => {});
        this.enqueueForGuaranteedDelivery(signal, idempotencyKey, attempt + 1);
      }
    }, timeoutMs);

    this.pendingAcks.set(idempotencyKey, { signal, attempts: attempt, timer });
  }

  private emitSocketSignal(signal: Signal): void {
    if (!socketService.isConnected) return;

    const payload = {
      callId: this.callId,
      targetId: this.partnerId,
      from: this.userId,
      data: signal.data,
    };

    if (signal.type === 'offer') {
      socketService.emit('call-offer', payload);
    } else if (signal.type === 'answer') {
      socketService.emit('call-answer', payload);
    } else if (signal.type === 'ice-candidate') {
      socketService.emit('call-candidate', payload);
    }
  }

  private async sendSignal(signal: Signal) {
    if (this.callState === 'ended') return;
    if (!this.partnerId) {
      throw new Error(`Missing partnerId for ${signal.type}`);
    }
    if (!looksLikeUuid(this.partnerId)) {
      const message = `Invalid WebRTC partner id for ${signal.type}: ${this.partnerId}`;
      console.error(`[WebRTC] ${message}`);
      this.emit('error', message);
      return;
    }

    // 🛡️ GUARANTEED DELIVERY: Stamp all non-ACK signals with sequence numbers & idempotency keys
    let finalSignal = signal;
    if (signal.type !== 'signal-ack') {
      const metaCandidate = signal.data && typeof signal.data === 'object'
        ? (signal.data as Record<string, unknown>).__chatr
        : undefined;
      const existingMeta = metaCandidate && typeof metaCandidate === 'object'
        ? (metaCandidate as Record<string, unknown>)
        : undefined;
      const hasStamp = typeof existingMeta?.idempotencyKey === 'string';
      if (!hasStamp) {
        const seq = ++this.signalSeqCounter;
        const idempotencyKey = `${this.callId}-${seq}-${Date.now().toString(36)}`;
        const enhancedData = {
          ...(signal.data as object || {}),
          __chatr: {
            ...(existingMeta || {}),
            seq,
            idempotencyKey,
            ackless: true
          }
        };
        finalSignal = {
          ...signal,
          data: enhancedData
        };
      }
    }

    try {
      const { error } = await supabase
        .from('webrtc_signals')
        .insert([{
          call_id: this.callId,
          from_user: this.userId,
          to_user: this.partnerId,
          signal_type: finalSignal.type,
          signal_data: finalSignal.data
        }]);

      if (error) throw error;
      console.log(`📡 [WebRTC] Signal sent via Realtime: ${finalSignal.type}`);
    } catch (e) {
      console.error('❌ [WebRTC] Signal send failed:', e instanceof Error ? e.message : String(e), JSON.stringify(e));
      this.emit('error', 'Signaling failed. Check connection.');
    }
  }

  private startConnectionTimeout() {
    const initialTimeoutMs = this.callPreset?.connectionTimeoutMs ?? 15000;
    const answerWaitExtensionMs = Math.max(10000, Math.round(initialTimeoutMs * 0.75));
    const restartGraceMs = Math.max(10000, Math.round(initialTimeoutMs * 0.5));

    // 15 seconds for initial connection (fast failure feedback)
    this.connectionTimeout = setTimeout(() => {
      if (this.callState === 'connecting') {
        console.warn(`⏰ [WebRTC] Connection timeout after ${Math.round(initialTimeoutMs / 1000)}s`);
        
        if (!this.hasReceivedAnswer && this.isInitiator) {
          // No answer received - partner may not have answered yet
          console.log('⏳ [WebRTC] No answer yet, waiting...');
          this.emit('recoveryStatus', { message: 'Waiting for answer...' });
          // Extend timeout for another preset-scaled window
          this.connectionTimeout = setTimeout(() => {
            if (this.callState === 'connecting') {
              console.error('❌ [WebRTC] Connection failed - no answer');
              this.callState = 'failed';
              this.emit('failed', new Error('No answer received'));
            }
          }, answerWaitExtensionMs);
        } else {
          // Have answer but still not connected - ICE issue
          console.log('🔄 [WebRTC] ICE stalled, restarting...');
          this.emit('recoveryStatus', { message: 'Reconnecting...' });
          this.pc?.restartIce();
          // Give a preset-scaled grace period after restart
          this.connectionTimeout = setTimeout(() => {
            if (this.callState === 'connecting') {
              console.error('❌ [WebRTC] Connection failed after ICE restart');
              this.callState = 'failed';
              this.emit('failed', new Error('ICE connection failed'));
            }
          }, restartGraceMs);
        }
      }
    }, initialTimeoutMs);
  }

  private clearConnectionTimeout() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  toggleAudio(enabled: boolean) {
    this.audioWantedEnabled = enabled;
    this.localStream?.getAudioTracks().forEach(track => {
      track.enabled = enabled;
    });

    if (enabled) {
      void this.forceOutboundAudioSender('audio unmuted').catch(error => {
        console.warn('[WebRTC] Audio sender repair after unmute failed:', error);
      });
    }
  }

  toggleVideo(enabled: boolean) {
    this.localStream?.getVideoTracks().forEach(track => {
      track.enabled = enabled;
    });
  }

  // ============== VIDEO UPGRADE (FACE TIME AUTO) ==============
  
  /**
   * Ask partner to auto-enable video (no consent modal)
   * Used when the non-initiator clicks video; initiator will renegotiate.
   */
  async sendVideoEnable(): Promise<void> {
    console.log('📹 [WebRTC] Sending video enable signal...');
    await this.sendSignal({
      type: 'video-enable',
      data: { timestamp: Date.now() },
      from: this.userId,
    });
  }

  // ==============================================================
  /**
   * Accept video upgrade request and enable local video
   * The ACCEPTOR is the one who triggers renegotiation to prevent glare
   */
  async acceptVideoUpgrade(): Promise<MediaStream | null> {
    console.log('📹 [WebRTC] Accepting video upgrade - I will trigger renegotiation...');
    
    // First enable our own video and trigger renegotiation
    const stream = await this.addVideoToCall();
    
    // THEN notify partner we accepted (they will just add local video without renegotiating)
    await this.sendSignal({ 
      type: 'video-accept', 
      data: { timestamp: Date.now() }, 
      from: this.userId 
    });
    
    return stream;
  }

  /**
   * Enable local video for the requester AFTER partner accepted
   * Does NOT trigger renegotiation - just adds local video track
   * The acceptor's renegotiation will handle adding our track to their view
   */
  async enableLocalVideoAfterAccept(): Promise<MediaStream | null> {
    if (!this.pc) {
      console.error('❌ [WebRTC] No peer connection for video');
      return null;
    }

    try {
      console.log('📹 [WebRTC] Enabling local video (no renegotiation - acceptor handles it)...');
      
      let videoStream: MediaStream | null = null;
      let lastError: unknown = null;

      for (const profile of this.getVideoCaptureProfiles('user')) {
        try {
          console.log(`📹 [WebRTC] Trying video-upgrade profile: ${profile.label}`);
          videoStream = await navigator.mediaDevices.getUserMedia({ video: profile.constraints });
          console.log(`✅ [WebRTC] Video acquired for requester with ${profile.label}`);
          break;
        } catch (error) {
          lastError = error;
          console.log(`⚠️ [WebRTC] ${profile.label} failed for requester, trying next...`);
        }
      }

      if (!videoStream) {
        console.log('⚠️ [WebRTC] Adaptive video profiles failed, using basic camera...');
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }).catch(() => {
          throw lastError || new Error('Could not acquire local video');
        });
      }

      const videoTrack = videoStream.getVideoTracks()[0];
      if (!videoTrack) {
        console.error('❌ [WebRTC] No video track obtained');
        return null;
      }
      
      console.log('📹 [WebRTC] Got video track:', videoTrack.label);
      
      this.isVideo = true;
      // Check if we already have a video sender from the current peer connection
      const existingVideoSender = this.findReusableSender('video');
      
      if (existingVideoSender) {
        // Just replace the track - no renegotiation from this helper
        await existingVideoSender.replaceTrack(videoTrack);
        console.log('📹 [WebRTC] Replaced video sender track (no renegotiation)');
      } else {
        // Add track; the current/next offer-answer will carry it
        console.log('📹 [WebRTC] No existing sender - adding video track (no renegotiation)');
        const stream = this.localStream || new MediaStream([videoTrack]);
        if (this.isAndroidRuntime() && typeof this.pc.addTransceiver === 'function') {
          this.pc.addTransceiver(videoTrack, { direction: 'sendrecv', streams: [stream] });
        } else {
          this.pc.addTrack(videoTrack, stream);
        }
      }
      this.promoteVideoTransceiversToSendrecv('local video enabled after accept');
      
      // Update local stream for UI
      if (this.localStream) {
        const oldVideoTrack = this.localStream.getVideoTracks()[0];
        if (oldVideoTrack && oldVideoTrack !== videoTrack) {
          this.localStream.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        if (!this.localStream.getVideoTracks().includes(videoTrack)) {
          this.localStream.addTrack(videoTrack);
        }
      } else {
        this.localStream = videoStream;
      }

      if (this.isAndroidRuntime()) {
        this.preferAndroidH264Codec();
        await this.applyAndroidVideoSenderCaps('local video enabled after accept');
      }
      
      this.emit('localStream', this.localStream);
      return this.localStream;
    } catch (error) {
      console.error('❌ [WebRTC] Failed to enable local video:', error);
      return null;
    }
  }

  /**
   * Reject video upgrade request
   */
  async rejectVideoUpgrade(): Promise<void> {
    console.log('📹 [WebRTC] Rejecting video upgrade...');
    await this.sendSignal({ 
      type: 'video-reject', 
      data: { timestamp: Date.now() }, 
      from: this.userId 
    });
  }
  
  // ==============================================================

  async addVideoToCall(): Promise<MediaStream | null> {
    if (!this.pc) {
      console.error('❌ [WebRTC] No peer connection for video');
      return null;
    }

    try {
      console.log('📹 [WebRTC] Adding adaptive video to call...');

      let videoStream: MediaStream | null = null;
      let lastError: unknown = null;

      for (const profile of this.getVideoCaptureProfiles('user')) {
        try {
          console.log(`📹 [WebRTC] Trying in-call video profile: ${profile.label}`);
          videoStream = await navigator.mediaDevices.getUserMedia({ video: profile.constraints });
          console.log(`✅ [WebRTC] In-call video acquired with ${profile.label}`);
          break;
        } catch (error) {
          lastError = error;
          console.log(`⚠️ [WebRTC] ${profile.label} failed for in-call upgrade, trying next...`);
        }
      }

      if (!videoStream) {
        console.log('⚠️ [WebRTC] Adaptive in-call profiles failed, using basic camera...');
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }).catch(() => {
          throw lastError || new Error('Could not acquire in-call video');
        });
      }

      const videoTrack = videoStream.getVideoTracks()[0];
      if (!videoTrack) {
        console.error('❌ [WebRTC] No video track obtained');
        return null;
      }
      
      console.log('📹 [WebRTC] Got video track:', videoTrack.label);
      
      this.isVideo = true;
      // Check if we already have a video sender
      const existingVideoSender = this.findReusableSender('video');
      
      if (existingVideoSender) {
        await existingVideoSender.replaceTrack(videoTrack);
        console.log('📹 [WebRTC] Replaced existing video track');
      } else {
        // Add new video track to connection
        const stream = this.localStream || new MediaStream([videoTrack]);
        if (this.isAndroidRuntime() && typeof this.pc.addTransceiver === 'function') {
          this.pc.addTransceiver(videoTrack, { direction: 'sendrecv', streams: [stream] });
        } else {
          this.pc.addTrack(videoTrack, stream);
        }
        console.log('📹 [WebRTC] Added new video track to peer connection');
      }
      this.promoteVideoTransceiversToSendrecv('local video added to call');
      
      // Update local stream for UI
      if (this.localStream) {
        const oldVideoTrack = this.localStream.getVideoTracks()[0];
        if (oldVideoTrack) {
          this.localStream.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        this.localStream.addTrack(videoTrack);
      } else {
        this.localStream = videoStream;
      }

      if (this.isAndroidRuntime()) {
        this.preferAndroidH264Codec();
        await this.applyAndroidVideoSenderCaps('local video added to call');
      }
      
      this.emit('localStream', this.localStream);

      // Renegotiate to inform partner (tagged so receiver can auto-enable their camera too)
      this.hasReceivedAnswer = false;
      this.offerSent = false;
      await this.attachAudioForNegotiation('local video-upgrade offer');
      console.log(
        `[WebRTC] Video-upgrade offer media ready: stream=${this.describeStream(this.localStream)} ` +
        `senders=${this.describeSenders()}`,
      );
      
      const offer = await this.pc.createOffer();
      (offer as ChatrSessionDescriptionInit).__chatr = { reason: 'video-upgrade' };
      const localOffer = await this.setAndReturnLocalDescription(offer, 'local video-upgrade offer');
      this.emitSocketSignal({ type: 'offer', data: localOffer, from: this.userId });
      await this.sendSignal({ type: 'offer', data: localOffer, from: this.userId });
      console.log('📤 [WebRTC] Sent renegotiation offer with video');

      return this.localStream;
    } catch (error) {
      console.error('❌ [WebRTC] Failed to add video:', error);
      return null;
    }
  }

  sendDTMF(digit: string) {
    const sender = this.pc?.getSenders().find(s => s.track?.kind === 'audio');
    if (sender?.dtmf) {
      sender.dtmf.insertDTMF(digit, 100, 70);
    }
  }

  async addLocalStream(stream: MediaStream): Promise<void> {
    if (!this.pc) {
      console.error('❌ [WebRTC] Cannot add local stream: PeerConnection is null');
      return;
    }
    console.log('➕ [WebRTC] Injecting local stream tracks into active PeerConnection:', stream.id);
    this.localStream = stream;
    await this.ensureVideoTrackForVideoCall('external local stream injection');
    
    const { addedMLine } = await this.attachLocalStreamTracks(this.localStream, 'external local stream injection');
    
    this.emit('localStream', this.localStream);
    
    // Keep Android on hardware H264 if we added video tracks.
    if (this.isVideo && this.isAndroidRuntime()) {
      this.preferAndroidH264Codec();
      await this.applyAndroidVideoSenderCaps('external local stream injection');
    }

    // If tracks were added, and we are already in connected or stable state,
    // we MUST trigger renegotiation to update the media description to send/receive media.
    if (addedMLine && (this.callState === 'connected' || this.pc.signalingState === 'stable')) {
      console.log('🔄 [WebRTC] Tracks added to established connection. Triggering renegotiation...');
      try {
        this.hasReceivedAnswer = false;
        this.offerSent = false;
        await this.attachAudioForNegotiation('local add-stream renegotiation offer');
        console.log(
          `[WebRTC] Add-stream offer media ready: stream=${this.describeStream(this.localStream)} ` +
          `senders=${this.describeSenders()}`,
        );
        
        const offer = await this.pc.createOffer();
        const localOffer = await this.setAndReturnLocalDescription(offer, 'local add-stream renegotiation offer');
        this.emitSocketSignal({ type: 'offer', data: localOffer, from: this.userId });
        await this.sendSignal({ type: 'offer', data: localOffer, from: this.userId });
        console.log('📤 [WebRTC] Sent renegotiation offer after adding local stream');
      } catch (error) {
        console.error('❌ [WebRTC] Renegotiation failed after adding local stream:', error);
      }
    }
  }

  // Track current camera facing mode
  private currentFacingMode: 'user' | 'environment' = 'user';
  private isSwitchingCamera: boolean = false;

  /** Get the current camera facing mode */
  getCurrentFacingMode(): 'user' | 'environment' {
    return this.currentFacingMode;
  }

  async switchCamera(): Promise<'user' | 'environment'> {
    // Prevent multiple simultaneous switch attempts (causes stuck camera)
    if (this.isSwitchingCamera) {
      console.log('⏳ [WebRTC] Camera switch in progress, ignoring...');
      return this.currentFacingMode;
    }
    
    const videoTrack = this.localStream?.getVideoTracks()[0];
    if (!videoTrack) throw new Error('No video track');

    this.isSwitchingCamera = true;
    
    const newFacing = this.currentFacingMode === 'user' ? 'environment' : 'user';
    console.log(`📷 [WebRTC] Switching camera: ${this.currentFacingMode} → ${newFacing}`);
    const { acquireCameraTrack } = await import('@/utils/crossPlatformCamera');
    const previousFacing = this.currentFacingMode;
    const releaseFirst = this.isAndroidRuntime();

    try {
      let result;
      if (releaseFirst) {
        console.log('📷 [WebRTC] Android camera switch: releasing current camera before reopening');
        this.localStream?.removeTrack(videoTrack);
        videoTrack.stop();
        await this.delay(180);
        result = await acquireCameraTrack(newFacing, videoTrack);
      } else {
        result = await acquireCameraTrack(newFacing, videoTrack);
      }

      if (!result) {
        throw new Error('All camera profiles failed across all platforms');
      }

      const { track: newVideoTrack, actualFacing } = result;

      // Replace track in peer connection with timeout
      const replacePromise = this.replaceTrack(newVideoTrack);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Track replace timeout')), 5000)
      );
      
      await Promise.race([replacePromise, timeoutPromise]);

      // Stop old track AFTER successful replacement
      if (!releaseFirst) {
        videoTrack.stop();
      }

      if (this.isAndroidRuntime()) {
        this.preferAndroidH264Codec();
        await this.applyAndroidVideoSenderCaps('camera switch');
      }
      
      // Update state with actual detected facing
      this.currentFacingMode = actualFacing;
      
      // Force re-emit localStream to update UI (with mirror info)
      if (this.localStream) {
        const freshStream = new MediaStream(this.localStream.getTracks());
        this.localStream = freshStream;
        this.emit('localStream', this.localStream);
      }
      // Emit facing mode change so UI can update mirror
      this.emit('facingModeChanged', actualFacing);

      console.log('✅ [WebRTC] Camera switched to ' + actualFacing);
      return actualFacing;
    } catch (e: unknown) {
      if (releaseFirst) {
        try {
          console.warn('⚠️ [WebRTC] Camera switch failed, attempting to restore previous camera...');
          const recovery = await acquireCameraTrack(previousFacing, null);
          if (recovery) {
            await this.replaceTrack(recovery.track);
            if (this.localStream) {
              const freshStream = new MediaStream(this.localStream.getTracks());
              this.localStream = freshStream;
              this.emit('localStream', this.localStream);
            }
            this.emit('facingModeChanged', previousFacing);
            console.log('✅ [WebRTC] Restored previous camera after failed switch');
          }
        } catch (recoveryError) {
          console.error('❌ [WebRTC] Failed to restore previous camera:', recoveryError);
        }
      }
      console.error('❌ [WebRTC] Switch camera failed completely:', e);
      return this.currentFacingMode;
    } finally {
      this.isSwitchingCamera = false;
    }
  }

  async replaceTrack(newTrack: MediaStreamTrack): Promise<void> {
    const kind = newTrack.kind as 'audio' | 'video';
    const sender = kind === 'audio' || kind === 'video'
      ? this.findReusableSender(kind)
      : null;
    if (!sender) {
      throw new Error("No RTP sender found for " + newTrack.kind + " track");
    }

    await sender.replaceTrack(newTrack);
    if (kind === 'video') {
      this.promoteVideoTransceiversToSendrecv('replaceTrack');
      if (this.isAndroidRuntime()) {
        this.preferAndroidH264Codec();
        await this.applyAndroidVideoSenderCaps('replaceTrack');
      }
    }
    
    // Update local stream
    if (this.localStream) {
      const oldTrack = this.localStream.getTracks().find(t => t.kind === newTrack.kind);
      if (oldTrack) {
        this.localStream.removeTrack(oldTrack);
      }
      this.localStream.addTrack(newTrack);
    }
  }

  applyZoom(scale: number) {
    const videoTrack = this.localStream?.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      const capabilities = videoTrack.getCapabilities?.() as ZoomCapabilities | undefined;
      if (capabilities?.zoom) {
        const constraints: MediaTrackConstraints = { advanced: [{ zoom: scale } as ZoomConstraint] };
        videoTrack.applyConstraints(constraints);
      }
    } catch (e) {
      console.warn('Zoom not supported on this device');
    }
  }

  /**
   * Get peer connection for external access (e.g., ultra-low bandwidth hooks)
   */
  getPeerConnection(): RTCPeerConnection | null {
    return this.pc;
  }

  async end() {
    this.explicitEnding = true;
    console.log('👋 [WebRTC] Ending call...');
    this.callState = 'ended';
    this.clearConnectionTimeout();
    
    // Security Governance: Log call end
    securityService.logEvent({
      eventType: 'call_end',
      severity: 'info',
      metadata: { callId: this.callId, duration: 'unknown' }
    });

    // Remove from active instances
    activeCallInstances.delete(this.callId);
    
    await this.cleanup();
    this.emit('ended');
  }

  private async cleanup() {
    if (this.cleanupStarted) {
      return;
    }
    this.cleanupStarted = true;

    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }

    // Clear all pending signaling ACKs and timeouts
    this.pendingAcks.forEach(ack => {
      clearTimeout(ack.timer);
    });
    this.pendingAcks.clear();

    // Background Continuity: Clear MediaSession lock
    if (typeof navigator !== 'undefined' && navigator.mediaSession) {
      try {
        navigator.mediaSession.playbackState = 'none';
        navigator.mediaSession.metadata = null;
      } catch (e) {
        console.debug('MediaSession clear error:', e);
      }
    }

    this.socketSignalUnsubscribers.forEach(unsubscribe => unsubscribe());
    this.socketSignalUnsubscribers = [];
    this.signalsSubscribed = false;

    // Stop local tracks
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
    this.remoteStream.getTracks().forEach(track => this.remoteStream.removeTrack(track));

    // Cleanup signaling manager
    if (this.signalingManager) {
      await this.signalingManager.close();
      this.signalingManager = null;
    }

    // Cleanup insertable streams
    if (this.insertableStreams) {
      this.insertableStreams.destroy();
      this.insertableStreams = null;
    }

    // Cleanup ICE refresh
    if (this.iceRefreshInterval) {
      clearInterval(this.iceRefreshInterval);
      this.iceRefreshInterval = null;
    }

    // Cleanup adaptive bitrate engine
    if (this.abrEngine) {
      this.abrEngine.stop();
      this.abrEngine = null;
    }

    // Cleanup adaptive bitrate monitor
    if (this.adaptiveMonitorInterval) {
      clearInterval(this.adaptiveMonitorInterval);
      this.adaptiveMonitorInterval = null;
    }

    if (this.outboundAudioWatchdog) {
      clearInterval(this.outboundAudioWatchdog);
      this.outboundAudioWatchdog = null;
    }

    if (this.diagnosticsCleanup) {
      this.diagnosticsCleanup();
      this.diagnosticsCleanup = null;
    }

    // Cleanup ICE monitor
    if (this.iceMonitor) {
      this.iceMonitor.cleanup();
      this.iceMonitor = null;
    }
    
    // Cleanup network change listener
    if (this.networkChangeCleanup) {
      this.networkChangeCleanup();
      this.networkChangeCleanup = null;
    }

    // Close peer connection
    if (this.pc) {
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.close();
      this.pc = null;
    }

    // Unsubscribe from signals
    if (this.signalChannel) {
      await supabase.removeChannel(this.signalChannel);
      this.signalChannel = null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


