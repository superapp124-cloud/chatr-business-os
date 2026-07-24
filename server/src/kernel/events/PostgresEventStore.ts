import { getTenantSupabaseClient } from '../../utils/supabaseClient.js';
import { TenantContextManager } from '../tenant/TenantContextManager.js';
import { IEventStore, StoredEvent } from '../../types.js';
import { Logger } from '../observability/SystemLogger.js';

export class PostgresEventStore implements IEventStore {
  
  async append(streamId: string, event: StoredEvent): Promise<void> {
    if (process.env.VITE_SUPABASE_ANON_KEY === 'dummy') {
      Logger.debug(`Mock Appended: ${event.eventType} (seq ${event.sequence})`, {
        source: 'PostgresEventStore',
        streamId
      });
      return;
    }

    try {
      const context = TenantContextManager.getContextOrThrow();
      const supabase = getTenantSupabaseClient(context.tenant);
      const { error } = await supabase
        .from('os_events')
        .insert([event]);
        
      if (error) {
        if (error.code === '42P01') { 
          Logger.warn(`Table 'os_events' missing. Falling back to stdout for ${event.eventType}`, {
            source: 'PostgresEventStore',
            streamId
          });
          return;
        }
        throw new Error(`Failed to append event to stream ${streamId}: ${error.message}`);
      }
    } catch (err: any) {
      if (err.message?.includes('fetch failed')) {
        Logger.warn(`Supabase offline. Mock Appended: ${event.eventType} (seq ${event.sequence})`, {
            source: 'PostgresEventStore',
            streamId
        });
        return;
      }
      throw err;
    }
  }

  async readStream(streamId: string): Promise<StoredEvent[]> {
    if (process.env.VITE_SUPABASE_ANON_KEY === 'dummy') {
      return [];
    }

    try {
      const context = TenantContextManager.getContextOrThrow();
      const supabase = getTenantSupabaseClient(context.tenant);

      const { data, error } = await supabase
      .from('os_events')
      .select('*')
      .eq('streamId', streamId)
      .order('sequence', { ascending: true });

    if (error) throw new Error(`Failed to read stream ${streamId}: ${error.message}`);
    return data as StoredEvent[];
    } catch (err: any) {
        throw err;
    }
  }

  async readCategory(category: string): Promise<StoredEvent[]> {
    if (process.env.VITE_SUPABASE_ANON_KEY === 'dummy') {
      return [];
    }
    
    try {
      const context = TenantContextManager.getContextOrThrow();
      const supabase = getTenantSupabaseClient(context.tenant);

      const { data, error } = await supabase
      .from('os_events')
      .select('*')
      .like('eventType', `${category}.%`)
      .order('metadata->>timestamp', { ascending: true });

    if (error) throw new Error(`Failed to read category ${category}: ${error.message}`);
    return data as StoredEvent[];
    } catch (err: any) {
        throw err;
    }
  }
}
