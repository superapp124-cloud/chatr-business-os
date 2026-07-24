// CHATR+ Pre-warmed Mic Stream Consumer
// VoIPPrewarmService boots a background WebView that calls getUserMedia() before
// the user answers. This hook consumes that stream so the call connects instantly
// without a fresh getUserMedia() round-trip (which takes 200-600ms on Android).

/**
 * Consume the pre-warmed audio stream that VoIPPrewarmService may have
 * acquired in the background WebView before the user tapped Answer.
 *
 * The stream is stored on window.__CHATR_PREWARM_STREAM__.
 * After consumption the reference is deleted so GC can claim it if unused.
 *
 * Returns null if no pre-warmed stream exists or all tracks are dead.
 */
export function consumePrewarmStream(): MediaStream | null {
  const w = window as any;
  const stream: MediaStream | undefined = w.__CHATR_PREWARM_STREAM__;

  if (!stream) return null;

  // Validate — tracks must still be live (prewarm could have timed out)
  const liveTracks = stream.getTracks().filter(t => t.readyState === 'live');
  if (liveTracks.length === 0) {
    console.debug('[Prewarm] Stream exists but all tracks are ended — discarding');
    delete w.__CHATR_PREWARM_STREAM__;
    return null;
  }

  // Build a new MediaStream from only the live tracks (audio only for safety)
  const audioTracks = liveTracks.filter(t => t.kind === 'audio');
  if (audioTracks.length === 0) {
    console.debug('[Prewarm] No live audio tracks in prewarm stream — discarding');
    delete w.__CHATR_PREWARM_STREAM__;
    return null;
  }

  const consumedStream = new MediaStream(audioTracks);
  delete w.__CHATR_PREWARM_STREAM__;
  console.log(`🎙️ [Prewarm] ✅ Consumed pre-warmed mic stream (${audioTracks.length} audio tracks)`);
  return consumedStream;
}

/**
 * Check if a pre-warmed stream is available without consuming it.
 */
export function hasPrewarmStream(): boolean {
  const w = window as any;
  const stream: MediaStream | undefined = w.__CHATR_PREWARM_STREAM__;
  return !!(stream && stream.getTracks().some(t => t.readyState === 'live'));
}

/**
 * Release the prewarm stream without using it (e.g., on rejected call).
 */
export function releasePrewarmStream(): void {
  const w = window as any;
  const stream: MediaStream | undefined = w.__CHATR_PREWARM_STREAM__;
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    delete w.__CHATR_PREWARM_STREAM__;
    console.debug('[Prewarm] Released unused pre-warmed stream');
  }
}
