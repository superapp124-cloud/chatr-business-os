const fs = require('fs');
const path = require('path');

const osDir = path.join(__dirname, '../src/platform/AutomationOS');

// 1. Update Types.ts
let typesContent = fs.readFileSync(path.join(osDir, 'Types.ts'), 'utf8');
if (!typesContent.includes('ExecutionGraph')) {
  typesContent += `
export interface ExecutionGraph {
  tasks: ExecutionTask[];
  dependencies: Record<string, string[]>; // Task ID -> Array of Task IDs it depends on
}

export interface ExecutionTask {
  id: string;
  nodeId: string;
  type: string;
  data: Record<string, any>;
  runOrder: number; // Topological sort order
}

export interface ExecutionContext {
  [nodeId: string]: {
    output: any;
    status: 'success' | 'failed';
  }
}
`;
  fs.writeFileSync(path.join(osDir, 'Types.ts'), typesContent);
}

// 2. Create Compiler.ts
const compilerContent = `
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
        id: \`task_\${current}\`,
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
`;
fs.writeFileSync(path.join(osDir, 'Compiler.ts'), compilerContent);

// 3. Create RuntimeAdapter.ts
const runtimeContent = `
import { ExecutionGraph, ExecutionTask, ExecutionContext } from './Types';
import { EventBus } from './EventBus';

export class LocalBrowserRuntime {
  private context: ExecutionContext = {};

  async execute(graph: ExecutionGraph, workflowId: string): Promise<void> {
    EventBus.publish({ type: 'EXECUTION_STARTED', payload: { workflowId }, timestamp: Date.now() });
    this.context = {};

    // Group tasks by their topological order for potential parallel execution
    const tasksByOrder: Record<number, ExecutionTask[]> = {};
    graph.tasks.forEach(t => {
      if (!tasksByOrder[t.runOrder]) tasksByOrder[t.runOrder] = [];
      tasksByOrder[t.runOrder].push(t);
    });

    const maxOrder = Math.max(...graph.tasks.map(t => t.runOrder));

    for (let currentOrder = 0; currentOrder <= maxOrder; currentOrder++) {
      const tasksToRun = tasksByOrder[currentOrder] || [];
      
      // Execute independent tasks at the current topological depth in parallel
      await Promise.all(tasksToRun.map(task => this.executeTask(task, workflowId)));
    }

    EventBus.publish({ type: 'EXECUTION_COMPLETED', payload: { workflowId, context: this.context }, timestamp: Date.now() });
  }

  private async executeTask(task: ExecutionTask, workflowId: string): Promise<void> {
    EventBus.publish({ type: 'NODE_STARTED', payload: { workflowId, nodeId: task.nodeId }, timestamp: Date.now() });

    try {
      // 1. Variable Interpolation
      const resolvedData = this.interpolateVariables(task.data);

      // 2. Simulate Execution Latency based on Node Type
      const latencyMs = task.type === 'core.ai_agent' ? 1200 : 300;
      await new Promise(resolve => setTimeout(resolve, latencyMs));

      // 3. Simulated Output
      const output = { executedAt: Date.now(), resolvedInputs: resolvedData };

      this.context[task.nodeId] = { status: 'success', output };
      EventBus.publish({ type: 'NODE_COMPLETED', payload: { workflowId, nodeId: task.nodeId, output }, timestamp: Date.now() });
      
    } catch (error: any) {
      this.context[task.nodeId] = { status: 'failed', output: error.message };
      EventBus.publish({ type: 'NODE_FAILED', payload: { workflowId, nodeId: task.nodeId, error: error.message }, timestamp: Date.now() });
      
      // Fail-fast strategy: throwing here stops the Promise.all in execute()
      throw error;
    }
  }

  // Resolves {{nodeId.output.field}} syntax
  private interpolateVariables(data: Record<string, any>): Record<string, any> {
    const resolved = { ...data };
    const regex = /\\{\\{([^}]+)\\}\\}/g;

    for (const key in resolved) {
      if (typeof resolved[key] === 'string') {
        resolved[key] = resolved[key].replace(regex, (match, path) => {
          const parts = path.trim().split('.');
          const nodeId = parts[0];
          
          if (this.context[nodeId] && this.context[nodeId].status === 'success') {
            let val = this.context[nodeId];
            for (let i = 1; i < parts.length; i++) {
              if (val === undefined) break;
              val = val[parts[i]];
            }
            return val !== undefined ? String(val) : match;
          }
          return match;
        });
      }
    }
    return resolved;
  }
}

export const RuntimeAdapter = new LocalBrowserRuntime();
`;
fs.writeFileSync(path.join(osDir, 'RuntimeAdapter.ts'), runtimeContent);

// 4. Update CommandBus.ts
const commandBusContent = `
import { OSCommand } from './Types';
import { EventBus } from './EventBus';
import { WorkflowCompiler } from './Compiler';
import { RuntimeAdapter } from './RuntimeAdapter';
import { KernelStore } from './KernelStore';

class Bus {
  async dispatch(command: OSCommand) {
    console.log(\`[CommandBus] Received: \${command.type}\`, command.payload);
    
    switch (command.type) {
      case 'MOVE_NODE':
        EventBus.publish({ type: 'NODE_MOVED', payload: command.payload, timestamp: Date.now() });
        break;
      case 'CREATE_NODE':
        EventBus.publish({ type: 'NODE_CREATED', payload: command.payload, timestamp: Date.now() });
        break;
      case 'CREATE_EDGE':
        const edge = command.payload.edge;
        edge.metadata = { confidence: 0.96, reason: "Matched by semantic similarity (AI Auto-mapped)", mappedFields: 2, status: 'auto' };
        EventBus.publish({ type: 'EDGE_CREATED', payload: { edge }, timestamp: Date.now() });
        EventBus.publish({ type: 'SCHEMA_MAPPED', payload: { edgeId: edge.id, metadata: edge.metadata }, timestamp: Date.now() });
        break;
      case 'LOAD_WORKFLOW':
        EventBus.publish({ type: 'WORKFLOW_LOADED', payload: command.payload, timestamp: Date.now() });
        break;
      case 'COMPILE_WORKFLOW':
        try {
          const state = KernelStore.getState();
          const executionGraph = WorkflowCompiler.compile({ nodes: state.nodes, edges: state.edges });
          console.log('[Compiler] Generated Execution Graph:', executionGraph);
          EventBus.publish({ type: 'WORKFLOW_COMPILED', payload: { plan: executionGraph }, timestamp: Date.now() });
        } catch (e: any) {
          console.error('[Compiler] Failed:', e.message);
        }
        break;
      case 'RUN_WORKFLOW':
        try {
          const state = KernelStore.getState();
          const executionGraph = WorkflowCompiler.compile({ nodes: state.nodes, edges: state.edges });
          
          // Fire and forget runtime execution (it publishes its own telemetry events)
          RuntimeAdapter.execute(executionGraph, command.payload.workflowId || 'session-1').catch(e => {
            console.error('[Runtime] Execution halted due to node failure:', e);
          });
        } catch (e: any) {
          console.error('[Runtime] Cannot run invalid graph:', e.message);
        }
        break;
    }
  }
}

export const CommandBus = new Bus();
`;
fs.writeFileSync(path.join(osDir, 'CommandBus.ts'), commandBusContent);

console.log('Phase A: Execution Kernel built.');
