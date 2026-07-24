/**
 * AuditEvent ABI — v1.0.0 — FROZEN
 *
 * Shape written to audit_logs for every auditable action in the platform.
 * The audit log is append-only. Rows are never updated or deleted.
 * Used by: AuditStore, LifecycleService, ExecutionRuntime, Studio save/publish handlers.
 *
 * ADR: docs/ADR/ADR-014-audit-event-abi.md
 */

// ─── Auditable action types ───────────────────────────────────────────────────

export type AuditAction =
  // Workflow lifecycle
  | 'workflow.created'
  | 'workflow.saved'
  | 'workflow.published'
  | 'workflow.archived'
  | 'workflow.deleted'
  // Execution
  | 'run.started'
  | 'run.completed'
  | 'run.failed'
  | 'run.cancelled'
  | 'node.executed'
  | 'node.failed'
  // Approvals
  | 'approval.requested'
  | 'approval.resolved'
  | 'approval.escalated'
  // Secrets and credentials
  | 'secret.accessed'
  | 'secret.created'
  | 'secret.rotated'
  // Side effects
  | 'webhook.called'
  | 'database.queried'
  | 'email.queued'
  | 'notification.sent'
  // Policy
  | 'policy.evaluated'
  | 'policy.enforced'
  | 'policy.violated'
  // AI
  | 'ai.generation_requested'
  | 'ai.execution_completed';

// ─── Resource types ───────────────────────────────────────────────────────────

export type AuditResourceType =
  | 'workflow'
  | 'workflow_version'
  | 'workflow_run'
  | 'workflow_node'
  | 'approval'
  | 'secret'
  | 'policy'
  | 'provider'
  | 'capability';

// ─── The audit event shape ────────────────────────────────────────────────────

export interface AuditEvent {
  /** Globally unique audit entry id */
  id?: string;
  /** The action being audited */
  action: AuditAction;
  /** Type of resource being acted upon */
  resourceType: AuditResourceType;
  /** Id of the resource being acted upon */
  resourceId: string;
  /** Supabase auth user id of the actor */
  actorId: string;
  /** Tenant scope */
  tenantId?: string;
  /** Correlation id linking to the workflow run, if applicable */
  correlationId?: string;
  /** ISO-8601 timestamp */
  occurredAt: string;
  /** Arbitrary context data — must NOT contain secret values */
  metadata?: Record<string, unknown>;
  /** Outcome of the action */
  outcome: 'success' | 'failure' | 'denied';
  /** Error message if outcome is 'failure' or 'denied' */
  errorMessage?: string;
  /** IP address of the actor, if available */
  ipAddress?: string;
  /** Source surface that triggered the action */
  source: 'studio' | 'api' | 'runtime' | 'system' | 'autonomous';
}

// ─── AuditStore contract ──────────────────────────────────────────────────────

export interface IAuditStore {
  /**
   * Append an audit event to audit_logs.
   * Must never throw — failures are silently reported to telemetry.
   */
  append(event: Omit<AuditEvent, 'id' | 'occurredAt'>): Promise<void>;

  /**
   * Query audit events for a specific resource.
   */
  query(params: {
    resourceType: AuditResourceType;
    resourceId: string;
    limit?: number;
    before?: string;
  }): Promise<AuditEvent[]>;
}
