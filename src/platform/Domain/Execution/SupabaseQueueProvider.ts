import { Provider, ExecutionResult } from '@/core/capabilities/types';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/platform/Infrastructure/Logger';

/**
 * Universal Transport Provider for the OS Execution Bus.
 * Blindly enqueues capability payloads (email, sms, push, etc.) into the `execution_queue`
 * table for background processing via Edge Functions or Workers.
 */
export class SupabaseQueueProvider implements Provider {
  name = 'SupabaseQueueProvider';
  type = 'ExecutionProvider' as const;
  capabilities = ['email', 'sms', 'push', 'webhook']; // Handles all OS executions

  async isHealthy(): Promise<boolean> {
    try {
      const { error } = await supabase.from('execution_queue').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async create(data: any): Promise<ExecutionResult> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('User not authenticated');
      }

      // We expect the capability payload to be fully validated by the Router
      const payload = { ...data };
      const capability = payload.type || 'unknown';
      delete payload.id;
      delete payload.type;

      const { data: record, error } = await supabase
        .from('execution_queue')
        .insert({
          capability,
          provider: 'supabase',
          payload,
          priority: data.priority || 0,
          status: 'pending',
          scheduled_at: data.scheduled_at || new Date().toISOString(),
          created_by: userData.user.id
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      return {
        success: true,
        commitmentId: data.id,
        providerData: { queue_id: record.id }
      };
    } catch (err: any) {
      Logger.error(`[SupabaseQueueProvider] Failed to enqueue ${data.type}:`, err.message);
      return {
        success: false,
        commitmentId: data.id,
        error: err.message
      };
    }
  }

  async verify(transactionId: string): Promise<{ verified: boolean; evidence: any }> {
    try {
      // Find the execution queue item to see its terminal state
      const { data, error } = await supabase
        .from('execution_queue')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (error || !data) {
        return { verified: false, evidence: { error: 'Not found' } };
      }

      return {
        verified: data.status === 'completed',
        evidence: data
      };
    } catch (err: any) {
      return { verified: false, evidence: { error: err.message } };
    }
  }
}
