/**
 * ExecutionPlanner — Phase A.5
 *
 * Converts a WorkflowGraph (canonical ABI) into an ordered ExecutionPlan.
 * Responsible for: topological sort, dependency resolution, cycle detection, validation.
 *
 * This module replaces WorkflowCompiler as the authoritative graph-to-plan compiler.
 * WorkflowCompiler is retained as a thin shim that delegates here.
 *
 * Plane: Execution Plane
 * Imports: platform/contracts only
 */

import type { WorkflowGraph, WorkflowNode, WorkflowEdge } from '../contracts/WorkflowGraph.abi';

// ─── ExecutionPlan ────────────────────────────────────────────────────────────

export interface PlannedTask {
  /** Stable task identifier derived from node id */
  taskId: string;
  /** Source node id */
  nodeId: string;
  /** Node type string — must be registered in NodeRegistry */
  nodeType: string;
  /** Node configuration object */
  config: Record<string, unknown>;
  /** Topological run order (0 = first) */
  runOrder: number;
  /** Node ids this task depends on (must complete before this runs) */
  dependsOn: string[];
  /** Retry budget for this task (from node config or graph executionHints) */
  retryCount: number;
  /** Timeout in ms (from node config or graph executionHints) */
  timeoutMs: number;
}

export interface ExecutionPlan {
  /** Workflow id this plan was compiled from */
  workflowId: string;
  /** Ordered list of tasks */
  tasks: PlannedTask[];
  /** Dependency map: nodeId → array of nodeIds it depends on */
  dependencies: Record<string, string[]>;
  /** Adjacency list: nodeId → array of nodeIds it leads to */
  successors: Record<string, string[]>;
}

// ─── Planner errors ───────────────────────────────────────────────────────────

export class PlannerError extends Error {
  constructor(
    public readonly code: 'CYCLE_DETECTED' | 'EMPTY_GRAPH' | 'UNKNOWN_NODE_TYPE' | 'INVALID_EDGE',
    message: string,
  ) {
    super(message);
    this.name = 'PlannerError';
  }
}

// ─── ExecutionPlanner ─────────────────────────────────────────────────────────

export class ExecutionPlanner {
  /**
   * Compile a WorkflowGraph into an ExecutionPlan.
   * Pure function — deterministic for any given graph (Invariant I-10).
   * Throws PlannerError on cycle detection or empty graph.
   */
  static compile(graph: WorkflowGraph): ExecutionPlan {
    const { nodes, edges } = graph;

    if (nodes.length === 0) {
      throw new PlannerError('EMPTY_GRAPH', 'WorkflowGraph contains no nodes. Nothing to execute.');
    }

    // Validate edges reference existing nodes
    const nodeIds = new Set(nodes.map(n => n.id));
    for (const edge of edges) {
      if (!nodeIds.has(edge.source)) {
        throw new PlannerError('INVALID_EDGE', `Edge ${edge.id} references unknown source node: ${edge.source}`);
      }
      if (!nodeIds.has(edge.target)) {
        throw new PlannerError('INVALID_EDGE', `Edge ${edge.id} references unknown target node: ${edge.target}`);
      }
    }

    // Build adjacency and indegree structures
    const adjList: Record<string, string[]> = {};   // source → targets (successors)
    const indegree: Record<string, number> = {};
    const dependencies: Record<string, string[]> = {};

    for (const node of nodes) {
      adjList[node.id] = [];
      indegree[node.id] = 0;
      dependencies[node.id] = [];
    }

    for (const edge of edges) {
      adjList[edge.source].push(edge.target);
      indegree[edge.target]++;
      dependencies[edge.target].push(edge.source);
    }

    // Kahn's algorithm — topological sort with cycle detection
    const queue: string[] = [];
    for (const id of Object.keys(indegree)) {
      if (indegree[id] === 0) queue.push(id);
    }

    const sorted: string[] = [];
    const taskMap: Record<string, PlannedTask> = {};
    let orderIndex = 0;

    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      const node = nodes.find(n => n.id === current)!;
      const retryCount =
        typeof (node.config as any)?.retry === 'number'
          ? (node.config as any).retry
          : graph.executionHints.defaultRetry;
      const timeoutMs =
        typeof (node.config as any)?.timeoutMs === 'number'
          ? (node.config as any).timeoutMs
          : graph.executionHints.defaultTimeoutMs;

      taskMap[current] = {
        taskId: `task_${current}`,
        nodeId: node.id,
        nodeType: node.type,
        config: node.config,
        runOrder: orderIndex++,
        dependsOn: [...dependencies[current]],
        retryCount,
        timeoutMs,
      };

      for (const neighbor of adjList[current]) {
        indegree[neighbor]--;
        if (indegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (sorted.length !== nodes.length) {
      throw new PlannerError(
        'CYCLE_DETECTED',
        `Cycle detected in WorkflowGraph "${graph.name}" (id: ${graph.id}). Compilation failed. ` +
          `Processed ${sorted.length} of ${nodes.length} nodes before deadlock.`,
      );
    }

    return {
      workflowId: graph.id,
      tasks: sorted.map(id => taskMap[id]),
      dependencies,
      successors: adjList,
    };
  }
}
