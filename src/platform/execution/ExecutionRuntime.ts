/**
 * ExecutionRuntime — Phase A.5
 *
 * Responsible for:
 * 1. Managing the ExecutionContext (creating it, updating nodeOutputs, resolving secrets).
 * 2. Emitting typed ExecutionEvents (ExecutionStarted, NodeStarted, etc.).
 * 3. Handling audit hooks (policy evaluation, node completion auditing).
 * 4. Checkpointing execution state.
 *
 * The Runtime NEVER executes node logic, nor does it decide ordering.
 * It provides the environment and lifecycle hooks for execution.
 *
 * Plane: Execution Plane
 * Imports: platform/contracts, platform/execution/*
 */

import type { ExecutionContext, NodeOutput, ResolvedSecret } from '../contracts/ExecutionContext.abi';
import type { WorkflowGraph } from '../contracts/WorkflowGraph.abi';
import type { IExecutionEventPublisher } from '../contracts/ExecutionEvent.abi';
import type { IAuditStore } from '../contracts/AuditEvent.abi';
import type { IPolicyEngine } from '../contracts/PolicyContract.abi';
import type { PlannedTask } from './ExecutionPlanner';
import type { NodeExecutorResult } from './NodeExecutor';

export interface RuntimeConfig {
  tenantId?: string;
  triggerType: 'manual' | 'scheduled' | 'webhook' | 'event' | 'api' | 'autonomous';
  triggeredBy: string;
  triggerPayload?: Record<string, unknown>;
  variables?: Record<string, unknown>;
}

export class ExecutionRuntime {
  public readonly context: ExecutionContext;

  constructor(
    private readonly runId: string,
    private readonly graph: WorkflowGraph,
    private readonly config: RuntimeConfig,
    private readonly eventPublisher: IExecutionEventPublisher,
    private readonly auditStore: IAuditStore,
    private readonly policyEngine: IPolicyEngine,
  ) {
    this.context = {
      runId: this.runId,
      workflowId: this.graph.id,
      correlationId: `corr_${this.runId}`,
      tenantId: this.config.tenantId,
      triggeredBy: this.config.triggeredBy,
      startedAt: new Date().toISOString(),
      nodeOutputs: {},
      variables: this.config.variables ?? {},
      secrets: {},
      triggerPayload: this.config.triggerPayload,
    };
  }

  /**
   * Initializes the execution, emits started events, and resolves initial state.
   */
  async startExecution(): Promise<void> {
    this.eventPublisher.publish({
      eventId: crypto.randomUUID(),
      type: 'EXECUTION_STARTED',
      runId: this.runId,
      workflowId: this.graph.id,
      correlationId: this.context.correlationId,
      timestamp: new Date().toISOString(),
      tenantId: this.context.tenantId,
      payload: {
        triggeredBy: this.config.triggeredBy,
        triggerType: this.config.triggerType,
      },
    });

    // Fire-and-forget audit log (append only, infallible)
    this.auditStore.append({
      action: 'run.started',
      resourceType: 'workflow_run',
      resourceId: this.runId,
      actorId: this.config.triggeredBy,
      tenantId: this.context.tenantId,
      correlationId: this.context.correlationId,
      outcome: 'success',
      source: 'runtime',
      metadata: { triggerType: this.config.triggerType },
    }).catch(e => console.error('[AuditStore] Failed to write run.started', e));
  }

  /**
   * Completes the execution, emitting final events.
   */
  async completeExecution(summary: { durationMs: number; successCount: number; failedCount: number; skippedCount: number }): Promise<void> {
    this.eventPublisher.publish({
      eventId: crypto.randomUUID(),
      type: 'EXECUTION_COMPLETED',
      runId: this.runId,
      workflowId: this.graph.id,
      correlationId: this.context.correlationId,
      timestamp: new Date().toISOString(),
      tenantId: this.context.tenantId,
      payload: {
        durationMs: summary.durationMs,
        nodeCount: summary.successCount + summary.failedCount + summary.skippedCount,
        successCount: summary.successCount,
        failedCount: summary.failedCount,
        skippedCount: summary.skippedCount,
      },
    });

    this.auditStore.append({
      action: 'run.completed',
      resourceType: 'workflow_run',
      resourceId: this.runId,
      actorId: this.config.triggeredBy,
      tenantId: this.context.tenantId,
      correlationId: this.context.correlationId,
      outcome: 'success',
      source: 'runtime',
    }).catch(e => console.error('[AuditStore] Failed to write run.completed', e));
  }

  /**
   * Fails the execution, emitting failure events.
   */
  async failExecution(error: Error, failedNodeId?: string, durationMs?: number): Promise<void> {
    this.eventPublisher.publish({
      eventId: crypto.randomUUID(),
      type: 'EXECUTION_FAILED',
      runId: this.runId,
      workflowId: this.graph.id,
      correlationId: this.context.correlationId,
      timestamp: new Date().toISOString(),
      tenantId: this.context.tenantId,
      payload: {
        failedNodeId: failedNodeId ?? 'unknown',
        error: error.message,
        durationMs: durationMs ?? 0,
      },
    });

    this.auditStore.append({
      action: 'run.failed',
      resourceType: 'workflow_run',
      resourceId: this.runId,
      actorId: this.config.triggeredBy,
      tenantId: this.context.tenantId,
      correlationId: this.context.correlationId,
      outcome: 'failure',
      errorMessage: error.message,
      source: 'runtime',
    }).catch(e => console.error('[AuditStore] Failed to write run.failed', e));
  }

  /**
   * Pre-node execution hook: policy evaluation, secret resolution, event emission.
   */
  async beforeNodeExecution(task: PlannedTask): Promise<void> {
    // 1. Evaluate policies
    const policyResults = await this.policyEngine.evaluate({
      tenantId: this.context.tenantId,
      workflowId: this.graph.id,
      nodeType: task.nodeType,
      context: { taskConfig: task.config, variables: this.context.variables },
    });

    const denied = policyResults.find(r => r.outcome === 'deny');
    if (denied) {
      throw new Error(`Execution blocked by policy: ${denied.policyId} - ${denied.reason}`);
    }

    // 2. (Mock) Resolve secrets — in a real implementation this would fetch from a Vault
    // For now, we assume secrets are provided in the config or we mock them if requested.
    this.context.secrets = {};

    // 3. Emit NODE_STARTED
    this.eventPublisher.publish({
      eventId: crypto.randomUUID(),
      type: 'NODE_STARTED',
      runId: this.runId,
      workflowId: this.graph.id,
      correlationId: this.context.correlationId,
      timestamp: new Date().toISOString(),
      tenantId: this.context.tenantId,
      payload: {
        nodeId: task.nodeId,
        nodeType: task.nodeType,
        runOrder: task.runOrder,
      },
    });
  }

  /**
   * Post-node execution hook: record outputs, emit events, audit.
   */
  async afterNodeExecution(task: PlannedTask, result: NodeExecutorResult, startedAt: string): Promise<void> {
    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    // 1. Write to context (read-only for executors)
    const nodeOutput: NodeOutput = {
      data: result.output,
      status: 'success',
      startedAt,
      completedAt,
      durationMs,
      providerUsed: result.providerUsed,
    };
    this.context.nodeOutputs[task.nodeId] = nodeOutput;

    // 2. Emit NODE_COMPLETED
    this.eventPublisher.publish({
      eventId: crypto.randomUUID(),
      type: 'NODE_COMPLETED',
      runId: this.runId,
      workflowId: this.graph.id,
      correlationId: this.context.correlationId,
      timestamp: completedAt,
      tenantId: this.context.tenantId,
      payload: {
        nodeId: task.nodeId,
        nodeType: task.nodeType,
        durationMs,
        providerUsed: result.providerUsed,
        outputSummary: result.output, // In real implementation, sanitize this!
      },
    });
  }

  /**
   * Failure hook for a specific node execution.
   */
  async onNodeFailure(task: PlannedTask, error: Error, startedAt: string, attempt: number): Promise<void> {
    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    const nodeOutput: NodeOutput = {
      data: {},
      status: 'failed',
      error: error.message,
      startedAt,
      completedAt,
      durationMs,
    };
    this.context.nodeOutputs[task.nodeId] = nodeOutput;

    this.eventPublisher.publish({
      eventId: crypto.randomUUID(),
      type: 'NODE_FAILED',
      runId: this.runId,
      workflowId: this.graph.id,
      correlationId: this.context.correlationId,
      timestamp: completedAt,
      tenantId: this.context.tenantId,
      payload: {
        nodeId: task.nodeId,
        nodeType: task.nodeType,
        error: error.message,
        durationMs,
        retryCount: attempt,
      },
    });
  }
}
