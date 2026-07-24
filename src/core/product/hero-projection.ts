/**
 * CHATR — Hero Projection (Sprint 2)
 *
 * Sits between the Kernel IPC event stream and the Hero UI.
 * Maps raw kernel events → TimelineStage[].
 *
 * The Hero UI never depends on kernel event names.
 * If the kernel renames an event, only this file changes.
 *
 * Usage:
 *   const projection = new HeroProjection({ onStageUpdate, onDecision, onCheckout, onError });
 *   projection.attach();   // subscribe to electronAPI events
 *   projection.detach();   // cleanup on unmount
 */

import type { TimelineStage } from '../../components/hero/DecisionTimeline';

export interface HeroDecision {
  selectedProvider: string;
  alternatives: number;
  confidence: number;
  reasons: string[];
  durationMs: number;
}

export interface HeroCheckout {
  mode: 'Reality Mode' | 'Demonstration Mode';
  provider: string;
  checkoutUrl: string | null;
  demoReason: string | null;
  options: unknown[];
  durationMs: number;
}

export interface HeroProjectionCallbacks {
  onStageUpdate: (stages: TimelineStage[]) => void;
  onDecision?:   (decision: HeroDecision) => void;
  onCheckout?:   (checkout: HeroCheckout) => void;
  onLocationMissing?: () => void;
  onError?:      (message: string) => void;
}

// ─── Stage Definitions ────────────────────────────────────────────────────────
// Order defines visual rendering order in the timeline.
const STAGE_DEFS: Array<{ id: string; label: string; detail: string; parallel?: boolean }> = [
  { id: 'intent',    label: 'Intent understood',    detail: '...' },
  { id: 'location',  label: 'GPS location found',   detail: '...' },
  { id: 'session',   label: 'Sessions pre-warmed',  detail: 'Zomato · Swiggy',   parallel: true },
  { id: 'payment',   label: 'Payment ready',         detail: 'UPI',                parallel: true },
  { id: 'address',   label: 'Address confirmed',     detail: '...',                parallel: true },
  { id: 'discover',  label: 'Searching providers',   detail: '...' },
  { id: 'decision',  label: 'Best option selected',  detail: '...' },
  { id: 'checkout',  label: 'Checkout prepared',     detail: '...' },
];

// ─── HeroProjection Class ─────────────────────────────────────────────────────

export class HeroProjection {
  private _stages: TimelineStage[];
  private _callbacks: HeroProjectionCallbacks;
  private _handlers: Array<{ topic: string; fn: (...args: unknown[]) => void }> = [];
  private _t0 = 0;

  constructor(callbacks: HeroProjectionCallbacks) {
    this._callbacks = callbacks;
    this._stages = STAGE_DEFS.map(d => ({
      id:       d.id,
      label:    d.label,
      detail:   d.detail,
      status:   'pending' as const,
      ms:       0,
      parallel: d.parallel,
    }));
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  attach(): void {
    this._t0 = Date.now();
    const api = (window as Window & { electronAPI?: Record<string, (ch: string, fn: (...a: unknown[]) => void) => void> }).electronAPI;
    if (!api?.on) {
      console.warn('[HeroProjection] electronAPI not available — running in browser mode (demo only)');
      return;
    }

    this._register('hero:intent.understood',         this._onIntentUnderstood.bind(this));
    this._register('hero:location.resolved',          this._onLocationResolved.bind(this));
    this._register('hero:location.missing',           this._onLocationMissing.bind(this));
    this._register('hero:context.resolved',           this._onContextResolved.bind(this));
    this._register('hero:provider.discovery.started', this._onDiscoveryStarted.bind(this));
    this._register('hero:provider.discovery.completed', this._onDiscoveryCompleted.bind(this));
    this._register('hero:decision.completed',         this._onDecisionCompleted.bind(this));
    this._register('hero:checkout.ready',             this._onCheckoutReady.bind(this));
    this._register('hero:error',                      this._onError.bind(this));
  }

  detach(): void {
    const api = (window as Window & { electronAPI?: Record<string, (ch: string, fn: (...a: unknown[]) => void) => void> }).electronAPI;
    if (!api?.off) return;
    this._handlers.forEach(({ topic, fn }) => api.off(topic, fn));
    this._handlers = [];
  }

  reset(): void {
    this._stages = STAGE_DEFS.map(d => ({
      id: d.id, label: d.label, detail: d.detail,
      status: 'pending' as const, ms: 0, parallel: d.parallel,
    }));
    this._t0 = Date.now();
    this._emit();
  }

  // ── Event Handlers (Kernel → UI mapping) ────────────────────────────────────

  private _onIntentUnderstood(e: { intent: string; cuisine?: string; mode?: string; _elapsed: number }): void {
    const detail = e.cuisine ? `${e.cuisine} · near me` :
                   e.mode    ? `${e.mode} · transit`    : e.intent;
    this._update('intent', 'done', detail, e._elapsed);
    this._update('session', 'active', 'Warming sessions...');
    this._update('payment', 'active', 'Checking payment...');
    this._update('address', 'active', 'Loading address...');
  }

  private _onLocationResolved(e: {
    city: string; lat?: number; lng?: number;
    confidence: number; source: string; ageSeconds: number | null; _elapsed: number;
  }): void {
    const src = e.source === 'kernel-cache' ? `Cached · ${e.ageSeconds}s ago` :
                e.source === 'kernel-fresh'  ? 'GPS'   :
                e.source === 'context-engine'? 'Context' : e.source;
    this._update('location', 'done', `${e.city}  ·  ${src}`, e._elapsed);
  }

  private _onLocationMissing(_e: unknown): void {
    this._update('location', 'error', 'Location unavailable');
    this._callbacks.onLocationMissing?.();
  }

  private _onContextResolved(e: {
    sessions: string[]; paymentMethod: string; deliveryAddress: string; _elapsed: number;
  }): void {
    this._update('session', 'done', e.sessions.join(' · '), e._elapsed);
    this._update('payment', 'done', e.paymentMethod,         e._elapsed);
    this._update('address', 'done', e.deliveryAddress,       e._elapsed);
  }

  private _onDiscoveryStarted(e: { intent: string; _elapsed: number }): void {
    this._update('discover', 'active', `Querying providers…`, e._elapsed);
  }

  private _onDiscoveryCompleted(e: { count: number; provider: string; _elapsed: number }): void {
    this._update('discover', 'done', `${e.count} options · via ${e.provider}`, e._elapsed);
    this._update('decision', 'active', 'Ranking by your preferences…');
  }

  private _onDecisionCompleted(e: HeroDecision & { _elapsed: number }): void {
    const topReason = e.reasons?.[0] || 'Best match';
    this._update('decision', 'done', `${e.selectedProvider}  ·  ${topReason}`, e._elapsed);
    this._update('checkout', 'active', 'Preparing checkout…');
    this._callbacks.onDecision?.({ ...e });
  }

  private _onCheckoutReady(e: HeroCheckout & { _elapsed: number }): void {
    const detail = e.mode === 'Reality Mode'
      ? `${e.provider}  ·  Checkout ready`
      : `${e.provider}  ·  Demo mode (provider blocked)`;
    this._update('checkout', 'done', detail, e._elapsed);
    this._callbacks.onCheckout?.({ ...e });
  }

  private _onError(e: { message: string }): void {
    this._callbacks.onError?.(e.message);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private _update(id: string, status: TimelineStage['status'], detail: string, ms?: number): void {
    this._stages = this._stages.map(s =>
      s.id === id
        ? { ...s, status, detail, ms: ms ?? (Date.now() - this._t0) }
        : s
    );
    this._emit();
  }

  private _emit(): void {
    this._callbacks.onStageUpdate([...this._stages]);
  }

  private _register(topic: string, fn: (...args: unknown[]) => void): void {
    const api = (window as Window & { electronAPI?: Record<string, (ch: string, fn: (...a: unknown[]) => void) => void> }).electronAPI;
    api?.on(topic, fn);
    this._handlers.push({ topic, fn });
  }
}
