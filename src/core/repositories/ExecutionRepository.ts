import { storageEngine } from '../storage/StorageEngine';

export interface Execution {
  id: string;
  workflow_id: string;
  owner_id: string;
  correlation_id: string;
  status: string;
  started_at: number;
  deadline_at: number | null;
  last_heartbeat_at: number;
  completed_at: number | null;
  execution_graph: string;
  current_node_ids: string;
  completed_node_ids: string;
  failed_node_ids: string;
  pending_node_ids: string;
  current_context_version: number;
  retry_count: number;
  compensation_stack: string;
  cancellation_token: string | null;
  created_at: number;
  updated_at: number;
  created_by: string;
  version: number;
}

export class ExecutionRepository {
  public async create(execution: Execution): Promise<void> {
    const adapter = storageEngine.getAdapter();
    await adapter.insert('executions', {
      ...execution
    });
  }

  public async saveContextVersion(id: string, version: number, context: any): Promise<void> {
    const adapter = storageEngine.getAdapter();
    await adapter.insert('execution_contexts', {
      execution_id: id,
      version: version,
      payload: JSON.stringify(context),
      created_at: Date.now()
    });
    await adapter.update('executions', { current_context_version: version, updated_at: Date.now() }, { id });
  }

  public async findActive(): Promise<Execution[]> {
    const adapter = storageEngine.getAdapter();
    return await adapter.query<Execution>("SELECT * FROM executions WHERE status IN ('RUNNING', 'WAITING_USER', 'WAITING_PROVIDER', 'RETRYING', 'RESUMING', 'COMPENSATING')");
  }

  public async findById(id: string): Promise<Execution | null> {
    const adapter = storageEngine.getAdapter();
    const rows = await adapter.query<Execution>('SELECT * FROM executions WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
  }
}

export const executionRepository = new ExecutionRepository();
