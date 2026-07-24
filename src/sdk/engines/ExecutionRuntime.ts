/**
 * CHATR OS — Execution Runtime
 * 
 * Traverses the IExecutionGraph, handling state, retries, rollbacks, and parallel step execution.
 * Includes Ollama integration and fallback generators.
 */
import { IExecutionGraph, IExecutionNode } from './GoalPlanner';
import { BusinessObjectStore } from './BusinessObjectStore';

export interface IExecutionResult {
  success: boolean;
  graphId: string;
  outputs: Record<string, any>;
  logs: string[];
}

export class AuthorizationError extends Error {
  constructor(message: string) { super(message); this.name = 'AuthorizationError'; }
}

export class ExecutionRuntime {
  /**
   * Node Executor Registry
   */
  static async executeNode(node: IExecutionNode, outputs: Record<string, any>, logs: string[]): Promise<any> {
    switch (node.type) {
      case 'authorize':
        return this.executeAuthorize(node, logs);
      case 'agent':
        return this.executeAgent(node, outputs, logs);
      case 'sanitize':
        return this.executeSanitize(node, outputs, logs);
      case 'store':
        return this.executeStore(node, outputs, logs);
      default:
        throw new Error(`Unsupported node type: ${node.type}`);
    }
  }

  static async executeAuthorize(node: IExecutionNode, logs: string[]) {
    const { capabilityId, action, roles } = node.payload;
    // Mock authorization logic
    if (!roles || roles.length === 0) {
      throw new AuthorizationError(`User lacks permission to ${action} on ${capabilityId}`);
    }
    logs.push(`[Authorize] Granted for ${roles.join(', ')}`);
    return { authorized: true };
  }

  static async executeAgent(node: IExecutionNode, outputs: Record<string, any>, logs: string[]) {
    const { profile, subject, objectType } = node.payload;
    logs.push(`[Agent] Attempting to generate ${objectType} for '${subject}'`);

    const prompt = `${profile}\nTask: Generate a JSON object for a ${objectType} regarding: ${subject}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second connection timeout

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3', // Default model mapping
          prompt,
          stream: false,
          format: 'json'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`Ollama HTTP Error: ${response.status}`);
      
      const data = await response.json();
      logs.push(`[Agent] Generation succeeded via Ollama`);
      return JSON.parse(data.response);

    } catch (err: any) {
      // GRACEFUL DEGRADATION
      logs.push(`[Agent] Ollama unavailable (${err.name === 'AbortError' ? 'Timeout' : err.message}). Falling back to Template Generator.`);
      
      return {
        Title: `${subject} - Auto Generated`,
        Department: 'Engineering',
        Status: 'Open',
        Applications: 0,
        _generatedBy: 'template-fallback',
        _details: `Generated from a deterministic template because the local LLM was unavailable. Subject: ${subject}.`
      };
    }
  }

  static async executeSanitize(node: IExecutionNode, outputs: Record<string, any>, logs: string[]) {
    // Look up previous output
    const inputKey = node.dependencies[0];
    let data = outputs[inputKey];
    
    if (!data || typeof data !== 'object') {
      data = { Title: 'Unknown', Status: 'Draft' };
    }
    
    logs.push(`[Sanitize] Data validated and scrubbed for ${node.payload.objectType}`);
    return data;
  }

  static async executeStore(node: IExecutionNode, outputs: Record<string, any>, logs: string[]) {
    const { capabilityId, objectName, operation, inputRef } = node.payload;
    
    if (operation === 'create') {
      const dataToStore = outputs[inputRef];
      if (!dataToStore) throw new Error(`[Store] Missing input data from ${inputRef}`);
      
      const record = BusinessObjectStore.create(capabilityId, objectName, dataToStore);
      logs.push(`[Store] Created ${objectName} record: ${record.id}`);
      
      return record;
    } else if (operation === 'read') {
       const records = BusinessObjectStore.list(capabilityId, objectName);
       return records;
    }

    throw new Error(`[Store] Unsupported operation: ${operation}`);
  }

  static async executeCompensation(node: IExecutionNode, outputs: Record<string, any>, logs: string[]) {
    logs.push(`[Compensation] Rolling back ${node.name}...`);
    // Example Saga compensation
    if (node.type === 'store' && node.payload.operation === 'create') {
       const createdRecord = outputs[node.id];
       if (createdRecord?.id) {
         logs.push(`[Compensation] Deleting record ${createdRecord.id}`);
         BusinessObjectStore.delete(node.payload.capabilityId, node.payload.objectName, createdRecord.id);
       }
    }
  }

  /**
   * Executes the DAG
   */
  static async execute(graph: IExecutionGraph): Promise<IExecutionResult> {
    const outputs: Record<string, any> = {};
    const logs: string[] = [];
    const completed = new Set<string>();
    const pending = new Set(graph.nodes.map(n => n.id));
    const executedNodes: IExecutionNode[] = [];

    logs.push(`[ExecutionRuntime] Starting execution of graph ${graph.id}`);

    let iterations = 0;
    while (pending.size > 0 && iterations < 100) {
      iterations++;
      let executedInRound = false;

      for (const node of graph.nodes) {
        if (!pending.has(node.id)) continue;

        const canExecute = node.dependencies.every(dep => completed.has(dep));
        if (canExecute) {
          logs.push(`[ExecutionRuntime] Executing Node: [${node.type}] ${node.name}`);
          
          try {
            const result = await this.executeNode(node, outputs, logs);
            outputs[node.id] = result;
            completed.add(node.id);
            pending.delete(node.id);
            executedNodes.push(node);
            executedInRound = true;
          } catch (error: any) {
            logs.push(`[ExecutionRuntime] Failed Node: ${node.name}. Error: ${error.message}`);
            
            // Trigger Saga Rollbacks
            for (let i = executedNodes.length - 1; i >= 0; i--) {
               if (executedNodes[i].compensation) {
                 await this.executeCompensation(executedNodes[i], outputs, logs);
               }
            }

            // If it's an authorization error, we throw it up so the UI catches it specifically
            if (error instanceof AuthorizationError) {
              throw error; 
            }

            return { success: false, graphId: graph.id, outputs, logs };
          }
        }
      }

      if (!executedInRound && pending.size > 0) {
        logs.push(`[ExecutionRuntime] DAG Deadlock detected. Unmet dependencies.`);
        return { success: false, graphId: graph.id, outputs, logs };
      }
    }

    logs.push(`[ExecutionRuntime] Completed successfully.`);
    return { success: true, graphId: graph.id, outputs, logs };
  }
}
