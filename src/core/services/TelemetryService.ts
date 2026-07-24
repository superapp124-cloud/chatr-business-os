/**
 * CHATR Telemetry Service
 * 
 * Records every event in the commitment lifecycle.
 * Enables: capability failure rates, ignored suggestions, slow playbooks.
 */

const TELEMETRY_KEY = 'chatr_telemetry_v1';
const MAX_EVENTS = 1000; // Rolling window

export type TelemetryEvent =
  | 'detected'
  | 'resolved'
  | 'suggested'
  | 'ignored'        // suggested → cancelled
  | 'confirmed'
  | 'extracting'
  | 'needs_input'
  | 'searching'
  | 'preview_ready'
  | 'executed'
  | 'execution_failed'
  | 'verified'
  | 'verification_failed'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface TelemetryRecord {
  id: string;
  commitmentId: string;
  capability: string;
  event: TelemetryEvent;
  timestamp: string;           // ISO
  durationMs?: number;         // ms since previous event for this commitment
  provider?: string;
  error?: string;
  metadata?: Record<string, any>;
}

class TelemetryServiceImpl {
  private static instance: TelemetryServiceImpl;
  private records: TelemetryRecord[] = [];
  private lastEventTime: Map<string, number> = new Map(); // commitmentId → timestamp

  private constructor() {
    this.load();
  }

  public static getInstance(): TelemetryServiceImpl {
    if (!TelemetryServiceImpl.instance) {
      TelemetryServiceImpl.instance = new TelemetryServiceImpl();
    }
    return TelemetryServiceImpl.instance;
  }

  private load(): void {
    try {
      const saved = localStorage.getItem(TELEMETRY_KEY);
      if (saved) this.records = JSON.parse(saved);
    } catch { /* ignore */ }
  }

  private save(): void {
    try {
      if (this.records.length > MAX_EVENTS) {
        this.records = this.records.slice(-MAX_EVENTS);
      }
      localStorage.setItem(TELEMETRY_KEY, JSON.stringify(this.records));
    } catch { /* ignore */ }
  }

  public init() {
    // Dynamically import EventBus to avoid circular dependencies if any
    import('../runtime/EventBus').then(({ eventBus }) => {
      eventBus.onAny((evt) => {
        this.track({
          commitmentId: evt.correlationId || evt.id,
          capability: evt.source,
          event: evt.type as TelemetryEvent,
          metadata: evt.payload as any,
          provider: 'eventBus'
        });
      });
    });
  }

  public track(params: {
    commitmentId: string;
    capability: string;
    event: TelemetryEvent;
    provider?: string;
    error?: string;
    metadata?: Record<string, any>;
  }): void {
    const now = Date.now();
    const last = this.lastEventTime.get(params.commitmentId);

    const record: TelemetryRecord = {
      id: crypto.randomUUID(),
      commitmentId: params.commitmentId,
      capability: params.capability,
      event: params.event,
      timestamp: new Date(now).toISOString(),
      durationMs: last ? now - last : undefined,
      provider: params.provider,
      error: params.error,
      metadata: params.metadata,
    };

    this.lastEventTime.set(params.commitmentId, now);
    this.records.push(record);
    this.save();

    console.log(`[Telemetry] ${params.capability} → ${params.event}${params.error ? ` ERROR: ${params.error}` : ''}${record.durationMs ? ` (${record.durationMs}ms)` : ''}`);
  }

  // ─── Analytics ──────────────────────────────────────────────────────────────

  public getStats(): {
    totalCommitments: number;
    completionRate: number;
    ignoreRate: number;
    byCapability: Record<string, { completed: number; cancelled: number; errors: number }>;
    avgDuration: Record<string, number>;
  } {
    const byCapability: Record<string, { completed: number; cancelled: number; errors: number }> = {};
    const durations: Record<string, number[]> = {};

    this.records.forEach(r => {
      if (!byCapability[r.capability]) {
        byCapability[r.capability] = { completed: 0, cancelled: 0, errors: 0 };
      }
      if (r.event === 'completed') byCapability[r.capability].completed++;
      if (r.event === 'cancelled' || r.event === 'ignored') byCapability[r.capability].cancelled++;
      if (r.event === 'error' || r.event === 'execution_failed') byCapability[r.capability].errors++;
      if (r.durationMs && r.event === 'completed') {
        if (!durations[r.capability]) durations[r.capability] = [];
        durations[r.capability].push(r.durationMs);
      }
    });

    const totalCompleted = Object.values(byCapability).reduce((s, v) => s + v.completed, 0);
    const totalCancelled = Object.values(byCapability).reduce((s, v) => s + v.cancelled, 0);
    const total = totalCompleted + totalCancelled;

    const avgDuration: Record<string, number> = {};
    Object.entries(durations).forEach(([cap, times]) => {
      avgDuration[cap] = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
    });

    return {
      totalCommitments: total,
      completionRate: total > 0 ? Math.round((totalCompleted / total) * 100) : 0,
      ignoreRate: total > 0 ? Math.round((totalCancelled / total) * 100) : 0,
      byCapability,
      avgDuration,
    };
  }

  public getRecordsFor(commitmentId: string): TelemetryRecord[] {
    return this.records.filter(r => r.commitmentId === commitmentId);
  }

  public clearAll(): void {
    this.records = [];
    this.lastEventTime.clear();
    localStorage.removeItem(TELEMETRY_KEY);
  }
}

export const telemetry = TelemetryServiceImpl.getInstance();
