import { IEventStore, StoredEvent } from '../../types.js';

export class MemoryEventStore implements IEventStore {
  private streams: Map<string, StoredEvent[]> = new Map();

  async append(streamId: string, event: StoredEvent): Promise<void> {
    const stream = this.streams.get(streamId) || [];
    
    // Validate sequence to prevent race conditions
    if (stream.length > 0) {
      const lastSequence = stream[stream.length - 1].sequence;
      if (event.sequence <= lastSequence) {
        throw new Error(`[EventStore] Sequence conflict for stream ${streamId}: Expected > ${lastSequence}, got ${event.sequence}`);
      }
    }
    
    stream.push(event);
    this.streams.set(streamId, stream);
    console.log(`[MemoryEventStore] Appended event ${event.eventType} (seq ${event.sequence}) to stream ${streamId}`);
  }

  async readStream(streamId: string): Promise<StoredEvent[]> {
    return this.streams.get(streamId) || [];
  }

  async readCategory(category: string): Promise<StoredEvent[]> {
    const events: StoredEvent[] = [];
    for (const [streamId, stream] of this.streams.entries()) {
      for (const event of stream) {
        if (event.eventType.startsWith(category + '.')) {
          events.push(event);
        }
      }
    }
    // Sort by timestamp
    events.sort((a, b) => new Date(a.metadata.timestamp).getTime() - new Date(b.metadata.timestamp).getTime());
    return events;
  }
}
