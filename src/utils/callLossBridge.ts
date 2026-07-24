/**
 * Chatr+ Audio Ring Buffer & Loss Bridge (Phase 9)
 *
 * Two systems:
 *
 * 1. AudioRingBuffer – stores last 1.5 s of decoded audio PCM samples
 *    so that brief packet bursts can be concealed during recovery.
 *    Integrated into the Web Audio pipeline of the remote stream.
 *
 * 2. LossBridge – keeps a lightweight text notification channel open
 *    so callers receive a friendly "Partner lost signal – keeping call warm"
 *    toast instead of a silent freeze.
 */

// ---------------------------------------------------------------------------
// 1. Audio Ring Buffer
// ---------------------------------------------------------------------------

/** Ring buffer that retains the last `capacitySamples` PCM Float32 values */
export class AudioRingBuffer {
  private buffer: Float32Array;
  private writeHead = 0;
  private totalWritten = 0;

  constructor(private capacitySamples: number) {
    this.buffer = new Float32Array(capacitySamples);
  }

  write(samples: Float32Array) {
    for (let i = 0; i < samples.length; i++) {
      this.buffer[this.writeHead % this.capacitySamples] = samples[i];
      this.writeHead = (this.writeHead + 1) % this.capacitySamples;
      this.totalWritten++;
    }
  }

  /** Read the last `n` samples in chronological order */
  readLast(n: number): Float32Array {
    const available = Math.min(n, this.totalWritten);
    const out = new Float32Array(available);
    const start = (this.writeHead - available + this.capacitySamples) % this.capacitySamples;
    for (let i = 0; i < available; i++) {
      out[i] = this.buffer[(start + i) % this.capacitySamples];
    }
    return out;
  }

  clear() {
    this.buffer.fill(0);
    this.writeHead = 0;
    this.totalWritten = 0;
  }
}

/** 1.5 s buffer at 48 kHz mono */
export const RING_BUFFER_CAPACITY = 48000 * 1.5;

// ---------------------------------------------------------------------------
// 2. Loss Bridge – friendly disconnect notification
// ---------------------------------------------------------------------------

export type LossBridgeEvent =
  | { type: 'SIGNAL_LOST'; message: string }
  | { type: 'SIGNAL_RESTORED'; message: string };

type LossBridgeListener = (event: LossBridgeEvent) => void;

export class CallLossBridge {
  private listeners: LossBridgeListener[] = [];
  private lastKnownState: 'online' | 'offline' = 'online';
  private onlineHandler: () => void;
  private offlineHandler: () => void;

  constructor(private partnerName: string) {
    this.onlineHandler = () => this.handleOnline();
    this.offlineHandler = () => this.handleOffline();
  }

  start() {
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
    // Sync current state
    if (!navigator.onLine) this.handleOffline();
    console.log('📡 [LossBridge] Active – watching network transitions.');
  }

  stop() {
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
  }

  onChange(cb: LossBridgeListener): () => void {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }

  private handleOffline() {
    if (this.lastKnownState === 'offline') return;
    this.lastKnownState = 'offline';
    this.emit({
      type: 'SIGNAL_LOST',
      message: `${this.partnerName} lost signal – keeping call warm…`,
    });
  }

  private handleOnline() {
    if (this.lastKnownState === 'online') return;
    this.lastKnownState = 'online';
    this.emit({
      type: 'SIGNAL_RESTORED',
      message: 'Signal restored – reconnecting…',
    });
  }

  private emit(event: LossBridgeEvent) {
    this.listeners.forEach(cb => {
      try { cb(event); } catch (e) {}
    });
  }
}
