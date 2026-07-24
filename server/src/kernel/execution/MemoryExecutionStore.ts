import { ExecutionContext, IExecutionStore } from '../../types.js';
import { Logger } from '../observability/SystemLogger.js';

export class MemoryExecutionStore implements IExecutionStore {
  private checkpoints: Map<string, ExecutionContext[]> = new Map();

  async saveCheckpoint(context: ExecutionContext): Promise<void> {
    Logger.info(`[Memory] Checkpointing state for Context ${context.id} at State: ${context.state}`, {
        source: 'MemoryExecutionStore',
        trace: context.trace
    });

    if (!this.checkpoints.has(context.id)) {
      this.checkpoints.set(context.id, []);
    }
    
    // Deep copy to prevent reference mutation in memory
    const snapshot = JSON.parse(JSON.stringify(context));
    this.checkpoints.get(context.id)!.push(snapshot);
  }

  // Helper for testing
  getCheckpoints(contextId: string): ExecutionContext[] {
    return this.checkpoints.get(contextId) || [];
  }

  // Helper for testing
  clear(): void {
    this.checkpoints.clear();
  }
}
