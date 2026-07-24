import { IWorkflowContext } from './PipelineEngine';

export interface IWorkflowStateStore {
  saveState(context: IWorkflowContext, currentNode?: string, status?: string): Promise<void>;
  loadState(workflowId: string): Promise<IWorkflowContext | null>;
  saveCheckpoint(workflowId: string, nodeId: string, snapshot: any): Promise<void>;
  getCheckpoints(workflowId: string): Promise<any[]>;
}

export class MemoryWorkflowStateStore implements IWorkflowStateStore {
  private states = new Map<string, IWorkflowContext>();
  private checkpoints = new Map<string, any[]>();

  async saveState(context: IWorkflowContext, currentNode?: string, status?: string): Promise<void> {
    this.states.set(context.id, JSON.parse(JSON.stringify(context))); // Deep copy
  }

  async loadState(workflowId: string): Promise<IWorkflowContext | null> {
    const state = this.states.get(workflowId);
    return state ? JSON.parse(JSON.stringify(state)) : null;
  }

  async saveCheckpoint(workflowId: string, nodeId: string, snapshot: any): Promise<void> {
    const list = this.checkpoints.get(workflowId) || [];
    list.push({ nodeId, snapshot: JSON.parse(JSON.stringify(snapshot)), timestamp: Date.now() });
    this.checkpoints.set(workflowId, list);
  }

  async getCheckpoints(workflowId: string): Promise<any[]> {
    return this.checkpoints.get(workflowId) || [];
  }
}

export let workflowStateStore: IWorkflowStateStore = new MemoryWorkflowStateStore();

export function setWorkflowStateStore(adapter: IWorkflowStateStore) {
  workflowStateStore = adapter;
}
