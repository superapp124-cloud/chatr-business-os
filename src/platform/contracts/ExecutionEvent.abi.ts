/**
 * ExecutionEvent ABI — v1.0.0 — FROZEN
 *
 * Every event published by the execution runtime must conform to this shape.
 * Consumers (Studio UI, ExecutionTracer, ObservabilityPlatform) rely on this contract.
 *
 * ADR: docs/ADR/ADR-008-execution-event-abi.md
 */

// ─── Execution event type enum ────────────────────────────────────────────────

export type ExecutionEventType =
  | 'EXECUTION_QUEUED'
  | 'EXECUTION_STARTED'
  | 'EXECUTION_COMPLETED'
  | 'EXECUTION_FAILED'
  | 'EXECUTION_CANCELLED'
  | 'NODE_STARTED'
  | 'NODE_COMPLETED'
  | 'NODE_FAILED'
  | 'NODE_SKIPPED'
  | 'NODE_AWAITING_APPROVAL'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_RESOLVED'
  | 'SECRET_RESOLVED'
  | 'PROVIDER_SELECTED'
  | 'CHECKPOINT_WRITTEN';

// ─── Base event shape ─────────────────────────────────────────────────────────

export interface ExecutionEventBase {
  /** Globally unique event identifier */
  eventId: string;
  /** Event type discriminator */
  type: ExecutionEventType;
  /** Stable run identifier */
  runId: string;
  /** The workflow being executed */
  workflowId: string;
  /** Correlation id for cross-service tracing */
  correlationId: string;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Tenant scope */
  tenantId?: string;
}

// ─── Typed payloads per event ─────────────────────────────────────────────────

export interface ExecutionStartedEvent extends ExecutionEventBase {
  type: 'EXECUTION_STARTED';
  payload: {
    workflowVersionId?: string;
    triggeredBy: string;
    triggerType: 'manual' | 'scheduled' | 'webhook' | 'event' | 'api';
  };
}

export interface ExecutionCompletedEvent extends ExecutionEventBase {
  type: 'EXECUTION_COMPLETED';
  payload: {
    durationMs: number;
    nodeCount: number;
    successCount: number;
    failedCount: number;
    skippedCount: number;
  };
}

export interface ExecutionFailedEvent extends ExecutionEventBase {
  type: 'EXECUTION_FAILED';
  payload: {
    failedNodeId: string;
    error: string;
    durationMs: number;
  };
}

export interface NodeStartedEvent extends ExecutionEventBase {
  type: 'NODE_STARTED';
  payload: {
    nodeId: string;
    nodeType: string;
    runOrder: number;
  };
}

export interface NodeCompletedEvent extends ExecutionEventBase {
  type: 'NODE_COMPLETED';
  payload: {
    nodeId: string;
    nodeType: string;
    durationMs: number;
    providerUsed?: string;
    outputSummary?: Record<string, unknown>;
  };
}

export interface NodeFailedEvent extends ExecutionEventBase {
  type: 'NODE_FAILED';
  payload: {
    nodeId: string;
    nodeType: string;
    error: string;
    durationMs: number;
    retryCount: number;
  };
}

export interface NodeAwaitingApprovalEvent extends ExecutionEventBase {
  type: 'NODE_AWAITING_APPROVAL';
  payload: {
    nodeId: string;
    approvalId: string;
    assignedTo: string[];
    slaDeadline?: string;
  };
}

export interface CheckpointWrittenEvent extends ExecutionEventBase {
  type: 'CHECKPOINT_WRITTEN';
  payload: {
    nodeId: string;
    checkpointId: string;
  };
}

// ─── Union type ───────────────────────────────────────────────────────────────

export type ExecutionEvent =
  | ExecutionStartedEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent
  | NodeStartedEvent
  | NodeCompletedEvent
  | NodeFailedEvent
  | NodeAwaitingApprovalEvent
  | CheckpointWrittenEvent
  | (ExecutionEventBase & { type: ExecutionEventType; payload: Record<string, unknown> });

// ─── Event publisher contract ─────────────────────────────────────────────────

export interface IExecutionEventPublisher {
  publish(event: ExecutionEvent): void;
  subscribe(type: ExecutionEventType, handler: (event: ExecutionEvent) => void): () => void;
}
