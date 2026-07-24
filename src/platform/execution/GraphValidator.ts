/**
 * GraphValidator — Phase B
 *
 * Runs before the ExecutionPlanner to catch structural and semantic issues early.
 * The validator becomes the compiler's first stage.
 *
 * Checks:
 * - Schema version valid
 * - Exactly one start node (trigger)
 * - No duplicate node IDs
 * - No duplicate edge IDs
 * - Invalid edges (source/target missing)
 * - No orphan nodes (nodes with 0 edges, unless it's a 1-node graph)
 * - No unreachable nodes (must trace back to a trigger)
 *
 * Plane: Execution Plane
 * Imports: platform/contracts
 */

import type { WorkflowGraph } from '../contracts/WorkflowGraph.abi';

export class GraphValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Graph validation failed:\n- ${issues.join('\n- ')}`);
    this.name = 'GraphValidationError';
  }
}

export class GraphValidator {
  /**
   * Validates a canonical WorkflowGraph for structural integrity.
   * Throws GraphValidationError if any fatal issues are found.
   */
  static validate(graph: WorkflowGraph): void {
    const issues: string[] = [];

    // 1. Schema version
    if (graph.schemaVersion !== '1.0.0') {
      issues.push(`Invalid schemaVersion: expected "1.0.0", got "${graph.schemaVersion}"`);
    }

    // 2. Duplicate Node IDs
    const nodeIds = new Set<string>();
    for (const node of graph.nodes) {
      if (nodeIds.has(node.id)) {
        issues.push(`Duplicate node ID found: ${node.id}`);
      }
      nodeIds.add(node.id);
    }

    // 3. Duplicate Edge IDs
    const edgeIds = new Set<string>();
    for (const edge of graph.edges) {
      if (edgeIds.has(edge.id)) {
        issues.push(`Duplicate edge ID found: ${edge.id}`);
      }
      edgeIds.add(edge.id);
    }

    // 4. Invalid Edges (dangling references)
    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.source)) {
        issues.push(`Edge ${edge.id} references missing source node: ${edge.source}`);
      }
      if (!nodeIds.has(edge.target)) {
        issues.push(`Edge ${edge.id} references missing target node: ${edge.target}`);
      }
    }

    // 5. Start Nodes (Triggers)
    const triggerNodes = graph.nodes.filter(n => n.type === 'core.trigger' || n.type === 'trigger');
    if (triggerNodes.length === 0 && graph.nodes.length > 0) {
      issues.push('Missing start node: graph must contain at least one trigger node');
    } else if (triggerNodes.length > 1) {
      issues.push(`Exactly one start node is allowed, but found ${triggerNodes.length}`);
    }

    // 6. Connectivity Analysis (Orphans and Reachability)
    if (graph.nodes.length > 1) {
      const adjList: Record<string, string[]> = {};
      const connectedNodeIds = new Set<string>();

      for (const node of graph.nodes) {
        adjList[node.id] = [];
      }

      for (const edge of graph.edges) {
        if (adjList[edge.source]) {
          adjList[edge.source].push(edge.target);
          connectedNodeIds.add(edge.source);
          connectedNodeIds.add(edge.target);
        }
      }

      // Check for structural orphans (nodes with 0 edges in a multi-node graph)
      for (const node of graph.nodes) {
        if (!connectedNodeIds.has(node.id)) {
          issues.push(`Orphan node found: ${node.id} has no connections`);
        }
      }

      // Reachability analysis from trigger(s)
      const reachable = new Set<string>();
      const queue = triggerNodes.map(n => n.id);
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (!reachable.has(current)) {
          reachable.add(current);
          const neighbors = adjList[current] || [];
          queue.push(...neighbors);
        }
      }

      for (const node of graph.nodes) {
        // Warning or error? We treat it as an error for strict compilation
        if (!reachable.has(node.id) && connectedNodeIds.has(node.id)) {
          issues.push(`Unreachable node found: ${node.id} cannot be reached from any trigger`);
        }
      }
    }

    if (issues.length > 0) {
      throw new GraphValidationError(issues);
    }
  }
}
