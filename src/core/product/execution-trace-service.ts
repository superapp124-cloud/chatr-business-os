/**
 * CHATR — Execution Trace Service (Sprint 2)
 *
 * Stores every Hero execution as an immutable append-only trace.
 * Persisted to localStorage for the 10-user study.
 * Read by the ValidationDashboard for KPI analysis.
 *
 * Schema per trace:
 * {
 *   id:               string (uuid)
 *   intent:           string
 *   intentText:       string
 *   startedAt:        number (epoch ms)
 *   completedAt:      number | null
 *   timeToFirstValue: number | null (ms — location resolved)
 *   timeToDecision:   number | null (ms — decision.completed)
 *   timeToCheckout:   number | null (ms — checkout.ready)
 *   interactionCount: number
 *   provider:         string | null
 *   mode:             'Reality Mode' | 'Demonstration Mode' | null
 *   result:           'checkout_ready' | 'location_missing' | 'error' | null
 *   events:           TraceEvent[]
 *   decisionReasons:  string[]
 *   errorMessage:     string | null
 * }
 */

export interface TraceEvent {
  type:      string;
  timestamp: number;
  elapsedMs: number;
  payload?:  Record<string, unknown>;
}

export interface ExecutionTrace {
  id:               string;
  intent:           string;
  intentText:       string;
  startedAt:        number;
  completedAt:      number | null;
  timeToFirstValue: number | null;
  timeToDecision:   number | null;
  timeToCheckout:   number | null;
  interactionCount: number;
  provider:         string | null;
  mode:             'Reality Mode' | 'Demonstration Mode' | null;
  result:           'checkout_ready' | 'location_missing' | 'error' | null;
  events:           TraceEvent[];
  decisionReasons:  string[];
  errorMessage:     string | null;
}

const STORAGE_KEY = 'chatr:execution_traces_v1';
const MAX_TRACES  = 500;

class ExecutionTraceManager {
  private _traces: ExecutionTrace[] = [];
  private _active: ExecutionTrace | null = null;

  constructor() {
    this._load();
  }

  // ── Session lifecycle ───────────────────────────────────────────────────────

  startTrace(intentText: string): string {
    const id  = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this._active = {
      id,
      intent:           '',
      intentText,
      startedAt:        Date.now(),
      completedAt:      null,
      timeToFirstValue: null,
      timeToDecision:   null,
      timeToCheckout:   null,
      interactionCount: 0,
      provider:         null,
      mode:             null,
      result:           null,
      events:           [],
      decisionReasons:  [],
      errorMessage:     null,
    };
    return id;
  }

  recordEvent(type: string, payload?: Record<string, unknown>): void {
    if (!this._active) return;
    const elapsed = Date.now() - this._active.startedAt;
    this._active.events.push({ type, timestamp: Date.now(), elapsedMs: elapsed, payload });

    // Map key events to KPI fields
    switch (type) {
      case 'hero:intent.understood':
        this._active.intent = (payload?.intent as string) || '';
        break;
      case 'hero:location.resolved':
        if (!this._active.timeToFirstValue) {
          this._active.timeToFirstValue = elapsed;
        }
        break;
      case 'hero:location.missing':
        this._active.result = 'location_missing';
        break;
      case 'hero:decision.completed':
        this._active.timeToDecision  = elapsed;
        this._active.provider        = (payload?.selectedProvider as string) || null;
        this._active.decisionReasons = (payload?.reasons as string[]) || [];
        break;
      case 'hero:checkout.ready':
        this._active.timeToCheckout = elapsed;
        this._active.mode           = (payload?.mode as ExecutionTrace['mode']) || null;
        if (!this._active.result) {
          this._active.result = 'checkout_ready';
        }
        break;
      case 'hero:error':
        this._active.result       = 'error';
        this._active.errorMessage = (payload?.message as string) || null;
        break;
    }
  }

  incrementInteraction(): void {
    if (this._active) this._active.interactionCount++;
  }

  completeTrace(): ExecutionTrace | null {
    if (!this._active) return null;
    this._active.completedAt = Date.now();
    const trace = { ...this._active };
    this._traces = [trace, ...this._traces].slice(0, MAX_TRACES);
    this._save();
    this._active = null;
    return trace;
  }

  // ── Read API ────────────────────────────────────────────────────────────────

  getAll(): ExecutionTrace[] {
    return this._traces;
  }

  getRecent(n = 10): ExecutionTrace[] {
    return this._traces.slice(0, n);
  }

  getKPIs() {
    const completed = this._traces.filter(t => t.result === 'checkout_ready');
    const avg = (arr: (number | null)[]) => {
      const valid = arr.filter((v): v is number => v !== null);
      return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
    };
    return {
      totalSessions:       this._traces.length,
      completionRate:      this._traces.length ? (completed.length / this._traces.length) : 0,
      avgTimeToFirstValue: avg(completed.map(t => t.timeToFirstValue)),
      avgTimeToDecision:   avg(completed.map(t => t.timeToDecision)),
      avgTimeToCheckout:   avg(completed.map(t => t.timeToCheckout)),
      avgInteractions:     avg(completed.map(t => t.interactionCount)),
      realityModeRate:     completed.length
        ? completed.filter(t => t.mode === 'Reality Mode').length / completed.length
        : 0,
    };
  }

  exportJSON(): string {
    return JSON.stringify({ traces: this._traces, exportedAt: new Date().toISOString() }, null, 2);
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  private _load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this._traces = JSON.parse(raw) as ExecutionTrace[];
    } catch { /* first run */ }
  }

  private _save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._traces));
    } catch { /* storage full */ }
  }
}

export const ExecutionTraceService = new ExecutionTraceManager();
