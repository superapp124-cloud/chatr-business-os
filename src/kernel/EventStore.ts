import { supabase } from '@/integrations/supabase/client'; // Assuming standard location

export interface OS_Event {
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  payload: any;
  metadata?: any;
}

export class EventStore {
  /**
   * Persists an event to the sys_event_store table.
   * Supports comprehensive audit trailing: Logins, Intents, AI Prompts, Denials, Configuration Changes.
   */
  static async append(event: OS_Event, context: any) {
    if (!context?.organizationId) return; // Cannot store without org context

    try {
      // Get current version for the aggregate
      const { data: latestEvent } = await supabase
        .from('sys_event_store')
        .select('version')
        .eq('aggregate_id', event.aggregateId)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      const nextVersion = latestEvent ? latestEvent.version + 1 : 1;

      const { error } = await supabase.from('sys_event_store').insert({
        organization_id: context.organizationId,
        event_type: event.eventType,
        aggregate_id: event.aggregateId,
        aggregate_type: event.aggregateType,
        payload: event.payload,
        metadata: event.metadata || {},
        version: nextVersion,
        actor_id: context.userId,
      });

      if (error) {
        console.error('Failed to append event to store', error);
      }
    } catch (e) {
      console.error('Event store exception', e);
    }
  }

  static async getEventsForAggregate(aggregateId: string) {
    const { data, error } = await supabase
      .from('sys_event_store')
      .select('*')
      .eq('aggregate_id', aggregateId)
      .order('version', { ascending: true });
      
    if (error) throw error;
    return data;
  }
}
