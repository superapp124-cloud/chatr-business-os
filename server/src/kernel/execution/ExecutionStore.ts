import { getTenantSupabaseClient } from '../../utils/supabaseClient.js';
import { TenantContextManager } from '../tenant/TenantContextManager.js';
import { ExecutionContext, IExecutionStore } from '../../types.js';
import { Logger } from '../observability/SystemLogger.js';

export class PostgresExecutionStore implements IExecutionStore {
  
  async saveCheckpoint(context: ExecutionContext): Promise<void> {
    Logger.info(`Checkpointing state for Context ${context.id} at State: ${context.state}`, {
        source: 'ExecutionStore',
        trace: context.trace
    });
    
    if (process.env.VITE_SUPABASE_ANON_KEY === 'dummy') return; // mock for CLI testing

    try {
      const tenantContext = TenantContextManager.getContextOrThrow();
      const supabase = getTenantSupabaseClient(tenantContext.tenant);

      const { error } = await supabase
        .from('os_intents')
        .update({
          status: context.state.toLowerCase(),
          execution_log: context 
        })
        .eq('id', context.id);

      if (error) {
        Logger.error(`Failed to checkpoint context ${context.id}`, {
            source: 'ExecutionStore',
            trace: context.trace,
            error: error
        });
        throw new Error(`ExecutionStore Checkpoint Failed: ${error.message}`);
      }
    } catch (err: any) {
      if (err.message?.includes('fetch failed')) {
        Logger.warn(`Supabase offline. Mock Checkpoint: Context ${context.id}`, {
            source: 'ExecutionStore',
            trace: context.trace
        });
        return;
      }
      throw err;
    }
  }

  async loadExecution(contextId: string): Promise<ExecutionContext | null> {
    if (process.env.VITE_SUPABASE_ANON_KEY === 'dummy') return null;

    try {
      const tenantContext = TenantContextManager.getContextOrThrow();
      const supabase = getTenantSupabaseClient(tenantContext.tenant);

      const { data, error } = await supabase
      .from('os_intents')
      .select('execution_log')
      .eq('id', contextId)
      .single();

    if (error || !data || !data.execution_log) {
      return null;
    }

    return data.execution_log as ExecutionContext;
    } catch (err: any) {
        throw err;
    }
  }

  async completeExecution(contextId: string): Promise<void> {
    if (process.env.VITE_SUPABASE_ANON_KEY === 'dummy') return;

    try {
      const tenantContext = TenantContextManager.getContextOrThrow();
      const supabase = getTenantSupabaseClient(tenantContext.tenant);

      const { error } = await supabase
        .from('os_intents')
        .update({ status: 'completed' })
        .eq('id', contextId);

      if (error) {
        throw new Error(`ExecutionStore Complete Failed: ${error.message}`);
      }
    } catch (err: any) {
      throw err;
    }
  }
}

export let ExecutionStore: IExecutionStore = new PostgresExecutionStore();

export function setExecutionStore(store: IExecutionStore) {
  ExecutionStore = store;
}
