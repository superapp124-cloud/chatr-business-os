/**
 * ExecutionEngine — Phase A.5
 *
 * Coordinates an execution from start to finish.
 * Assembles the Planner, Scheduler, Runtime, and Executor.
 * Exposes a single `execute(graph, config)` method.
 *
 * The Engine is the sole entry point for execution (Invariant I-03).
 *
 * Plane: Execution Plane
 * Imports: platform/contracts, platform/execution/*
 */

import type { WorkflowGraph } from '../contracts/WorkflowGraph.abi';
import type { IExecutionEventPublisher } from '../contracts/ExecutionEvent.abi';
import type { IAuditStore } from '../contracts/AuditEvent.abi';
import type { IPolicyEngine } from '../contracts/PolicyContract.abi';
import type { ExecutionResult } from '../contracts/ExecutionResult.abi';
import type { RunStatus } from '../contracts/RunStatus.abi';

import { ExecutionPlanner, PlannedTask } from './ExecutionPlanner';
import { ExecutionScheduler, SchedulerConfig, CancellationToken } from './ExecutionScheduler';
import { ExecutionRuntime, RuntimeConfig } from './ExecutionRuntime';
import { NodeExecutor, INodeRegistry } from './NodeExecutor';

export interface ExecutionEngineConfig {
  schedulerConfig?: Partial<SchedulerConfig>;
}

export class ExecutionEngine {
  constructor(
    private readonly nodeRegistry: INodeRegistry,
    private readonly eventPublisher: IExecutionEventPublisher,
    private readonly auditStore: IAuditStore,
    private readonly policyEngine: IPolicyEngine,
    private readonly config: ExecutionEngineConfig = {},
  ) {}

  /**
   * Execute a WorkflowGraph.
   *
   * @param graph The canonical WorkflowGraph to execute (Invariant I-04).
   * @param runConfig Configuration for the run (trigger type, user, tenant).
   * @param runId Optional specific run ID, otherwise auto-generated.
   * @param cancellationToken Optional token to cancel the run.
   * @returns ExecutionResult summarizing the completed/failed run.
   */
  async execute(
    graph: WorkflowGraph,
    runConfig: RuntimeConfig,
    runId: string = crypto.randomUUID(),
    cancellationToken?: CancellationToken,
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let finalStatus: RunStatus = 'failed';
    let failedNodeId: string | undefined = undefined;
    let errorMessage: string | undefined = undefined;

    // 1. Initialize Runtime
    const runtime = new ExecutionRuntime(
      runId,
      graph,
      runConfig,
      this.eventPublisher,
      this.auditStore,
      this.policyEngine,
    );

    // 2. Initialize Executor
    const executor = new NodeExecutor(this.nodeRegistry);

    // 3. Initialize Scheduler
    const scheduler = new ExecutionScheduler(this.config.schedulerConfig);

    try {
      await runtime.startExecution();

      // 4. Compile Graph -> ExecutionPlan
      const plan = ExecutionPlanner.compile(graph);

      // 5. Define Task Runner
      const taskRunner = async (task: PlannedTask, attempt: number) => {
        const nodeStartTime = new Date().toISOString();
        try {
          await runtime.beforeNodeExecution(task);
          
          // Phase E.5: Fault Isolation (Timeout Sandbox)
          const timeoutMs = task.timeoutMs || 30000;
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Execution timeout: Node exceeded ${timeoutMs}ms limit.`)), timeoutMs);
          });
          
          const result = await Promise.race([
            executor.execute(task, runtime.context),
            timeoutPromise
          ]);
          
          await runtime.afterNodeExecution(task, result, nodeStartTime);
        } catch (error) {
          await runtime.onNodeFailure(task, error as Error, nodeStartTime, attempt);
          throw error;
        }
      };

      // 6. Schedule and Execute Plan
      await scheduler.schedule(plan.tasks, taskRunner, cancellationToken);

      if (cancellationToken?.isCancelled) {
        finalStatus = 'cancelled';
        errorMessage = 'Execution was cancelled.';
      } else {
        finalStatus = 'completed';
      }
    } catch (error) {
      finalStatus = 'failed';
      errorMessage = (error as Error).message;
      // Heuristic: try to extract failed node id if it bubbled up
      if ((error as any).nodeId) {
        failedNodeId = (error as any).nodeId;
      }
    } finally {
      const endTime = Date.now();
      const durationMs = endTime - startTime;

      if (finalStatus === 'completed') {
        // Calculate successes based on runtime context
        const outputs = Object.values(runtime.context.nodeOutputs);
        const successCount = outputs.filter(o => o.status === 'success').length;
        const failedCount = outputs.filter(o => o.status === 'failed').length;
        
        await runtime.completeExecution({
          durationMs,
          successCount,
          failedCount,
          skippedCount: 0,
        });
      } else {
        await runtime.failExecution(new Error(errorMessage ?? 'Unknown error'), failedNodeId, durationMs);
      }

      // Build and return final ExecutionResult
      return this.buildExecutionResult(
        runId,
        graph,
        runConfig,
        finalStatus,
        new Date(startTime).toISOString(),
        new Date(endTime).toISOString(),
        durationMs,
        errorMessage,
        failedNodeId,
        runtime.context,
      );
    }
  }

  private buildExecutionResult(
    runId: string,
    graph: WorkflowGraph,
    runConfig: RuntimeConfig,
    status: RunStatus,
    startedAt: string,
    completedAt: string,
    durationMs: number,
    errorMessage: string | undefined,
    failedNodeId: string | undefined,
    context: any // using any here for brevity, maps to ExecutionContext
  ): ExecutionResult {
    const nodeSummaries = Object.keys(context.nodeOutputs).map((nodeId, index) => {
      const output = context.nodeOutputs[nodeId];
      const nodeDef = graph.nodes.find(n => n.id === nodeId);
      return {
        nodeId,
        nodeType: nodeDef?.type ?? 'unknown',
        status: output.status,
        runOrder: index, // Simplified ordering for result
        startedAt: output.startedAt,
        completedAt: output.completedAt,
        durationMs: output.durationMs,
        providerUsed: output.providerUsed,
        retryCount: 0, // Mocked
        error: output.error,
        outputSummary: output.data,
      };
    });

    return {
      runId,
      workflowId: graph.id,
      correlationId: context.correlationId,
      tenantId: context.tenantId,
      triggeredBy: context.triggeredBy,
      triggerType: runConfig.triggerType,
      status,
      startedAt,
      completedAt,
      durationMs,
      nodeSummaries,
      totalRetries: 0,
      failedNodeId,
      errorMessage,
      logs: [],
    };
  }
}
