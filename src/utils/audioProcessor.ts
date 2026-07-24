/**
 * Chatr+ AI Audio Processor (Phase 2)
 *
 * Builds a native Web Audio API pipeline:
 *   Mic ─► HighPass EQ (cut rumble < 80Hz)
 *        ─► LowPass  EQ (cut hiss  > 8kHz)
 *        ─► DynamicsCompressor (AGC – normalize loud/quiet speakers)
 *        ─► MediaStreamDestination (clean output track → WebRTC sender)
 *
 * NOTE: True RNNoise WebAssembly requires loading the .wasm worklet.
 * This module provides the full AudioContext pipeline so it is ready to
 * plug-in the worklet without blocking the rest of the calling stack.
 */

export interface AudioProcessorState {
  isActive: boolean;
  gainDb: number;
  inputVolume: number; // 0-1 float
}

export class AIAudioProcessor {
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private lowPassFilter: BiquadFilterNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  public processedTrack: MediaStreamTrack | null = null;
  private isSetup = false;

  constructor(private stream: MediaStream) {}

  async setup(): Promise<MediaStreamTrack | null> {
    if (this.isSetup) return this.processedTrack;

    try {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtor) {
        console.warn('⚠️ [AudioDSP] AudioContext not supported – passing through raw track.');
        return this.stream.getAudioTracks()[0] ?? null;
      }

      this.audioCtx = new AudioCtor({ sampleRate: 48000, latencyHint: 'interactive' });

      // Resume context (required after user gesture on some browsers)
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
      this.destinationNode = this.audioCtx.createMediaStreamDestination();

      // 1. High-pass filter – removes low-frequency rumble (fans, AC, traffic <80Hz)
      this.highPassFilter = this.audioCtx.createBiquadFilter();
      this.highPassFilter.type = 'highpass';
      this.highPassFilter.frequency.setValueAtTime(80, this.audioCtx.currentTime);
      this.highPassFilter.Q.setValueAtTime(0.7, this.audioCtx.currentTime);

      // 2. Low-pass filter – removes high-frequency hiss (>8kHz)
      this.lowPassFilter = this.audioCtx.createBiquadFilter();
      this.lowPassFilter.type = 'lowpass';
      this.lowPassFilter.frequency.setValueAtTime(8000, this.audioCtx.currentTime);
      this.lowPassFilter.Q.setValueAtTime(0.7, this.audioCtx.currentTime);

      // 3. Dynamics compressor (AGC) – normalize voice levels
      this.compressorNode = this.audioCtx.createDynamicsCompressor();
      this.compressorNode.threshold.setValueAtTime(-24, this.audioCtx.currentTime);
      this.compressorNode.knee.setValueAtTime(30, this.audioCtx.currentTime);
      this.compressorNode.ratio.setValueAtTime(12, this.audioCtx.currentTime);
      this.compressorNode.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
      this.compressorNode.release.setValueAtTime(0.25, this.audioCtx.currentTime);

      // 4. Analyser for real-time volume readback
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // Wire pipeline: source → highpass → lowpass → compressor → analyser → destination
      this.sourceNode.connect(this.highPassFilter);
      this.highPassFilter.connect(this.lowPassFilter);
      this.lowPassFilter.connect(this.compressorNode);
      this.compressorNode.connect(this.analyserNode);
      this.analyserNode.connect(this.destinationNode);

      this.processedTrack = this.destinationNode.stream.getAudioTracks()[0] ?? null;
      this.isSetup = true;

      console.log('🎙️ [AudioDSP] Pipeline active: HighPass(80Hz) → LowPass(8kHz) → AGC Compressor');
      return this.processedTrack;
    } catch (e) {
      console.warn('⚠️ [AudioDSP] Setup failed – using raw mic track:', e);
      return this.stream.getAudioTracks()[0] ?? null;
    }
  }

  /** Returns instantaneous input volume 0-1 */
  getInputVolume(): number {
    if (!this.analyserNode) return 0;
    const buffer = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(buffer);
    const sum = buffer.reduce((a, b) => a + b, 0);
    return sum / buffer.length / 255;
  }

  getState(): AudioProcessorState {
    return {
      isActive: this.isSetup,
      gainDb: this.compressorNode?.reduction ?? 0,
      inputVolume: this.getInputVolume(),
    };
  }

  async destroy() {
    try {
      this.sourceNode?.disconnect();
      this.highPassFilter?.disconnect();
      this.lowPassFilter?.disconnect();
      this.compressorNode?.disconnect();
      this.analyserNode?.disconnect();
      this.destinationNode?.disconnect();
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        await this.audioCtx.close();
      }
    } catch (e) {
      // Non-fatal cleanup
    }
    this.isSetup = false;
    this.processedTrack = null;
    console.log('🎙️ [AudioDSP] Pipeline destroyed.');
  }
}
