/**
 * CHATR+ Call Quality Benchmark Service — REAL DATA
 *
 * Hooks directly into the existing SimpleWebRTCCall.getPeerConnection()
 * and the same getStats() pipeline that UnifiedCallScreen already uses.
 *
 * Uses the existing calculateMOS() from callQuality.ts (ITU-T G.107).
 * Persists to Supabase `call_quality_metrics` table on every tick.
 *
 * Integration:
 *   import { CallBenchmarkCollector } from '@/services/callBenchmark';
 *
 *   // Inside a call component, after webrtcRef is set:
 *   const collector = new CallBenchmarkCollector(callId, 'NORMAL', 'chatr');
 *   collector.attach(webrtcRef.current.getPeerConnection());
 *   collector.startCollection();
 *   // On call end:
 *   const summary = collector.stop();
 */

import { calculateMOS } from '@/utils/callQuality';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NetworkScenario =
  | 'EDGE_2G'
  | 'CONGESTED_LTE'
  | 'WIFI_HANDOFF'
  | 'RURAL_WEAK'
  | 'NORMAL';

export type Platform = 'chatr' | 'whatsapp' | 'jiocall';

export interface CallQualitySnapshot {
  /** Unix ms timestamp of this snapshot */
  ts: number;
  mosScore: number;        // 1.0 – 4.5
  packetLoss: number;      // %
  jitterMs: number;        // ms
  rttMs: number;           // ms
  bitrateKbps: number;     // audio kbps
  audioLevel: number;      // 0–1
  concealedSamples: number;
  totalSamples: number;
  setupTimeMs: number;     // only >0 on first snapshot
}

export interface CallBenchmarkSummary {
  callId: string;
  scenario: NetworkScenario;
  platform: Platform;
  startedAt: string;
  durationMs: number;
  snapshotCount: number;
  avgMOS: number;
  avgPacketLoss: number;
  avgJitterMs: number;
  avgRttMs: number;
  avgBitrateKbps: number;
  setupTimeMs: number;
  reconnectCount: number;
  snapshots: CallQualitySnapshot[];
}

// ─── Network Scenario Reference (for labelling only) ─────────────────────────
export const NETWORK_SCENARIOS: Record<NetworkScenario, {
  label: string;
  description: string;
  targetLatencyMs: number;
  packetLossPct: number;
  bandwidthKbps: number;
  jitterMs: number;
}> = {
  NORMAL:       { label: 'Normal (4G/WiFi)',   description: 'Baseline good network',           targetLatencyMs: 50,  packetLossPct: 0.5, bandwidthKbps: 5000, jitterMs: 5  },
  CONGESTED_LTE:{ label: 'Congested LTE',       description: 'Peak-hour LTE congestion',       targetLatencyMs: 200, packetLossPct: 4,   bandwidthKbps: 500,  jitterMs: 20 },
  WIFI_HANDOFF: { label: 'WiFi → 4G Handoff',  description: 'Network switch disruption',       targetLatencyMs: 350, packetLossPct: 5,   bandwidthKbps: 400,  jitterMs: 45 },
  EDGE_2G:      { label: '2G EDGE',             description: 'Worst case rural India 2G',      targetLatencyMs: 600, packetLossPct: 12,  bandwidthKbps: 80,   jitterMs: 90 },
  RURAL_WEAK:   { label: 'Rural Weak Signal',   description: 'Fluctuating rural 3G/2G',        targetLatencyMs: 900, packetLossPct: 18,  bandwidthKbps: 50,   jitterMs: 130},
};

// ─── Target Thresholds ────────────────────────────────────────────────────────
export const BENCHMARK_TARGETS = {
  mosScore:    { good: 4.0,  acceptable: 3.6,   label: 'MOS Score',   unit: '',    higherBetter: true  },
  packetLoss:  { good: 3,    acceptable: 8,      label: 'Packet Loss', unit: '%',   higherBetter: false },
  jitterMs:    { good: 20,   acceptable: 50,     label: 'Jitter',      unit: 'ms',  higherBetter: false },
  rttMs:       { good: 150,  acceptable: 300,    label: 'RTT',         unit: 'ms',  higherBetter: false },
  setupTimeMs: { good: 2000, acceptable: 4000,   label: 'Setup Time',  unit: 'ms',  higherBetter: false },
  bitrateKbps: { good: 20,   acceptable: 12,     label: 'Bitrate',     unit: 'kbps',higherBetter: true  },
} as const;

export type MetricKey = keyof typeof BENCHMARK_TARGETS;

export function getMetricRating(key: MetricKey, value: number): 'good' | 'acceptable' | 'poor' {
  const t = BENCHMARK_TARGETS[key];
  if (t.higherBetter) {
    if (value >= t.good) return 'good';
    if (value >= t.acceptable) return 'acceptable';
    return 'poor';
  } else {
    if (value <= t.good) return 'good';
    if (value <= t.acceptable) return 'acceptable';
    return 'poor';
  }
}

// ─── Collector ────────────────────────────────────────────────────────────────

export class CallBenchmarkCollector {
  private pc: RTCPeerConnection | null = null;
  private intervalId: number | null = null;
  private snapshots: CallQualitySnapshot[] = [];
  private startedAt: number;
  private setupStartTime: number;
  private setupTimeMs = 0;
  private reconnectCount = 0;
  private prevBytesSent = 0;
  private prevBytesTs = 0;

  constructor(
    public readonly callId: string,
    public readonly scenario: NetworkScenario = 'NORMAL',
    public readonly platform: Platform = 'chatr',
  ) {
    this.startedAt = Date.now();
    this.setupStartTime = Date.now();
  }

  /**
   * Attach to a live RTCPeerConnection.
   * Call this as soon as the PC is available.
   */
  attach(pc: RTCPeerConnection) {
    this.pc = pc;
    this.setupStartTime = Date.now();

    // Record setup time the moment the connection is established
    const onStateChange = () => {
      if (pc.connectionState === 'connected' && this.setupTimeMs === 0) {
        this.setupTimeMs = Date.now() - this.setupStartTime;
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.reconnectCount++;
      }
    };
    pc.addEventListener('connectionstatechange', onStateChange);
  }

  /**
   * Begin reading stats from the PeerConnection every `intervalMs`.
   * Defaults to 2000ms — same cadence as UnifiedCallScreen.
   */
  startCollection(intervalMs = 2000) {
    if (this.intervalId !== null) return;
    this.intervalId = window.setInterval(() => this.tick(), intervalMs);
  }

  private async tick() {
    if (!this.pc) return;
    const now = Date.now();

    try {
      const stats = await this.pc.getStats();

      let packetLoss = 0;
      let jitterMs = 0;
      let rttMs = 0;
      let bytesSent = 0;
      let audioLevel = 0;
      let concealedSamples = 0;
      let totalSamples = 0;

      stats.forEach(r => {
        // Inbound RTP — packet loss, jitter, concealment
        if (r.type === 'inbound-rtp' && r.mediaType === 'audio') {
          const lost = r.packetsLost || 0;
          const recv = r.packetsReceived || 1;
          packetLoss = (lost / (lost + recv)) * 100;
          jitterMs = (r.jitter || 0) * 1000;
          concealedSamples = r.concealedSamples || 0;
          totalSamples = r.totalSamplesReceived || 1;
        }

        // Remote inbound — RTT (most accurate source)
        if (r.type === 'remote-inbound-rtp' && r.mediaType === 'audio') {
          rttMs = (r.roundTripTime || 0) * 1000;
        }

        // Candidate pair — fallback RTT
        if (r.type === 'candidate-pair' && r.state === 'succeeded' && rttMs === 0) {
          rttMs = (r.currentRoundTripTime || 0) * 1000;
        }

        // Outbound RTP — bytes for bitrate calculation
        if (r.type === 'outbound-rtp' && r.mediaType === 'audio') {
          bytesSent = r.bytesSent || 0;
        }

        // Audio level from media source
        if (r.type === 'media-source' && r.kind === 'audio') {
          audioLevel = r.audioLevel || 0;
        }
      });

      // Compute instantaneous audio bitrate
      let bitrateKbps = 0;
      if (this.prevBytesTs > 0 && bytesSent > this.prevBytesSent) {
        const dtMs = now - this.prevBytesTs;
        bitrateKbps = ((bytesSent - this.prevBytesSent) * 8) / dtMs; // kbps
      }
      this.prevBytesSent = bytesSent;
      this.prevBytesTs = now;

      // Use the SAME calculateMOS function as UnifiedCallScreen
      const mosScore = calculateMOS(rttMs, packetLoss, jitterMs);

      const snap: CallQualitySnapshot = {
        ts: now,
        mosScore,
        packetLoss:       Math.round(packetLoss * 100) / 100,
        jitterMs:         Math.round(jitterMs),
        rttMs:            Math.round(rttMs),
        bitrateKbps:      Math.round(bitrateKbps * 10) / 10,
        audioLevel:       Math.round(audioLevel * 1000) / 1000,
        concealedSamples,
        totalSamples,
        setupTimeMs:      this.snapshots.length === 0 ? this.setupTimeMs : 0,
      };

      this.snapshots.push(snap);
      this.persist(snap).catch(() => {/* non-fatal */});
    } catch {
      /* getStats() can fail if PC is closed */
    }
  }

  private async persist(snap: CallQualitySnapshot) {
    await (supabase.from('call_quality_metrics') as any).insert({
      call_id:           this.callId,
      scenario:          this.scenario,
      platform:          this.platform,
      mos_score:         snap.mosScore,
      packet_loss:       snap.packetLoss,
      jitter_ms:         snap.jitterMs,
      rtt_ms:            snap.rttMs,
      setup_time_ms:     snap.setupTimeMs || null,
      reconnect_count:   this.reconnectCount,
      bitrate_kbps:      snap.bitrateKbps,
      audio_level:       snap.audioLevel,
      concealed_samples: snap.concealedSamples,
      total_samples:     snap.totalSamples,
      created_at:        new Date(snap.ts).toISOString(),
    });
  }

  stop(): CallBenchmarkSummary {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    return this.getSummary();
  }

  getLatest(): CallQualitySnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  getSummary(): CallBenchmarkSummary {
    const n = this.snapshots.length;
    const avg = (key: keyof CallQualitySnapshot) => {
      if (n === 0) return 0;
      return this.snapshots.reduce((acc, s) => acc + (s[key] as number), 0) / n;
    };

    return {
      callId:          this.callId,
      scenario:        this.scenario,
      platform:        this.platform,
      startedAt:       new Date(this.startedAt).toISOString(),
      durationMs:      Date.now() - this.startedAt,
      snapshotCount:   n,
      avgMOS:          Math.round(avg('mosScore') * 100) / 100,
      avgPacketLoss:   Math.round(avg('packetLoss') * 100) / 100,
      avgJitterMs:     Math.round(avg('jitterMs')),
      avgRttMs:        Math.round(avg('rttMs')),
      avgBitrateKbps:  Math.round(avg('bitrateKbps') * 10) / 10,
      setupTimeMs:     this.setupTimeMs,
      reconnectCount:  this.reconnectCount,
      snapshots:       this.snapshots,
    };
  }
}

// ─── Opus 2G Config ───────────────────────────────────────────────────────────
export const OPUS_2G_CONFIG = {
  enableFEC:        true,
  enableDTX:        true,
  minBitrateKbps:   8,
  maxBitrateKbps:   20,
  preferSILK:       true,
  ptimeMs:          60,
} as const;

export const AUDIO_CONSTRAINTS_INDIA: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl:  true,
  // @ts-ignore — Chrome/Android extensions
  googNoiseSuppression: true,
  googHighpassFilter:   true,
  googEchoCancellation: true,
  googAutoGainControl:  true,
  googEchoCancellation2: true,
  googNoiseSuppression2: true,
};
