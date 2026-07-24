/**
 * NormalizedEvent.ts
 * ------------------
 * Universal event envelope for the CHATR AutomationOS trigger pipeline.
 * Every trigger source (cron, webhook, manual, api, db_change, file_arrival, import)
 * MUST normalize its raw output into a NormalizedEvent before the payload
 * is handed off to the execution queue.
 *
 * Phase 4 – AutomationOS Core
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * All first-class trigger types recognized by the AutomationOS.
 * New trigger adapters must be added here before they can be registered
 * with the TriggerEngine.
 */
export type TriggerType =
  | 'cron'
  | 'webhook'
  | 'manual'
  | 'api'
  | 'db_change'
  | 'file_arrival'
  | 'import';

/**
 * The canonical, source-agnostic event envelope that flows through the
 * entire AutomationOS execution pipeline.
 *
 * Fields marked `?` are optional and may be enriched by downstream
 * middleware (e.g. context resolvers, tenant injectors).
 */
export interface NormalizedEvent {
  /** UUID v4 – unique identifier for this specific event instance. */
  id: string;

  /**
   * Correlation identifier used to trace a logical chain of events across
   * multiple workflow executions, retries, and async hops.
   * If not supplied by the source, a fresh UUID is generated.
   */
  correlation_id: string;

  /** Discriminated union identifying the origin trigger mechanism. */
  trigger_type: TriggerType;

  /**
   * The source-specific payload, passed through without mutation.
   * Downstream steps receive the raw data exactly as the trigger provided it.
   */
  payload: Record<string, any>;

  /** Tenant scope – populated from auth context or trigger configuration. */
  tenant_id?: string;

  /**
   * Actor who initiated the trigger (user UUID, service account ID, etc.).
   * For automated triggers this will typically be a system service-account ID.
   */
  actor_id?: string;

  /** ID of the workflow definition that should process this event. */
  workflow_id?: string;

  /** ISO-8601 timestamp of when the normalized event was created. */
  timestamp: string;

  /**
   * Arbitrary key-value pairs for tracing, feature flags, routing hints,
   * and other cross-cutting concerns that don't belong in the payload.
   */
  metadata: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a RFC 4122-compliant v4 UUID.
 * Uses `crypto.randomUUID()` when available (Node 14.17+, modern browsers)
 * and falls back to a Math.random()-based implementation for environments
 * that don't yet expose the Web Crypto API at the global level.
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback – RFC 4122 v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * `normalizeEvent` – the single authoritative factory for creating
 * `NormalizedEvent` instances.
 *
 * Every trigger adapter in the system MUST call this function instead of
 * constructing the envelope manually. This guarantees:
 *  1. A consistent, validated shape regardless of source.
 *  2. Automatic ID and timestamp generation when not provided by the caller.
 *  3. A stable contract that downstream pipeline stages can rely on.
 *
 * @param raw   The raw object emitted by the trigger adapter.  May be anything.
 * @param type  The `TriggerType` string that identifies the trigger source.
 * @returns     A fully-formed `NormalizedEvent` ready for the execution queue.
 *
 * @example
 * // Inside a webhook trigger adapter:
 * const event = normalizeEvent(req.body, 'webhook');
 * await supabase.from('execution_queue').insert(event);
 */
export function normalizeEvent(raw: any, type: TriggerType): NormalizedEvent {
  const now = new Date().toISOString();

  // ── Identity ──────────────────────────────────────────────────────────────
  const id: string =
    typeof raw?.id === 'string' && raw.id.length > 0 ? raw.id : generateUUID();

  const correlation_id: string =
    typeof raw?.correlation_id === 'string' && raw.correlation_id.length > 0
      ? raw.correlation_id
      : generateUUID();

  // ── Payload ───────────────────────────────────────────────────────────────
  // If `raw` is already an object we expose it as-is under `payload`.
  // Primitive values are wrapped so the contract is never violated.
  let payload: Record<string, any>;
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    // Shallow-clone to avoid mutating caller's object; strip envelope fields
    // that we promote to top-level NormalizedEvent properties.
    const {
      id: _id,
      correlation_id: _cid,
      tenant_id: _tid,
      actor_id: _aid,
      workflow_id: _wid,
      timestamp: _ts,
      metadata: _meta,
      payload: innerPayload,
      ...rest
    } = raw;

    // If the source already wrapped its data in a `payload` key, unwrap it.
    payload = innerPayload !== undefined ? innerPayload : rest;
  } else {
    payload = { value: raw };
  }

  // ── Optional contextual fields ────────────────────────────────────────────
  const tenant_id: string | undefined =
    typeof raw?.tenant_id === 'string' ? raw.tenant_id : undefined;

  const actor_id: string | undefined =
    typeof raw?.actor_id === 'string' ? raw.actor_id : undefined;

  const workflow_id: string | undefined =
    typeof raw?.workflow_id === 'string' ? raw.workflow_id : undefined;

  // ── Metadata ──────────────────────────────────────────────────────────────
  const incomingMeta: Record<string, any> =
    raw?.metadata !== null &&
    raw?.metadata !== undefined &&
    typeof raw.metadata === 'object' &&
    !Array.isArray(raw.metadata)
      ? raw.metadata
      : {};

  const metadata: Record<string, any> = {
    ...incomingMeta,
    normalized_at: now,
    source_trigger_type: type,
  };

  // ── Assemble ──────────────────────────────────────────────────────────────
  const event: NormalizedEvent = {
    id,
    correlation_id,
    trigger_type: type,
    payload,
    timestamp: typeof raw?.timestamp === 'string' ? raw.timestamp : now,
    metadata,
  };

  if (tenant_id !== undefined) event.tenant_id = tenant_id;
  if (actor_id !== undefined) event.actor_id = actor_id;
  if (workflow_id !== undefined) event.workflow_id = workflow_id;

  return event;
}
