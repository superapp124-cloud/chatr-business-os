import { Capacitor } from '@capacitor/core';

/**
 * Android WebView Video Playback Helper
 *
 * Fixes the issue where video freezes on Android WebView while audio works.
 * Android WebView often delivers video tracks in "muted" state initially,
 * requiring aggressive retry logic and srcObject re-assignment.
 *
 * FIX (2026-05-20): Added playGeneration counter to prevent AbortError caused
 * by concurrent play() calls when srcObject is replaced mid-flight.
 * Stale play() callbacks check their generation and self-cancel.
 */

const isAndroidWebView = () => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};

const isAnyWebView = () => {
  return Capacitor.isNativePlatform();
};

interface VideoPlaybackOptions {
  maxRetries?: number;
  retryIntervalMs?: number;
  onPlaybackStarted?: () => void;
  onPlaybackFailed?: () => void;
}

function hasRenderedFrame(videoElement: HTMLVideoElement): boolean {
  return (
    !videoElement.paused &&
    videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    videoElement.videoWidth > 0 &&
    videoElement.videoHeight > 0
  );
}

function waitForFirstFrame(videoElement: HTMLVideoElement, timeoutMs = 2_000): Promise<boolean> {
  if (hasRenderedFrame(videoElement)) return Promise.resolve(true);

  return new Promise(resolve => {
    let settled = false;
    let removeListeners: (() => void) | null = null;

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      removeListeners?.();
      resolve(value);
    };

    const timer = window.setTimeout(() => finish(hasRenderedFrame(videoElement)), timeoutMs);
    const onReady = () => window.setTimeout(() => finish(hasRenderedFrame(videoElement)), 0);

    removeListeners = () => {
      window.clearTimeout(timer);
      videoElement.removeEventListener('loadeddata', onReady);
      videoElement.removeEventListener('playing', onReady);
      videoElement.removeEventListener('resize', onReady);
    };

    videoElement.addEventListener('loadeddata', onReady);
    videoElement.addEventListener('playing', onReady);
    videoElement.addEventListener('resize', onReady);

    const requestFrameCallback = (videoElement as any).requestVideoFrameCallback;
    if (typeof requestFrameCallback === 'function') {
      requestFrameCallback.call(videoElement, () => finish(true));
    }
  });
}

/**
 * Safely assign srcObject and play, preventing AbortError from concurrent calls.
 *
 * AbortError happens when:
 *   1. play() is called → returns a Promise
 *   2. srcObject is changed before the Promise resolves
 *   3. The browser aborts the first play() with AbortError
 *
 * Fix: we pause() first (which synchronously cancels the pending play), THEN
 * reassign srcObject, THEN play(). We also load() to reset the media pipeline.
 */
async function safeAssignAndPlay(
  videoElement: HTMLVideoElement,
  stream: MediaStream
): Promise<void> {
  // Step 1: cancel any in-flight play() by pausing first
  try { videoElement.pause(); } catch { /* ignore */ }

  // Step 2: reassign srcObject only if different
  if (videoElement.srcObject !== stream) {
    videoElement.srcObject = stream;
    videoElement.load(); // reset pipeline so next play() isn't immediately aborted
  }

  // Step 3: play muted (remote audio is on a separate <audio> element)
  videoElement.muted = true;
  videoElement.autoplay = true;
  videoElement.playsInline = true;
  await videoElement.play();
}

/**
 * Aggressive video playback retry for Android WebView.
 *
 * Strategies (in order):
 *  1. safeAssignAndPlay (pause → reassign → play)
 *  2. Retry play without touching srcObject
 *  3. srcObject force-restore + play
 *  4. Periodic retry loop up to maxRetries
 */
export function startAggressiveVideoPlayback(
  videoElement: HTMLVideoElement,
  stream: MediaStream,
  options: VideoPlaybackOptions = {}
): () => void {
  const {
    maxRetries = 10,
    retryIntervalMs = 500,
    onPlaybackStarted,
    onPlaybackFailed,
  } = options;

  let retryCount = 0;
  let retryTimer: NodeJS.Timeout | null = null;
  let isCleanedUp = false;
  let playbackStarted = false;

  const log = (msg: string) => console.log(`📺 [AndroidVideo] ${msg}`);

  const checkVideoPlaying = (): boolean => hasRenderedFrame(videoElement);

  const attemptPlay = async (): Promise<boolean> => {
    if (isCleanedUp || playbackStarted) return playbackStarted;

    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      log('No video tracks in stream');
      return false;
    }

    const track = videoTracks[0];
    log(`Attempt ${retryCount + 1}/${maxRetries}: track=${track.readyState}, muted=${track.muted}, enabled=${track.enabled}`);

    // Strategy 1: safe pause → reassign → play
    try {
      await safeAssignAndPlay(videoElement, stream);
      await waitForFirstFrame(videoElement, 1500);

      if (checkVideoPlaying()) {
        log('✅ Video playing (safe-assign)');
        playbackStarted = true;
        onPlaybackStarted?.();
        return true;
      }
    } catch (e: any) {
      log(`Safe-assign play failed: ${e.name}`);
    }

    // Strategy 2: retry play without touching srcObject
    try {
      videoElement.muted = true;
      await videoElement.play();
      await waitForFirstFrame(videoElement, 1500);

      if (checkVideoPlaying()) {
        log('✅ Video playing (direct retry)');
        playbackStarted = true;
        onPlaybackStarted?.();
        return true;
      }
    } catch (e: any) {
      log(`Direct play failed: ${e.name}`);
    }

    // Strategy 3: force srcObject restore if browser detached it
    if (videoElement.srcObject !== stream) {
      log('Restoring detached srcObject');
      try {
        await safeAssignAndPlay(videoElement, stream);
        await waitForFirstFrame(videoElement, 1500);

        if (checkVideoPlaying()) {
          log('✅ Video playing (srcObject restore)');
          playbackStarted = true;
          onPlaybackStarted?.();
          return true;
        }
      } catch (e) {
        log('srcObject restore play failed');
      }
    }

    return false;
  };

  const retryLoop = async () => {
    if (isCleanedUp || playbackStarted) return;

    const success = await attemptPlay();

    if (!success && retryCount < maxRetries) {
      retryCount++;
      retryTimer = setTimeout(retryLoop, retryIntervalMs);
    } else if (!success) {
      log(`❌ Video playback failed after ${maxRetries} attempts`);
      onPlaybackFailed?.();
    }
  };

  // Initial setup — use safeAssignAndPlay to avoid AbortError from start
  videoElement.autoplay = true;
  videoElement.playsInline = true;
  videoElement.muted = true;
  if (videoElement.srcObject !== stream) {
    videoElement.srcObject = stream;
  }

  retryLoop();

  // Track event handlers for recovery
  const videoTracks = stream.getVideoTracks();
  const trackHandlers: Array<{ track: MediaStreamTrack; handler: () => void }> = [];

  videoTracks.forEach(track => {
    const onUnmute = () => {
      log('Track unmuted - attempting play');
      if (!playbackStarted && videoElement) {
        attemptPlay();
      }
    };

    const onEnded = () => {
      log('⚠️ Video track ended');
      if (!isCleanedUp) {
        onPlaybackFailed?.();
      }
    };

    track.onunmute = onUnmute;
    track.onended = onEnded;
    track.onmute = () => log('Track muted');

    trackHandlers.push({ track, handler: onUnmute });
  });

  return () => {
    isCleanedUp = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    trackHandlers.forEach(({ track }) => {
      track.onunmute = null;
      track.onended = null;
      track.onmute = null;
    });
    log('Cleanup complete');
  };
}

/**
 * Attach comprehensive track event handlers for video recovery
 */
export function attachVideoTrackRecoveryHandlers(
  stream: MediaStream,
  videoElement: HTMLVideoElement,
  onVideoActive: (active: boolean) => void
): () => void {
  const log = (msg: string) => console.log(`📺 [TrackRecovery] ${msg}`);
  const cleanupFns: Array<() => void> = [];

  const handleTrackChange = async () => {
    const videoTracks = stream.getVideoTracks();

    const hasActiveVideo = videoTracks.some(t => t.enabled && t.readyState === 'live');
    const hasAnyVideo = videoTracks.length > 0;

    log(`Track change: ${videoTracks.length} tracks, active=${hasActiveVideo}, any=${hasAnyVideo}`);

    if (hasAnyVideo && videoElement) {
      try {
        await safeAssignAndPlay(videoElement, stream);
        const firstFrameRendered = await waitForFirstFrame(videoElement, 2000);

        if (hasActiveVideo && firstFrameRendered && hasRenderedFrame(videoElement)) {
          onVideoActive(true);
        } else {
          log('Video track is present, but no decoded frame is rendering yet');
          onVideoActive(false);
        }
      } catch (e) {
        log('Recovery play failed');
        onVideoActive(false);
      }
    } else {
      onVideoActive(false);
    }
  };

  stream.onaddtrack = (e) => {
    log(`Track added: ${e.track.kind}`);
    if (e.track.kind === 'video') {
      attachTrackHandlers(e.track);
      handleTrackChange();
    }
  };

  stream.onremovetrack = (e) => {
    log(`Track removed: ${e.track.kind}`);
    if (e.track.kind === 'video') {
      handleTrackChange();
    }
  };

  const attachTrackHandlers = (track: MediaStreamTrack) => {
    if (track.kind !== 'video') return;

    track.onunmute = () => {
      log('Video unmuted');
      handleTrackChange();
    };

    track.onmute = () => {
      log('Video muted');
      onVideoActive(false);
    };

    track.onended = () => {
      log('Video ended');
      onVideoActive(false);
    };
  };

  stream.getVideoTracks().forEach(attachTrackHandlers);

  cleanupFns.push(() => {
    stream.onaddtrack = null;
    stream.onremovetrack = null;
    stream.getVideoTracks().forEach(track => {
      track.onunmute = null;
      track.onmute = null;
      track.onended = null;
    });
  });

  return () => cleanupFns.forEach(fn => fn());
}
