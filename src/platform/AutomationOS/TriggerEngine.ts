/**
 * TriggerEngine.ts
 * ----------------
 * Central orchestrator for all AutomationOS trigger sources.
 *
 * The TriggerEngine acts as the fan-in point between heterogeneous trigger
 * adapters (cron jobs, webhooks, manual invocations, API calls, DB change
 * events, file arrivals, imports) and the execution queue in Supabase.
 *
 * Lifecycle:
 *   1. Register one or more typed trigger handlers via `register()`.
 *   2. Call `start()` to begin polling / listening.
 *   3. Call `stop()` to gracefully shut down.
 *
 * Phase 4 – AutomationOS Core
 */

import { supabase } from '@/integrations/supabase/client';
import { normalizeEvent, NormalizedEvent, TriggerType } from './NormalizedEvent';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** A registered trigger handler paired with its declared type. */
interface TriggerRegistration {
  type: TriggerType;
  handler: () => Promise<any>;
}

/** Shape of a row inserted into the `execution_queue` Supabase table. */
interface ExecutionQueueRow {
  id: string;
  correlation_id: string;
  trigger_type: TriggerType;
  payload: Record<string, any>;
  tenant_id: string | null;
  actor_id: string | null;
  workflow_id: string | null;
  timestamp: string;
  metadata: Record<string, any>;
  status: 'pending';
  created_at: string;
}

// ---------------------------------------------------------------------------
// TriggerEngine
// ---------------------------------------------------------------------------

/**
 * `TriggerEngine` – fan-in hub that normalizes trigger outputs and
 * forwards them to the Supabase `execution_queue` table.
 *
 * Designed as a singleton; import `triggerEngine` rather than constructing
 * a new instance directly.
 */
export class TriggerEngine {
  /** All currently registered trigger sources. */
  private readonly registrations: TriggerRegistration[] = [];

  /** Timer handles returned by `setInterval` – one per polling registration. */
  private readonly pollingHandles: ReturnType<typeof setInterval>[] = [];

  /**
   * Whether the engine has been started.  Prevents duplicate `start()` calls
   * and allows handlers to check engine state.
   */
  private running = false;

  /**
   * How often (ms) the engine polls registered handlers when using the
   * built-in polling loop.  Individual adapters that rely on push-based
   * delivery (e.g. webhooks) should bypass this and call `emit()` directly.
   */
  private readonly pollingIntervalMs: number;

  constructor(pollingIntervalMs = 5_000) {
    this.pollingIntervalMs = pollingIntervalMs;
  }

  // ── Registration ─────────────────────────────────────────────────────────

  /**
   * Register a trigger source with the engine.
   *
   * The `handler` is a zero-argument async function that resolves to the raw
   * event payload emitted by that trigger source.  The engine will:
   *   1. Call `handler()` on each poll cycle (or immediately if push-based).
   *   2. Normalize the result via `normalizeEvent(raw, type)`.
   *   3. Insert the normalized event into `execution_queue`.
   *
   * @param type    The `TriggerType` discriminant for this source.
   * @param handler Async factory that returns the raw trigger payload.
   *
   * @example
   * triggerEngine.register('cron', async () => ({
   *   workflow_id: 'wf_daily_digest',
   *   tenant_id: 'acme-corp',
   * }));
   */
  register(type: TriggerType, handler: () => Promise<any>): void {
    if (this.running) {
      console.warn(
        `[TriggerEngine] Registering trigger of type "${type}" while engine is already running. ` +
          'The new handler will be picked up on the next polling cycle.',
      );
    }
    this.registrations.push({ type, handler });
    console.info(`[TriggerEngine] Registered trigger source: "${type}"`);
  }

  // ── Emission ──────────────────────────────────────────────────────────────

  /**
   * Normalize a raw payload and write it to the execution queue.
   *
   * This method can be called directly by push-based trigger adapters
   * (e.g. an Express webhook route handler) without going through the
   * polling loop.
   *
   * @param raw   Raw payload from the trigger source.
   * @param type  TriggerType discriminant.
   * @returns     The fully formed `NormalizedEvent` that was queued, or `null`
   *              if the insert failed.
   */
  async emit(raw: any, type: TriggerType): Promise<NormalizedEvent | null> {
    const event = normalizeEvent(raw, type);

    const row: ExecutionQueueRow = {
      id: event.id,
      correlation_id: event.correlation_id,
      trigger_type: event.trigger_type,
      payload: event.payload,
      tenant_id: event.tenant_id ?? null,
      actor_id: event.actor_id ?? null,
      workflow_id: event.workflow_id ?? null,
      timestamp: event.timestamp,
      metadata: event.metadata,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('execution_queue').insert(row);

    if (error) {
      console.error(
        `[TriggerEngine] Failed to insert event "${event.id}" (type: "${type}") into execution_queue:`,
        error,
      );
      return null;
    }

    console.info(
      `[TriggerEngine] Queued event "${event.id}" (type: "${type}", correlation: "${event.correlation_id}")`,
    );
    return event;
  }

  // ── Polling loop internals ────────────────────────────────────────────────

  /**
   * Execute a single registered handler and forward the result to `emit()`.
   * Errors are caught and logged – they must never propagate up to the
   * polling scheduler, as that would break all subsequent poll cycles.
   */
  private async runHandler(registration: TriggerRegistration): Promise<void> {
    const { type, handler } = registration;
    try {
      const raw = await handler();
      // If the handler returns null/undefined it signals "nothing to emit".
      if (raw === null || raw === undefined) return;
      await this.emit(raw, type);
    } catch (err) {
      console.error(`[TriggerEngine] Handler for trigger type "${type}" threw:`, err);
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Start the polling loop for all registered handlers.
   *
   * Each registered handler gets its own `setInterval` so that a slow
   * handler cannot starve faster ones.  If `start()` is called while already
   * running, this is a no-op (with a warning).
   */
  start(): void {
    if (this.running) {
      console.warn('[TriggerEngine] start() called while engine is already running. Ignoring.');
      return;
    }

    this.running = true;
    console.info(
      `[TriggerEngine] Starting with ${this.registrations.length} registered trigger(s). ` +
        `Polling interval: ${this.pollingIntervalMs}ms`,
    );

    for (const registration of this.registrations) {
      // Run immediately on start so there is no initial delay.
      void this.runHandler(registration);

      const handle = setInterval(
        () => void this.runHandler(registration),
        this.pollingIntervalMs,
      );
      this.pollingHandles.push(handle);
    }
  }

  /**
   * Stop all polling loops and mark the engine as idle.
   *
   * In-flight handler invocations are NOT cancelled – they will complete
   * normally but their results will be silently discarded.  To wait for
   * them, drain the queue before calling `stop()`.
   */
  stop(): void {
    if (!this.running) {
      console.warn('[TriggerEngine] stop() called while engine is not running. Ignoring.');
      return;
    }

    for (const handle of this.pollingHandles) {
      clearInterval(handle);
    }
    this.pollingHandles.length = 0;
    this.running = false;

    console.info('[TriggerEngine] Stopped. All polling loops cleared.');
  }

  /** Read-only accessor for engine state. */
  get isRunning(): boolean {
    return this.running;
  }

  /** How many trigger sources are currently registered. */
  get registrationCount(): number {
    return this.registrations.length;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/**
 * Application-wide singleton instance.
 *
 * Import this directly in trigger adapter modules:
 * @example
 * import { triggerEngine } from '@/platform/AutomationOS/TriggerEngine';
 *
 * triggerEngine.register('webhook', async () => webhookBuffer.flush());
 * triggerEngine.start();
 */
export const triggerEngine = new TriggerEngine();
