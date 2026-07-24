/**
 * Phase A.5 — Verification Tests
 *
 * Verifies the acceptance criteria defined for the Runtime Abstraction Layer:
 *   1. Planner produces deterministic execution plans.
 *   2. Scheduler is runtime-agnostic.
 *   3. Node execution is registry-driven rather than switch-driven.
 *   4. Runtime emits only ABI-defined events.
 *   5. ExecutionEngine orchestrates without executing nodes directly.
 *
 * Run with: npx vitest run tests/platform/phase-a5.test.ts
 */

import { describe, it, expect, vi } from 'vitest';
import { ExecutionPlanner } from '@/platform/execution/ExecutionPlanner';
import { ExecutionScheduler, CancellationToken } from '@/platform/execution/ExecutionScheduler';
import { NodeExecutor, INodeRegistry, INodeExecutable } from '@/platform/execution/NodeExecutor';
import { ExecutionRuntime, RuntimeConfig } from '@/platform/execution/ExecutionRuntime';
import { ExecutionEngine } from '@/platform/execution/ExecutionEngine';
import type { WorkflowGraph } from '@/platform/contracts/WorkflowGraph.abi';
import type { IExecutionEventPublisher } from '@/platform/contracts/ExecutionEvent.abi';
import type { IAuditStore } from '@/platform/contracts/AuditEvent.abi';
import type { IPolicyEngine, PolicyEvaluationResult } from '@/platform/contracts/PolicyContract.abi';

const mockGraph: WorkflowGraph = {
  schemaVersion: '1.0.0',
  id: 'wf-a5-test',
  name: 'A.5 Test Workflow',
  nodes: [
    { id: 'node-1', type: 'core.trigger', label: 'Trigger', config: {}, position: { x: 0, y: 0 } },
    { id: 'node-2', type: 'core.action', label: 'Action 1', config: { timeoutMs: 1000, retry: 1 }, position: { x: 100, y: 0 } },
    { id: 'node-3', type: 'core.action', label: 'Action 2', config: {}, position: { x: 200, y: 0 } },
  ],
  edges: [
    { id: 'e-1', source: 'node-1', target: 'node-2' },
    { id: 'e-2', source: 'node-2', target: 'node-3' },
  ],
  variables: [],
  layout: {},
  metadata: { status: 'draft', createdBy: 'tester', createdAt: '', updatedAt: '' },
  permissions: [],
  executionHints: { defaultRetry: 0, defaultTimeoutMs: 5000, defaultPriority: 5 },
};

describe('Phase A.5 — ExecutionPlanner', () => {
  it('produces a deterministic topological execution plan', () => {
    const plan = ExecutionPlanner.compile(mockGraph);
    expect(plan.tasks).toHaveLength(3);
    
    // Order should be 1 -> 2 -> 3
    expect(plan.tasks[0].nodeId).toBe('node-1');
    expect(plan.tasks[1].nodeId).toBe('node-2');
    expect(plan.tasks[2].nodeId).toBe('node-3');

    // Run order should be assigned
    expect(plan.tasks[0].runOrder).toBe(0);
    expect(plan.tasks[1].runOrder).toBe(1);
    expect(plan.tasks[2].runOrder).toBe(2);

    // Dependencies mapped correctly
    expect(plan.dependencies['node-2']).toContain('node-1');
    expect(plan.dependencies['node-3']).toContain('node-2');
  });

  it('detects cycles and throws PlannerError', () => {
    const cycleGraph = { ...mockGraph, edges: [...mockGraph.edges, { id: 'e-cycle', source: 'node-3', target: 'node-1' }] };
    expect(() => ExecutionPlanner.compile(cycleGraph)).toThrowError(/Cycle detected/);
  });
});

describe('Phase A.5 — ExecutionScheduler', () => {
  it('schedules tasks in runOrder, respecting concurrency', async () => {
    const scheduler = new ExecutionScheduler({ maxConcurrency: 2, failFast: true });
    const plan = ExecutionPlanner.compile(mockGraph);
    
    const executedTasks: string[] = [];
    const runner = async (task: any) => {
      executedTasks.push(task.nodeId);
    };

    await scheduler.schedule(plan.tasks, runner);

    expect(executedTasks).toEqual(['node-1', 'node-2', 'node-3']);
  });
});

describe('Phase A.5 — NodeExecutor (Registry-Driven)', () => {
  it('looks up execution logic from INodeRegistry without knowing node types', async () => {
    const mockDefinition: INodeExecutable = {
      type: 'core.action',
      execute: vi.fn().mockResolvedValue({ output: { success: true } })
    };
    const mockRegistry: INodeRegistry = {
      get: vi.fn().mockReturnValue(mockDefinition)
    };

    const executor = new NodeExecutor(mockRegistry);
    const plan = ExecutionPlanner.compile(mockGraph);
    
    const result = await executor.execute(plan.tasks[1], {} as any); // Task node-2 is core.action
    expect(mockRegistry.get).toHaveBeenCalledWith('core.action');
    expect(mockDefinition.execute).toHaveBeenCalled();
    expect(result.output).toEqual({ success: true });
  });

  it('gracefully returns passthrough result if node definition is missing', async () => {
    const emptyRegistry: INodeRegistry = { get: vi.fn().mockReturnValue(undefined) };
    const executor = new NodeExecutor(emptyRegistry);
    const plan = ExecutionPlanner.compile(mockGraph);
    
    const result = await executor.execute(plan.tasks[1], {} as any);
    expect(result.output.reason).toBe('no_definition');
  });
});

describe('Phase A.5 — ExecutionRuntime', () => {
  it('manages context, policies, and lifecycle without executing node logic', async () => {
    const eventPublisher: IExecutionEventPublisher = { publish: vi.fn(), subscribe: vi.fn() };
    const auditStore: IAuditStore = { append: vi.fn().mockResolvedValue(undefined), query: vi.fn() };
    const policyEngine: IPolicyEngine = { evaluate: vi.fn().mockResolvedValue([]) };

    const runtime = new ExecutionRuntime('test-run', mockGraph, { triggerType: 'manual', triggeredBy: 'user' }, eventPublisher, auditStore, policyEngine);

    await runtime.startExecution();
    expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'EXECUTION_STARTED' }));
    expect(auditStore.append).toHaveBeenCalledWith(expect.objectContaining({ action: 'run.started' }));

    const plan = ExecutionPlanner.compile(mockGraph);
    const task = plan.tasks[0];

    await runtime.beforeNodeExecution(task);
    expect(policyEngine.evaluate).toHaveBeenCalled();
    expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'NODE_STARTED' }));

    await runtime.afterNodeExecution(task, { nodeId: task.nodeId, output: { ok: true } }, new Date().toISOString());
    expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'NODE_COMPLETED' }));
    
    expect(runtime.context.nodeOutputs[task.nodeId]).toBeDefined();
    expect(runtime.context.nodeOutputs[task.nodeId].data).toEqual({ ok: true });
  });
});

describe('Phase A.5 — ExecutionEngine', () => {
  it('orchestrates an end-to-end run combining all modular components', async () => {
    const mockDefinition: INodeExecutable = {
      type: 'core.trigger',
      execute: vi.fn().mockResolvedValue({ output: { ok: true } })
    };
    const mockRegistry: INodeRegistry = {
      get: vi.fn().mockReturnValue(mockDefinition)
    };
    const eventPublisher: IExecutionEventPublisher = { publish: vi.fn(), subscribe: vi.fn() };
    const auditStore: IAuditStore = { append: vi.fn().mockResolvedValue(undefined), query: vi.fn() };
    const policyEngine: IPolicyEngine = { evaluate: vi.fn().mockResolvedValue([]) };

    const engine = new ExecutionEngine(mockRegistry, eventPublisher, auditStore, policyEngine);
    const result = await engine.execute(mockGraph, { triggerType: 'manual', triggeredBy: 'tester' });

    expect(result.status).toBe('completed');
    expect(result.nodeSummaries.length).toBe(3);
    expect(eventPublisher.publish).toHaveBeenCalled();
  });
});
