import { storageEngine } from '../storage/StorageEngine';

export interface Workflow {
  id: string;
  intent_id: string;
  capability_id: string;
  execution_graph: string;
  status: string;
  created_at: number;
  updated_at: number;
  created_by: string;
  correlation_id: string;
  version: number;
}

export class WorkflowRepository {
  public async create(workflow: Workflow): Promise<void> {
    const adapter = storageEngine.getAdapter();
    await adapter.insert('workflows', {
      ...workflow
    });
  }

  public async updateStatus(id: string, status: string): Promise<void> {
    const adapter = storageEngine.getAdapter();
    await adapter.update('workflows', { status, updated_at: Date.now() }, { id });
  }

  public async findById(id: string): Promise<Workflow | null> {
    const adapter = storageEngine.getAdapter();
    const rows = await adapter.query<Workflow>('SELECT * FROM workflows WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
  }
}

export const workflowRepository = new WorkflowRepository();
