import { EventStore } from './EventStore';
import { InMemoryEventStore } from './InMemoryEventStore';
import { PostgresEventStore } from './PostgresEventStore';
import { createClient } from '@supabase/supabase-js';

export class EventStoreFactory {
  /**
   * Returns the appropriate EventStore based on the environment configuration.
   * Defaults to InMemoryEventStore in development/testing to remove infrastructure friction,
   * while maintaining full compatibility with the Kernel architecture.
   */
  static create(): EventStore {
    const isProduction = import.meta.env?.PROD === true;
    
    // For now, if we don't have a service role key, we default to InMemory for local Kernel execution
    // to bypass RLS issues during the Strangler Pattern migration.
    const useInMemory = import.meta.env?.VITE_USE_IN_MEMORY_EVENT_STORE === 'true' || !isProduction;

    if (useInMemory) {
      console.log('[EventStoreFactory] Using InMemoryEventStore');
      return new InMemoryEventStore();
    }

    console.log('[EventStoreFactory] Using PostgresEventStore');
    const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'http://localhost:54321';
    const supabaseKey = import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY || 'placeholder';
    const supabase = createClient(supabaseUrl, supabaseKey);
    return new PostgresEventStore(supabase);
  }
}
