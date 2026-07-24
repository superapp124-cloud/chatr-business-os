import { describe, it, expect } from 'vitest';
import { GraphSerializer } from '../../src/platform/execution/GraphSerializer';
import { GraphValidator, GraphValidationError } from '../../src/platform/execution/GraphValidator';

describe('Phase B: Canonical Workflow Graph', () => {
  describe('GraphSerializer', () => {
    it('serializes ReactFlow state into a valid WorkflowGraph ABI', () => {
      const rfNodes = [
        { id: 'n1', type: 'trigger', position: { x: 10, y: 10 }, data: { label: 'Start' } },
        { id: 'n2', type: 'ai_action', position: { x: 50, y: 50 }, data: { config: { model: 'gpt-4' } } }
      ];
      const rfEdges = [
        { id: 'e1', source: 'n1', target: 'n2' }
      ];

      const graph = GraphSerializer.serialize(rfNodes, rfEdges, 'wf-1', 'Test', 'user-1');
      
      expect(graph.schemaVersion).toBe('1.0.0');
      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toHaveLength(1);
      
      // Node type mapping
      expect(graph.nodes[0].type).toBe('core.trigger');
      expect(graph.nodes[1].type).toBe('core.ai_agent');
      
      // Layout extraction
      expect(graph.layout['n1']).toEqual({ x: 10, y: 10 });
      
      // Edges preservation
      expect(graph.edges[0].source).toBe('n1');
      expect(graph.edges[0].target).toBe('n2');
    });

    it('deserializes WorkflowGraph back to ReactFlow isomorphic structure', () => {
      const rfNodes = [
        { id: 'n1', type: 'trigger', position: { x: 0, y: 0 }, data: { label: 'Start' } }
      ];
      const graph = GraphSerializer.serialize(rfNodes, [], 'wf-1', 'Test', 'user-1');
      
      const deserialized = GraphSerializer.deserialize(graph);
      expect(deserialized.nodes).toHaveLength(1);
      expect(deserialized.nodes[0].id).toBe('n1');
      expect(deserialized.nodes[0].type).toBe('core.trigger');
    });
  });

  describe('GraphValidator', () => {
    it('passes a valid graph', () => {
      const graph = GraphSerializer.serialize(
        [
          { id: 'start', type: 'trigger', position: { x: 0, y: 0 } },
          { id: 'next', type: 'email', position: { x: 0, y: 0 } }
        ],
        [{ id: 'e1', source: 'start', target: 'next' }],
        'wf-1', 'Test', 'user-1'
      );
      
      expect(() => GraphValidator.validate(graph)).not.toThrow();
    });

    it('rejects graph with missing trigger node', () => {
      const graph = GraphSerializer.serialize(
        [
          { id: 'node1', type: 'email', position: { x: 0, y: 0 } }
        ],
        [],
        'wf-1', 'Test', 'user-1'
      );
      
      expect(() => GraphValidator.validate(graph)).toThrow(GraphValidationError);
      expect(() => GraphValidator.validate(graph)).toThrow(/Missing start node/);
    });

    it('rejects graph with unreachable nodes', () => {
      const graph = GraphSerializer.serialize(
        [
          { id: 'start', type: 'trigger', position: { x: 0, y: 0 } },
          { id: 'unreachable', type: 'email', position: { x: 0, y: 0 } }
        ],
        [], // No edges
        'wf-1', 'Test', 'user-1'
      );
      
      expect(() => GraphValidator.validate(graph)).toThrow(/Orphan node/);
    });

    it('rejects graph with invalid edges', () => {
      const graph = GraphSerializer.serialize(
        [
          { id: 'start', type: 'trigger', position: { x: 0, y: 0 } }
        ],
        [{ id: 'e1', source: 'start', target: 'missing' }],
        'wf-1', 'Test', 'user-1'
      );
      
      expect(() => GraphValidator.validate(graph)).toThrow(/references missing target node/);
    });
  });

  describe('WorkflowPackage', () => {
    it('packs graph into valid export format', () => {
      const graph = GraphSerializer.serialize(
        [{ id: 'n1', type: 'trigger', position: { x: 0, y: 0 } }],
        [],
        'wf-1', 'Test', 'user-1'
      );
      
      const pkg = GraphSerializer.pack(graph, 'Desc');
      expect(pkg.schemaVersion).toBe('1.0.0');
      expect(pkg.graph).toEqual(graph);
      expect(pkg.id).toBe('wf-1');
      expect(pkg.description).toBe('Desc');
    });
  });
});
