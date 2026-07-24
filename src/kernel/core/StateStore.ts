import { IntentExecutionGraph } from './types/ABI';

/**
 * StateStore manages the lifecycle and persistence of the Intent Execution Graph.
 * In v0.1, this is an in-memory repository to prove event-driven transitions.
 */
export class KernelStateStore {
  private graphs: Map<string, IntentExecutionGraph> = new Map();

  /**
   * Save or update an execution graph
   */
  async save(graph: IntentExecutionGraph): Promise<void> {
    this.graphs.set(graph.intent.id, graph);
    // In future versions, this will persist to IndexedDB/Postgres for durability
  }

  /**
   * Retrieve an execution graph by intent ID
   */
  async get(intentId: string): Promise<IntentExecutionGraph | null> {
    return this.graphs.get(intentId) || null;
  }

  /**
   * Get all active graphs
   */
  async getActive(): Promise<IntentExecutionGraph[]> {
    return Array.from(this.graphs.values()).filter(g => 
      !['Archived', 'Verified', 'PartiallyCompleted'].includes(g.state)
    );
  }
}

export const stateStore = new KernelStateStore();
