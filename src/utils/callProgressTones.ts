import { Capacitor } from '@capacitor/core';
import { stopAllRingtones } from '@/hooks/useNativeRingtone';

export type CallProgressTone =
  | 'RINGBACK'
  | 'BUSY'
  | 'FAILED'
  | 'ENDED'
  | 'RECONNECTING';

export type CallProgressAudioState =
  | 'IDLE'
  | 'CALLING'
  | 'RINGING'
  | 'BUSY'
  | 'RECONNECTING'
  | 'CONNECTED'
  | 'FAILED'
  | 'TIMEOUT'
  | 'UNREACHABLE'
  | 'REJECTED'
  | 'ENDED';

export type CallProgressToneEndedEvent = {
  callId?: string | null;
  tone: CallProgressTone;
  reason?: string;
};

export const BUSY_TONE_AUTO_END_MS = 6_500;
export const FAILED_TONE_AUTO_END_MS = 1_150;

export const CALL_PROGRESS_SIGNALING_EVENTS = [
  'CALL_RINGING',
  'CALL_BUSY',
  'CALL_REJECTED',
  'CALL_TIMEOUT',
  'CALL_RECONNECTING',
  'CALL_CONNECTED',
  'CALL_FAILED',
  'CALL_ENDED',
] as const;

type PlayOptions = {
  callId?: string | null;
  variant?: 'default' | 'secure' | 'business' | 'international' | 'ai';
};

const normalizeTone = (tone: CallProgressTone): CallProgressTone => tone;
let activeToneKey: string | null = null;

const toneKey = (tone: CallProgressTone, options: PlayOptions = {}) =>
  `${options.callId ?? 'global'}:${tone}:${options.variant ?? 'default'}`;

export function playCallProgressTone(tone: CallProgressTone, options: PlayOptions = {}): boolean {
  const normalizedTone = normalizeTone(tone);
  const nextToneKey = toneKey(normalizedTone, options);

  if (activeToneKey === nextToneKey) {
    return true;
  }

  try {
    stopAllRingtones();
  } catch {
    // Ringtone cleanup is best-effort. Native tone playback should still proceed.
  }

  if (typeof window === 'undefined') return false;

  const bridge = window.ChatrCall;
  if (Capacitor.isNativePlatform() && bridge?.playCallProgressTone) {
    try {
      bridge.playCallProgressTone(
        normalizedTone,
        options.callId ?? null,
        options.variant ?? 'default',
      );
      activeToneKey = nextToneKey;
      return true;
    } catch (error) {
      console.warn('[CallProgressTone] Native play failed:', error);
      return false;
    }
  }

  console.debug('[CallProgressTone] Native tone bridge unavailable:', normalizedTone);
  return false;
}

export function stopCallProgressTone(): boolean {
  activeToneKey = null;

  if (typeof window === 'undefined') return false;

  const bridge = window.ChatrCall;
  if (Capacitor.isNativePlatform() && bridge?.stopCallProgressTone) {
    try {
      bridge.stopCallProgressTone();
      return true;
    } catch (error) {
      console.warn('[CallProgressTone] Native stop failed:', error);
      return false;
    }
  }

  return false;
}

export function pauseCallProgressTone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.ChatrCall?.pauseCallProgressTone?.();
    return true;
  } catch (error) {
    console.warn('[CallProgressTone] Native pause failed:', error);
    return false;
  }
}

export function resumeCallProgressTone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.ChatrCall?.resumeCallProgressTone?.();
    return true;
  } catch (error) {
    console.warn('[CallProgressTone] Native resume failed:', error);
    return false;
  }
}

export function setCallProgressToneMuted(muted: boolean): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.ChatrCall?.setCallProgressToneMuted?.(muted);
    return true;
  } catch (error) {
    console.warn('[CallProgressTone] Native mute update failed:', error);
    return false;
  }
}

export function onNativeCallProgressToneEnded(
  handler: (event: CallProgressToneEndedEvent) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<CallProgressToneEndedEvent>;
    if (customEvent.detail?.tone) {
      handler(customEvent.detail);
    }
  };

  window.addEventListener('nativeCallProgressToneEnded', listener);
  return () => window.removeEventListener('nativeCallProgressToneEnded', listener);
}

export function toneForCallStatus(status?: string | null): CallProgressTone | null {
  switch (status) {
    case 'ringing':
      return 'RINGBACK';
    case 'busy':
      return 'BUSY';
    case 'failed':
    case 'timeout':
    case 'missed':
      return 'FAILED';
    case 'ended':
    case 'declined':
    case 'rejected':
      return 'ENDED';
    default:
      return null;
  }
}

export function toneForCallProgressState(state: CallProgressAudioState): CallProgressTone | null {
  switch (state) {
    case 'CALLING':
    case 'RINGING':
      return 'RINGBACK';
    case 'BUSY':
      return 'BUSY';
    case 'RECONNECTING':
      return 'RECONNECTING';
    case 'FAILED':
    case 'TIMEOUT':
    case 'UNREACHABLE':
      return 'FAILED';
    case 'REJECTED':
    case 'ENDED':
      return 'ENDED';
    case 'CONNECTED':
    case 'IDLE':
    default:
      return null;
  }
}

export class CallProgressToneStateManager {
  private activeCallId: string | null = null;
  private state: CallProgressAudioState = 'IDLE';

  transition(
    state: CallProgressAudioState,
    options: PlayOptions & { stopOnlyForCall?: boolean } = {},
  ): boolean {
    this.state = state;

    const tone = toneForCallProgressState(state);
    if (!tone) {
      const stopped = this.stop(options.callId ?? null, options.stopOnlyForCall ?? true);
      this.state = state;
      return stopped;
    }

    this.activeCallId = options.callId ?? null;
    return playCallProgressTone(tone, options);
  }

  stop(callId?: string | null, stopOnlyForCall = true): boolean {
    if (stopOnlyForCall && callId && this.activeCallId && this.activeCallId !== callId) {
      return false;
    }

    this.activeCallId = null;
    this.state = 'IDLE';
    return stopCallProgressTone();
  }

  currentState(): CallProgressAudioState {
    return this.state;
  }
}

export const callProgressToneStateManager = new CallProgressToneStateManager();
