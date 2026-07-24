import { getSystemSupabaseClient } from '../../utils/supabaseClient.js';
import { ExecutionContext } from '../../types.js';

export class SystemRepository {
  /**
   * Retrieves all executions in the 'executing' state, bypassing RLS.
   * This is exclusively used by the RecoveryEngine to detect crashed instances globally.
   */
  static async getOrphanedExecutions(): Promise<{ id: string, execution_log: ExecutionContext }[]> {
    const supabase = getSystemSupabaseClient();
    const { data, error } = await supabase
      .from('os_intents')
      .select('id, execution_log')
      .eq('status', 'executing');

    if (error) {
      throw new Error(`SystemRepository failed to fetch orphaned executions: ${error.message}`);
    }

    return data || [];
  }
}
