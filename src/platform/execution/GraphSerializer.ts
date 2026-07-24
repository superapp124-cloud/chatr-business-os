/**
 * GraphSerializer — Phase B
 *
 * Responsibilities:
 * 1. Convert React Flow (UI) state into the canonical WorkflowGraph ABI.
 * 2. Convert WorkflowGraph ABI back into React Flow (UI) state.
 * 3. Wrap a WorkflowGraph into a WorkflowPackage for persistence.
 *
 * It does NOT perform validation, migration, or execution planning.
 *
 * Plane: Execution Plane
 * Imports: platform/contracts
 */

import type { WorkflowGraph, WorkflowNode, WorkflowEdge, NodePosition } from '../contracts/WorkflowGraph.abi';
import type { WorkflowPackage } from '../contracts/WorkflowPackage.abi';
import { createEmptyWorkflowGraph } from '../contracts/WorkflowGraph.abi';

export class GraphSerializer {
  /**
   * Convert React Flow state into a canonical WorkflowGraph ABI.
   */
  static serialize(
    rfNodes: any[],
    rfEdges: any[],
    workflowId: string,
    name: string,
    createdBy: string,
    tenantId?: string,
  ): WorkflowGraph {
    const graph = createEmptyWorkflowGraph(workflowId, name, createdBy, tenantId);

    for (const rfNode of rfNodes) {
      // Create ABI node
      let nodeType = rfNode.data?.node?.type || rfNode.type || 'unknown';
      if (nodeType === 'trigger') nodeType = 'core.trigger';
      if (nodeType === 'ai_action') nodeType = 'core.ai_agent';
      if (nodeType === 'email') nodeType = 'core.email';

      const node: WorkflowNode = {
        id: rfNode.id,
        type: nodeType,
        label: rfNode.data?.node?.label || rfNode.data?.label || rfNode.id,
        config: rfNode.data?.config || {},
        position: { x: rfNode.position?.x || 0, y: rfNode.position?.y || 0 },
      };
      graph.nodes.push(node);

      // Store in layout mapping as well, per ABI rules
      graph.layout[node.id] = { x: node.position.x, y: node.position.y };
    }

    for (const rfEdge of rfEdges) {
      const edge: WorkflowEdge = {
        id: rfEdge.id,
        source: rfEdge.source,
        target: rfEdge.target,
        label: rfEdge.label,
      };
      graph.edges.push(edge);
    }

    return graph;
  }

  /**
   * Convert canonical WorkflowGraph ABI into React Flow UI state.
   */
  static deserialize(graph: WorkflowGraph): { nodes: any[]; edges: any[] } {
    const rfNodes = graph.nodes.map(node => {
      const position = graph.layout[node.id] || node.position || { x: 0, y: 0 };
      return {
        id: node.id,
        type: node.type, // Map directly or to 'custom' depending on Studio requirements
        position,
        data: {
          node: { id: node.id, type: node.type, label: node.label },
          config: node.config,
        },
      };
    });

    const rfEdges = graph.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
    }));

    return { nodes: rfNodes, edges: rfEdges };
  }

  /**
   * Wrap a WorkflowGraph into a WorkflowPackage for persistence/export.
   */
  static pack(graph: WorkflowGraph, description: string = ''): WorkflowPackage {
    const pkg: WorkflowPackage = {
      schemaVersion: '1.0.0',
      id: graph.id,
      name: graph.name,
      description,
      graph,
      permissions: graph.permissions,
      policies: [],
      tests: [],
      readme: '',
      checksum: '', // Hash logic applied later during publish/export
      exportedAt: new Date().toISOString(),
      exportedBy: 'chatr-studio',
    };
    return pkg;
  }
}
