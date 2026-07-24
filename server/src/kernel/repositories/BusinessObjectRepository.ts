import { getTenantSupabaseClient } from '../../utils/supabaseClient.js';
import { TenantContextManager } from '../tenant/TenantContextManager.js';

export class BusinessObjectRepository {
  /**
   * Persists a newly created generic business object.
   */
  static async insertObject(woParams: any): Promise<any> {
    const context = TenantContextManager.getContextOrThrow();
    const supabase = getTenantSupabaseClient(context.tenant);

    const { data: wo, error } = await supabase
      .from('os_work_objects')
      .insert([woParams])
      .select()
      .single();

    if (error || !wo) throw new Error(`Database Insert Failed: ${error?.message}`);

    return wo;
  }
}
