/**
 * AuditLogger.ts
 * --------------
 * Fault-tolerant audit logging service for the CHATR platform.
 *
 * Writes structured audit records to the Supabase `audit_logs` table.
 * The logger is designed to be called from any execution context (workflows,
 * API handlers, UI actions) without ever disrupting the caller:
 *   - All errors are caught internally and written to `console.error`.
 *   - No exception is ever re-thrown.
 *   - Async by default; fire-and-forget usage is intentional and supported.
 *
 * Phase 4 – Infrastructure Core
 */

import { supabase } from '@/integrations/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported audit action verbs recognized by the platform. */
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'execute'
  | 'approve'
  | 'reject'
  | 'login'
  | 'logout'
  | 'export'
  | 'import'
  | 'grant_permission'
  | 'revoke_permission'
  | string; // Allow arbitrary action strings for extensibility.

/** Parameters accepted by the `log()` method. */
export interface AuditLogParams {
  /** UUID of the user or service-account that performed the action. */
  actor_id: string;

  /** Human-readable email address of the actor (optional, for readability). */
  actor_email?: string;

  /** Tenant / organisation scope of the action. */
  tenant_id?: string;

  /**
   * Verb describing what was done.
   * Prefer the typed `AuditAction` values for consistency; arbitrary strings
   * are accepted for domain-specific actions.
   */
  action: AuditAction;

  /** The category of the resource that was acted upon (e.g. 'workflow', 'user', 'plugin'). */
  resource_type: string;

  /** The specific resource instance that was acted upon (UUID or slug). */
  resource_id?: string;

  /**
   * Correlation ID linking this audit record to a parent event or workflow
   * execution (matches `NormalizedEvent.correlation_id`).
   */
  correlation_id?: string;

  /**
   * JSON-serialisable snapshot of the resource state BEFORE the action.
   * Omit for create/view operations.
   */
  before_snapshot?: Record<string, any>;

  /**
   * JSON-serialisable snapshot of the resource state AFTER the action.
   * Omit for delete/view operations.
   */
  after_snapshot?: Record<string, any>;

  /** Arbitrary key-value pairs for additional context (IP, user-agent, etc.). */
  metadata?: Record<string, any>;
}

/** Shape of a row inserted into the `audit_logs` Supabase table. */
interface AuditLogRow {
  actor_id: string;
  actor_email: string | null;
  tenant_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  correlation_id: string | null;
  before_snapshot: Record<string, any> | null;
  after_snapshot: Record<string, any> | null;
  metadata: Record<string, any>;
  occurred_at: string;
}

// ---------------------------------------------------------------------------
// AuditLoggerImpl
// ---------------------------------------------------------------------------

/**
 * `AuditLoggerImpl` – concrete implementation of the audit logging service.
 *
 * Prefer the pre-exported singleton `AuditLogger` over instantiating this
 * class directly.
 */
export class AuditLoggerImpl {
  /**
   * Write an audit record to the Supabase `audit_logs` table.
   *
   * This method is intentionally non-throwing.  Any database or network error
   * is caught, written to `console.error`, and silently swallowed so that the
   * calling code is never disrupted by audit infrastructure failures.
   *
   * @param params  Structured audit log parameters.
   * @returns       `true` if the record was successfully persisted, `false` otherwise.
   *
   * @example
   * // Fire-and-forget usage (most common):
   * void AuditLogger.log({
   *   actor_id: user.id,
   *   actor_email: user.email,
   *   tenant_id: org.id,
   *   action: 'update',
   *   resource_type: 'workflow',
   *   resource_id: workflow.id,
   *   before_snapshot: previousState,
   *   after_snapshot: newState,
   * });
   *
   * @example
   * // Awaited usage (when you need to confirm persistence):
   * const persisted = await AuditLogger.log({ ... });
   * if (!persisted) console.warn('Audit log failed – see console.error for details.');
   */
  async log(params: AuditLogParams): Promise<boolean> {
    try {
      const row: AuditLogRow = {
        actor_id: params.actor_id,
        actor_email: params.actor_email ?? null,
        tenant_id: params.tenant_id ?? null,
        action: params.action,
        resource_type: params.resource_type,
        resource_id: params.resource_id ?? null,
        correlation_id: params.correlation_id ?? null,
        before_snapshot: params.before_snapshot ?? null,
        after_snapshot: params.after_snapshot ?? null,
        metadata: params.metadata ?? {},
        occurred_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('audit_logs').insert(row);

      if (error) {
        console.error(
          '[AuditLogger] Supabase insert failed.',
          '\n  Action    :', params.action,
          '\n  Actor     :', params.actor_id,
          '\n  Resource  :', `${params.resource_type}${params.resource_id ? `/${params.resource_id}` : ''}`,
          '\n  Error     :', error,
        );
        return false;
      }

      return true;
    } catch (err) {
      // Must never throw – catch-all guard.
      console.error(
        '[AuditLogger] Unexpected error during audit log write.',
        '\n  Action    :', params.action,
        '\n  Actor     :', params.actor_id,
        '\n  Caught    :', err,
      );
      return false;
    }
  }

  // ── Static convenience wrapper ────────────────────────────────────────────

  /**
   * Static helper that delegates to the application singleton.
   *
   * Allows call-sites to use `AuditLogger.log(...)` as a class-static call
   * without having to import the singleton separately, while still routing
   * through the single shared instance.
   *
   * Note: This is defined as a static property pointing to the singleton
   *       instance's method; see the bottom of the file where it is wired up
   *       after the singleton is constructed.
   *
   * @example
   * import { AuditLogger } from '@/platform/Infrastructure/AuditLogger';
   * await AuditLogger.log({ actor_id: '...', action: 'delete', resource_type: 'plugin' });
   */
  static log: (params: AuditLogParams) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/**
 * Application-wide singleton instance.
 *
 * @example
 * import { AuditLogger } from '@/platform/Infrastructure/AuditLogger';
 *
 * // Instance method:
 * await AuditLogger.log({ actor_id: userId, action: 'create', resource_type: 'workflow' });
 *
 * // Static shorthand (identical result):
 * await AuditLoggerImpl.log({ actor_id: userId, action: 'create', resource_type: 'workflow' });
 */
export const AuditLogger = new AuditLoggerImpl();

// Wire the static helper to the singleton instance so both call-styles work.
AuditLoggerImpl.log = (params: AuditLogParams) => AuditLogger.log(params);
