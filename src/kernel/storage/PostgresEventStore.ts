import { SupabaseClient } from '@supabase/supabase-js';
import { EventStore, KernelEvent, ConcurrencyError } from './EventStore';

export class PostgresEventStore implements EventStore {
  constructor(private supabase: SupabaseClient) {}

  async append(
    streamId: string, 
    expectedVersion: number, 
    eventData: Omit<KernelEvent, 'globalSequence' | 'expectedVersion' | 'streamId'>
  ): Promise<KernelEvent> {
    const events = await this.appendBatch(streamId, expectedVersion, [eventData]);
    return events[0];
  }

  async appendBatch(
    streamId: string, 
    expectedVersion: number, 
    events: Omit<KernelEvent, 'globalSequence' | 'expectedVersion' | 'streamId'>[]
  ): Promise<KernelEvent[]> {
    
    // We insert events incrementally incrementing the expectedVersion
    const records = events.map((event, index) => ({
      stream_id: streamId,
      aggregate_type: event.aggregateType,
      aggregate_id: event.aggregateId,
      expected_version: expectedVersion + index + 1,
      event_id: event.eventId,
      event_type: event.eventType,
      timestamp: event.timestamp.toISOString(),
      actor_id: event.actorId,
      tenant_id: event.tenantId,
      correlation_id: event.correlationId,
      causation_id: event.causationId,
      payload: event.payload,
      metadata: event.metadata
    }));

    // Because of the UNIQUE(stream_id, expected_version) constraint in the schema,
    // this will naturally throw a database constraint error if a concurrency conflict occurs.
    const { data, error } = await this.supabase
      .from('kernel_events')
      .insert(records)
      .select();

    if (error) {
      if (error.code === '23505') { // Postgres unique violation
        throw new ConcurrencyError(streamId, expectedVersion, -1);
      }
      throw new Error(`Failed to append events: ${error.message}`);
    }

    return data.map(this.mapToKernelEvent);
  }

  async loadStream(streamId: string): Promise<KernelEvent[]> {
    const { data, error } = await this.supabase
      .from('kernel_events')
      .select('*')
      .eq('stream_id', streamId)
      .order('expected_version', { ascending: true });

    if (error) throw new Error(`Failed to load stream: ${error.message}`);
    return data.map(this.mapToKernelEvent);
  }

  async loadAggregate(aggregateType: string, aggregateId: string): Promise<KernelEvent[]> {
    const { data, error } = await this.supabase
      .from('kernel_events')
      .select('*')
      .eq('aggregate_type', aggregateType)
      .eq('aggregate_id', aggregateId)
      .order('expected_version', { ascending: true });

    if (error) throw new Error(`Failed to load aggregate: ${error.message}`);
    return data.map(this.mapToKernelEvent);
  }

  async loadSince(position: number): Promise<KernelEvent[]> {
    const { data, error } = await this.supabase
      .from('kernel_events')
      .select('*')
      .gt('global_sequence', position)
      .order('global_sequence', { ascending: true });

    if (error) throw new Error(`Failed to load since position: ${error.message}`);
    return data.map(this.mapToKernelEvent);
  }

  subscribe(handler: (event: KernelEvent) => Promise<void>): void {
    this.supabase.channel('kernel_events_channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'kernel_events' },
        (payload) => {
          const kernelEvent = this.mapToKernelEvent(payload.new as any);
          handler(kernelEvent).catch(err => console.error('Subscription handler failed:', err));
        }
      )
      .subscribe();
  }

  async replay(handler: (event: KernelEvent) => Promise<void>, fromPosition: number = 0): Promise<void> {
    const batchSize = 1000;
    let currentPosition = fromPosition;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.supabase
        .from('kernel_events')
        .select('*')
        .gt('global_sequence', currentPosition)
        .order('global_sequence', { ascending: true })
        .limit(batchSize);

      if (error) throw new Error(`Replay failed: ${error.message}`);

      if (data.length === 0) {
        hasMore = false;
        break;
      }

      for (const row of data) {
        await handler(this.mapToKernelEvent(row));
        currentPosition = row.global_sequence;
      }
    }
  }

  private mapToKernelEvent(row: any): KernelEvent {
    return {
      globalSequence: row.global_sequence,
      eventId: row.event_id,
      streamId: row.stream_id,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      expectedVersion: row.expected_version,
      eventType: row.event_type,
      timestamp: new Date(row.timestamp),
      actorId: row.actor_id,
      tenantId: row.tenant_id,
      correlationId: row.correlation_id,
      causationId: row.causation_id,
      payload: row.payload,
      metadata: row.metadata
    };
  }
}
