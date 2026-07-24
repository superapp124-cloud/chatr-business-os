
import { WorkflowGraph, ExecutionGraph, ExecutionTask, OSNode, OSEdge } from './Types';

export class WorkflowCompiler {
  static compile(graph: WorkflowGraph): ExecutionGraph {
    const { nodes, edges } = graph;
    
    // 1. Build Adjacency List and Indegree map
    const adjList: Record<string, string[]> = {};
    const indegree: Record<string, number> = {};
    const dependencies: Record<string, string[]> = {};

    nodes.forEach(n => {
      adjList[n.id] = [];
      indegree[n.id] = 0;
      dependencies[n.id] = [];
    });

    edges.forEach(e => {
      if (adjList[e.source] && indegree[e.target] !== undefined) {
        adjList[e.source].push(e.target);
        indegree[e.target]++;
        dependencies[e.target].push(e.source);
      }
    });

    // 2. Topological Sort (Kahn's Algorithm) & Cycle Detection
    const queue: string[] = [];
    Object.keys(indegree).forEach(id => {
      if (indegree[id] === 0) queue.push(id);
    });

    const sortedOrder: string[] = [];
    let orderIndex = 0;
    const taskMap: Record<string, ExecutionTask> = {};

    while (queue.length > 0) {
      const current = queue.shift()!;
      sortedOrder.push(current);
      
      const node = nodes.find(n => n.id === current)!;
      taskMap[current] = {
        id: `task_${current}`,
        nodeId: node.id,
        type: node.type,
        data: node.data,
        runOrder: orderIndex++
      };

      adjList[current].forEach(neighbor => {
        indegree[neighbor]--;
        if (indegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      });
    }

    if (sortedOrder.length !== nodes.length) {
      throw new Error("Cycle detected in workflow graph! Compilation failed.");
    }

    return {
      tasks: sortedOrder.map(id => taskMap[id]),
      dependencies
    };
  }
}
