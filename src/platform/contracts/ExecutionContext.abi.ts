/**
 * ExecutionContext ABI — v1.0.0 — FROZEN
 *
 * The data envelope passed into every node executor and accumulated across a run.
 * Secrets are resolved by reference only — never as plaintext values.
 *
 * ADR: docs/ADR/ADR-007-execution-context-abi.md
 */

// ─── Per-node result stored in context ────────────────────────────────────────

export interface NodeOutput {
  /** Structured output from the node executor */
  data: Record<string, unknown>;
  /** Execution status for this node */
  status: 'success' | 'failed' | 'skipped';
  /** Error message if status is 'failed' */
  error?: string;
  /** ISO-8601 start time */
  startedAt: string;
  /** ISO-8601 completion time */
  completedAt: string;
  /** Wall-clock duration in milliseconds */
  durationMs: number;
  /** Provider used to execute this node (populated by ProviderResolver) */
  providerUsed?: string;
}

// ─── A resolved secret reference ──────────────────────────────────────────────
// The runtime injects resolved secret values into the context before node execution.
// Nodes reference secrets by name only — they never embed raw credentials.

export interface ResolvedSecret {
  /** The secret name as referenced in node config */
  name: string;
  /** The resolved plaintext value — only present within executor scope, never logged */
  value: string;
  /** Source vault entry id for audit purposes */
  vaultEntryId: string;
}

// ─── The execution context ────────────────────────────────────────────────────

export interface ExecutionContext {
  /** Stable run identifier (workflow_runs.id) */
  runId: string;
  /** The workflow being executed */
  workflowId: string;
  /** The published version being executed, if any */
  workflowVersionId?: string;
  /** Stable correlation id for tracing across services */
  correlationId: string;
  /** Tenant scope */
  tenantId?: string;
  /** Supabase auth user id of the actor that triggered this run */
  triggeredBy: string;
  /** ISO-8601 run start time */
  startedAt: string;
  /** Accumulated per-node outputs, keyed by node id */
  nodeOutputs: Record<string, NodeOutput>;
  /** Workflow-scoped variables resolved at run-start */
  variables: Record<string, unknown>;
  /**
   * Secrets resolved for this node, based on policy and requirements.
   * Access is tracked via AuditEvent.
   */
  secrets: Record<string, string>;

  /**
   * Phase E.5: Capability isolation.
   * Nodes must request platform capabilities through this interface.
   * Attempting to use unauthorized capabilities throws a PermissionDeniedError.
   */
  capabilities: {
    request<T = any>(capabilityUri: string): T;
  };

  /**
   * Add a log entry for this specific execution.
   */
  log(level: 'info' | 'warn' | 'error', message: string, details?: unknown): void;
  /** The trigger payload that initiated this run */
  triggerPayload?: Record<string, unknown>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function createExecutionContext(params: {
  runId: string;
  workflowId: string;
  workflowVersionId?: string;
  correlationId: string;
  tenantId?: string;
  triggeredBy: string;
  variables?: Record<string, unknown>;
  triggerPayload?: Record<string, unknown>;
}): ExecutionContext {
  return {
    runId: params.runId,
    workflowId: params.workflowId,
    workflowVersionId: params.workflowVersionId,
    correlationId: params.correlationId,
    tenantId: params.tenantId,
    triggeredBy: params.triggeredBy,
    startedAt: new Date().toISOString(),
    nodeOutputs: {},
    variables: params.variables ?? {},
    secrets: {},
    triggerPayload: params.triggerPayload,
  };
}
