import { EventStore, KernelEvent, ConcurrencyError, EventStoreCorruptionError } from './EventStore';

export class InMemoryEventStore implements EventStore {
  private events: KernelEvent[] = [];
  private subscriptions: ((event: KernelEvent) => Promise<void>)[] = [];
  private globalSequenceCounter = 0;

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
    // Check concurrency
    const streamEvents = this.events.filter(e => e.streamId === streamId);
    const currentVersion = streamEvents.length > 0 
      ? Math.max(...streamEvents.map(e => e.expectedVersion))
      : 0;

    if (expectedVersion !== currentVersion) {
      throw new ConcurrencyError(streamId, expectedVersion, currentVersion);
    }

    const insertedEvents: KernelEvent[] = [];
    let version = expectedVersion;

    for (const event of events) {
      version++;
      this.globalSequenceCounter++;
      const newEvent: KernelEvent = {
        ...event,
        streamId,
        expectedVersion: version,
        globalSequence: this.globalSequenceCounter
      };
      this.events.push(newEvent);
      insertedEvents.push(newEvent);

      // Notify subscribers asynchronously
      setTimeout(() => {
        for (const handler of this.subscriptions) {
          handler(newEvent).catch(err => console.error('Subscription handler failed:', err));
        }
      }, 0);
    }

    return insertedEvents;
  }

  async loadStream(streamId: string): Promise<KernelEvent[]> {
    const stream = this.events
      .filter(e => e.streamId === streamId)
      .sort((a, b) => a.expectedVersion - b.expectedVersion);
      
    // Integrity check
    let expected = 1;
    for (const e of stream) {
      if (e.expectedVersion !== expected) {
        throw new EventStoreCorruptionError(`Missing or duplicate sequence. Expected ${expected}, got ${e.expectedVersion}`, streamId);
      }
      expected++;
    }
    return stream;
  }

  async loadAggregate(aggregateType: string, aggregateId: string): Promise<KernelEvent[]> {
    return this.events
      .filter(e => e.aggregateType === aggregateType && e.aggregateId === aggregateId)
      .sort((a, b) => a.expectedVersion - b.expectedVersion);
  }

  async loadSince(position: number): Promise<KernelEvent[]> {
    const stream = this.events
      .filter(e => e.globalSequence > position)
      .sort((a, b) => a.globalSequence - b.globalSequence);
      
    // Integrity check for global stream
    let expected = position + 1;
    for (const e of stream) {
      if (e.globalSequence !== expected) {
        throw new EventStoreCorruptionError(`Missing or duplicate global sequence. Expected ${expected}, got ${e.globalSequence}`);
      }
      expected++;
    }
    return stream;
  }

  subscribe(handler: (event: KernelEvent) => Promise<void>): void {
    this.subscriptions.push(handler);
  }
}
