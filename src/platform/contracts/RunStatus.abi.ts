/**
 * RunStatus ABI — v1.0.0 — FROZEN
 *
 * Canonical state machine for workflow run lifecycle.
 * Used by: workflow_runs table, ExecutionRuntime, LifecycleService,
 *          RunStore, ApprovalEngine, UI execution panel.
 *
 * ADR: docs/ADR/ADR-013-run-status-abi.md
 */

// ─── Run status enum ──────────────────────────────────────────────────────────

export type RunStatus =
  | 'queued'            // Inserted into execution_queue, not yet started
  | 'running'           // ExecutionRuntime is actively processing
  | 'waiting_approval'  // Paused at an approval node, awaiting human decision
  | 'completed'         // All nodes executed successfully
  | 'failed'            // One or more nodes failed and recovery was not possible
  | 'cancelled'         // Manually cancelled before completion
  | 'timed_out';        // Exceeded the global run timeout

// ─── Valid state transitions ──────────────────────────────────────────────────

export const RUN_STATUS_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  queued:            ['running', 'cancelled'],
  running:           ['completed', 'failed', 'waiting_approval', 'cancelled', 'timed_out'],
  waiting_approval:  ['running', 'cancelled'],
  completed:         [],           // Terminal state
  failed:            [],           // Terminal state
  cancelled:         [],           // Terminal state
  timed_out:         [],           // Terminal state
};

// ─── Terminal states ──────────────────────────────────────────────────────────

export const TERMINAL_RUN_STATUSES: RunStatus[] = [
  'completed',
  'failed',
  'cancelled',
  'timed_out',
];

export function isTerminalStatus(status: RunStatus): boolean {
  return TERMINAL_RUN_STATUSES.includes(status);
}

// ─── Transition guard ─────────────────────────────────────────────────────────

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return RUN_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Trigger type enum ────────────────────────────────────────────────────────

export type TriggerType =
  | 'manual'      // User clicked Test Run or Run in Studio
  | 'scheduled'   // Cron/time-based trigger
  | 'webhook'     // Inbound HTTP trigger
  | 'event'       // Platform event subscription
  | 'api'         // External API call
  | 'autonomous'; // Initiated by Intent Runtime
