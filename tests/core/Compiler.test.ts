import { describe, it, expect } from 'vitest';
import { WorkflowCompiler } from '@/platform/AutomationOS/Compiler';
import { WorkflowGraph } from '@/platform/AutomationOS/Types';

describe('WorkflowCompiler (Kahn Topological Sort)', () => {
  it('compiles a linear graph correctly', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: '1', type: 'trigger', data: {}, position: { x: 0, y: 0 } },
        { id: '2', type: 'action', data: {}, position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
      ],
    };

    const result = WorkflowCompiler.compile(graph);
    expect(result.tasks.length).toBe(2);
    expect(result.tasks[0].nodeId).toBe('1');
    expect(result.tasks[1].nodeId).toBe('2');
    expect(result.dependencies['2']).toContain('1');
  });

  it('detects cycles and throws an error', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: '1', type: 'trigger', data: {}, position: { x: 0, y: 0 } },
        { id: '2', type: 'action', data: {}, position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-1', source: '2', target: '1' }, // Cycle
      ],
    };

    expect(() => WorkflowCompiler.compile(graph)).toThrow('Cycle detected in workflow graph! Compilation failed.');
  });
});
