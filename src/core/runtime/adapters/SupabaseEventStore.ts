import { IEventStoreAdapter } from '../EventRuntime';
import { CHATREvent } from '../types';
import { supabase } from '@/integrations/supabase/client';
import { eventBus } from '../EventBus';
import { eventRuntime } from '../EventRuntime';

export class SupabaseEventStore implements IEventStoreAdapter {
  async writeBatch(events: CHATREvent[]): Promise<void> {
    if (events.length === 0) return;

    // Map CHATREvent to the database schema for platform_events
    const rows = events.map(e => ({
      // We assume e.id might not exist, but usually it does. The DB uses default uuid_generate_v4() if not provided.
      id: e.id || crypto.randomUUID(), 
      stream_id: 'system', // For now, all events go to the 'system' stream unless specified
      version: Date.now() * 1000 + Math.floor(Math.random() * 1000), // Simple optimistic concurrency ordering
      type: e.type,
      payload: e.payload || {},
      execution_context: {
        timestamp: e.timestamp,
        priority: e.priority
      }
    }));

    const { error, data } = await supabase.functions.invoke('persist-events', {
      body: { events: rows }
    });

    if (error) {
      console.error('[SupabaseEventStore] Failed to persist batch via Edge Function:', error);
      // Publish to DLQ or handle failure
      eventBus.publish('EVENT_PERSISTENCE_FAILED', {
        error,
        count: events.length
      });
      throw new Error(`Persistence failed: ${error.message}`);
    }
  }

  async query(filters: any): Promise<CHATREvent[]> {
    let query = supabase.from('platform_events').select('*').order('version', { ascending: true });

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.stream_id) {
      query = query.eq('stream_id', filters.stream_id);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[SupabaseEventStore] Query failed:', error);
      throw new Error(`Query failed: ${error.message}`);
    }

    // Map DB row back to CHATREvent
    return (data || []).map(row => ({
      id: row.id,
      type: row.type,
      payload: row.payload,
      timestamp: row.execution_context?.timestamp || new Date(row.created_at).getTime(),
      priority: row.execution_context?.priority || 1
    } as CHATREvent));
  }

  public enableRealtimeBroadcast() {
    console.info('[SupabaseEventStore] Enabling Realtime broadcast for platform_events');
    
    // Stage 1.3: Instruct the local runtime to skip local delivery for persistent events
    // and wait for the round-trip from the realtime broadcast instead.
    eventRuntime.realtimeActive = true;

    supabase.channel('platform_events_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'platform_events' },
        (payload) => {
          const row = payload.new;
          // Reconstruct the event
          const event: CHATREvent = {
            id: row.id,
            type: row.type,
            payload: row.payload,
            timestamp: row.execution_context?.timestamp || new Date(row.created_at).getTime(),
            priority: row.execution_context?.priority || 1,
            source: 'supabase-realtime',
            persist: false // Already persisted!
          };
          
          // Dispatch it directly to the local memory EventBus for the UI to consume
          console.log(`[SupabaseEventStore] Realtime Event Received: ${event.type}`);
          eventBus.publish(event.type, event.payload, { 
            id: event.id,
            source: 'supabase-realtime',
            persist: false,
            timestamp: event.timestamp,
            priority: event.priority
          });
        }
      )
      .subscribe();
  }
}
