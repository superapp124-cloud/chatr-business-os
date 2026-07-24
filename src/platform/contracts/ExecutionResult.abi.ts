/**
 * ExecutionResult ABI — v1.0.0 — FROZEN
 *
 * The final object returned or persisted after a workflow run completes.
 * Stored in workflow_runs.execution_trace and returned by ExecutionEngine.execute().
 *
 * ADR: docs/ADR/ADR-015-execution-result-abi.md
 */

import type { RunStatus } from './RunStatus.abi';

// ─── Per-node result summary ──────────────────────────────────────────────────

export interface NodeExecutionSummary {
  nodeId: string;
  nodeType: string;
  status: 'success' | 'failed' | 'skipped';
  runOrder: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  providerUsed?: string;
  capabilityId?: string;
  /** Sanitised output — must not contain secrets */
  outputSummary?: Record<string, unknown>;
  error?: string;
  retryCount: number;
  tokensUsed?: number;
  costUsd?: number;
}

// ─── The execution result ─────────────────────────────────────────────────────

export interface ExecutionResult {
  /** Corresponds to workflow_runs.id */
  runId: string;
  workflowId: string;
  workflowVersionId?: string;
  correlationId: string;
  tenantId?: string;
  triggeredBy: string;
  triggerType: 'manual' | 'scheduled' | 'webhook' | 'event' | 'api' | 'autonomous';

  /** Final run status */
  status: RunStatus;

  /** ISO-8601 */
  startedAt: string;
  /** ISO-8601 — present when status is terminal */
  completedAt?: string;
  /** Total wall-clock duration in milliseconds */
  durationMs?: number;

  /** Time spent waiting in the execution queue before starting */
  queueWaitMs?: number;
  /** Time spent waiting for human approvals */
  approvalWaitMs?: number;

  /** Ordered list of per-node execution summaries */
  nodeSummaries: NodeExecutionSummary[];

  /** Total AI tokens consumed across all AI nodes in this run */
  totalTokensUsed?: number;
  /** Estimated total AI cost in USD */
  totalCostUsd?: number;

  /** Total retry count across all nodes */
  totalRetries: number;

  /** Error from the failing node, if run failed */
  failedNodeId?: string;
  errorMessage?: string;

  /**
   * Full structured logs appended during execution.
   * Stored in workflow_runs.logs.
   */
  logs: Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    nodeId?: string;
  }>;
}
