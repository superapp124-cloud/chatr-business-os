import { supabase } from '@/integrations/supabase/client';
import { EventLogABI, OSEvent, EventMetadata } from '../contracts/os/EventLog.abi';

export class SupabaseEventStore implements EventLogABI {
  async append(eventData: Omit<OSEvent, 'id' | 'metadata'> & { metadata: Partial<EventMetadata> }): Promise<string> {
    const row = {
      event_type: eventData.type,
      level: eventData.level,
      source_subsystem: eventData.metadata.sourceSubsystem || 'unknown',
      timestamp: eventData.metadata.timestamp || new Date().toISOString(),
      confidence: eventData.metadata.confidence,
      verification_status: eventData.metadata.verificationStatus,
      provenance: eventData.metadata.provenance,
      schema_version: eventData.metadata.schemaVersion || '1.0',
      producer_version: eventData.metadata.producerVersion || '1.0',
      platform_version: eventData.metadata.platformVersion || '1.0',
      payload: eventData.payload
    };

    const startTime = performance.now();
    const { data, error } = await supabase
      .from('os_events')
      .insert(row)
      .select('id')
      .single();
    const latency = performance.now() - startTime;
    
    // In a real OS, these metrics route to the Observer Subsystem
    console.debug(`[EventStore] Appended event ${eventData.type} in ${latency.toFixed(2)}ms`);

    if (error) {
      throw new Error(`Failed to append OS Event: ${error.message}`);
    }

    return data.id;
  }

  async query(filter: { type?: string; sourceSubsystem?: string; since?: string }): Promise<OSEvent[]> {
    let q = supabase.from('os_events').select('*').order('timestamp', { ascending: true });

    if (filter.type) q = q.eq('event_type', filter.type);
    if (filter.sourceSubsystem) q = q.eq('source_subsystem', filter.sourceSubsystem);
    if (filter.since) q = q.gte('timestamp', filter.since);

    const { data, error } = await q;

    if (error) {
      throw new Error(`Failed to query OS Events: ${error.message}`);
    }

    return data.map(row => ({
      id: row.id,
      type: row.event_type,
      level: row.level as OSEvent['level'],
      metadata: {
        sourceSubsystem: row.source_subsystem,
        timestamp: row.timestamp,
        confidence: row.confidence,
        verificationStatus: row.verification_status as any,
        provenance: row.provenance,
        schemaVersion: row.schema_version,
        producerVersion: row.producer_version,
        platformVersion: row.platform_version
      },
      payload: row.payload
    }));
  }

  async replay(sinceId: string, targetSubsystem: string): Promise<void> {
    // 1. Fetch the timestamp of the sinceId
    let sinceTimestamp = '1970-01-01T00:00:00Z';
    if (sinceId !== 'genesis') {
      const { data, error } = await supabase
        .from('os_events')
        .select('timestamp')
        .eq('id', sinceId)
        .single();
        
      if (error) throw new Error(`Replay failed. Event ${sinceId} not found.`);
      sinceTimestamp = data.timestamp;
    }

    // 2. Stream events to the target subsystem projection
    // In a real implementation, this would trigger the Projector to rebuild its read models.
    // We will establish the RealityProjector interface in Milestone 2.
    console.log(`[EventStore] Replaying events since ${sinceTimestamp} for ${targetSubsystem}`);
  }
}
