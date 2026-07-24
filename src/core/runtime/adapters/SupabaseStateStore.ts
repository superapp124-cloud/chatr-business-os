import { IWorkflowStateStore } from '../WorkflowStateStore';
import { IWorkflowContext } from '../PipelineEngine';
import { supabase } from '@/integrations/supabase/client';

export class SupabaseStateStore implements IWorkflowStateStore {
  async saveState(context: IWorkflowContext, currentNode?: string, status?: string): Promise<void> {
    const payload = {
      instance_id: context.id,
      definition_id: context.type,
      status: status || 'RUNNING',
      current_node: currentNode || null,
      context: context,
      execution_context: {
        timestamp: Date.now()
      },
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('workflow_state')
      .upsert(payload, { onConflict: 'instance_id' });

    if (error) {
      console.error('[SupabaseStateStore] Error saving workflow state:', error);
      throw new Error(`Failed to save workflow state: ${error.message}`);
    }
  }

  async loadState(workflowId: string): Promise<IWorkflowContext | null> {
    const { data, error } = await supabase
      .from('workflow_state')
      .select('*')
      .eq('instance_id', workflowId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('[SupabaseStateStore] Error loading workflow state:', error);
      throw new Error(`Failed to load workflow state: ${error.message}`);
    }

    return data.context as IWorkflowContext;
  }

  async saveCheckpoint(workflowId: string, nodeId: string, snapshot: any): Promise<void> {
    const payload = {
      instance_id: workflowId,
      node_id: nodeId,
      state_snapshot: snapshot
    };

    const { error } = await supabase
      .from('workflow_checkpoints')
      .insert(payload);

    if (error) {
      console.error('[SupabaseStateStore] Error saving checkpoint:', error);
      throw new Error(`Failed to save checkpoint: ${error.message}`);
    }
  }

  async getCheckpoints(workflowId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('workflow_checkpoints')
      .select('*')
      .eq('instance_id', workflowId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[SupabaseStateStore] Error getting checkpoints:', error);
      throw new Error(`Failed to get checkpoints: ${error.message}`);
    }

    return data || [];
  }
}
