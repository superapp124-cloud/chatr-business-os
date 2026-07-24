export type PlatformSignalingState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'degraded'
  | 'reconnecting'
  | 'fallback-active'
  | 'disconnected'
  | 'failed';

export interface SignalingHealthSnapshot {
  state: PlatformSignalingState;
  score: number;
  latencyMs: number | null;
  consecutiveFailures: number;
  lastFailureReason: string | null;
  lastTransitionAt: number;
}

export class SignalingHealthMonitor {
  private snapshot: SignalingHealthSnapshot = {
    state: 'idle',
    score: 100,
    latencyMs: null,
    consecutiveFailures: 0,
    lastFailureReason: null,
    lastTransitionAt: Date.now(),
  };

  setState(state: PlatformSignalingState): SignalingHealthSnapshot {
    if (this.snapshot.state !== state) {
      this.snapshot = {
        ...this.snapshot,
        state,
        lastTransitionAt: Date.now(),
      };
    }

    return this.getSnapshot();
  }

  recordSuccess(latencyMs?: number): SignalingHealthSnapshot {
    const latencyPenalty = typeof latencyMs === 'number' ? Math.min(30, Math.floor(latencyMs / 100)) : 0;
    this.snapshot = {
      ...this.snapshot,
      score: Math.max(40, 100 - latencyPenalty),
      latencyMs: typeof latencyMs === 'number' ? latencyMs : this.snapshot.latencyMs,
      consecutiveFailures: 0,
      lastFailureReason: null,
    };

    return this.getSnapshot();
  }

  recordFailure(reason: string): SignalingHealthSnapshot {
    const consecutiveFailures = this.snapshot.consecutiveFailures + 1;
    const state: PlatformSignalingState = consecutiveFailures >= 3 ? 'fallback-active' : 'degraded';

    this.snapshot = {
      ...this.snapshot,
      state,
      score: Math.max(0, this.snapshot.score - 25),
      consecutiveFailures,
      lastFailureReason: reason,
      lastTransitionAt: Date.now(),
    };

    return this.getSnapshot();
  }

  getSnapshot(): SignalingHealthSnapshot {
    return { ...this.snapshot };
  }
}
