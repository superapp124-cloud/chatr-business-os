import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from '../../../storage/InMemoryEventStore';
import { EventStoreCorruptionError } from '../../../storage/EventStore';

describe('Reliability: EventStore Integrity', () => {
  let eventStore: InMemoryEventStore;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
  });

  it('detects missing events in a stream', async () => {
    const streamId = 'Candidate-1';
    
    // Simulate valid writes
    await eventStore.append(streamId, 0, { eventType: 'Created', payload: {}, timestamp: new Date() });
    await eventStore.append(streamId, 1, { eventType: 'Updated', payload: {}, timestamp: new Date() });

    // Manually corrupt the store by deleting the first event
    (eventStore as any).events.splice(0, 1);

    // Reading should now throw CorruptionError
    await expect(eventStore.loadStream(streamId)).rejects.toThrowError(EventStoreCorruptionError);
  });

  it('detects duplicate expected versions', async () => {
    const streamId = 'Candidate-2';
    
    await eventStore.append(streamId, 0, { eventType: 'Created', payload: {}, timestamp: new Date() });

    // Force corrupt by injecting an event with a duplicate expected version
    const corruptedEvent = {
      streamId,
      eventType: 'Corrupted',
      payload: {},
      timestamp: new Date(),
      expectedVersion: 1, // Duplicate
      globalSequence: 999
    };
    (eventStore as any).events.push(corruptedEvent);

    await expect(eventStore.loadStream(streamId)).rejects.toThrowError(EventStoreCorruptionError);
  });

  it('detects out-of-order global sequence on loadSince', async () => {
    const streamId = 'Candidate-3';
    await eventStore.append(streamId, 0, { eventType: 'Created', payload: {}, timestamp: new Date() });
    await eventStore.append(streamId, 1, { eventType: 'Updated', payload: {}, timestamp: new Date() });

    // Delete the first event to break global sequence
    (eventStore as any).events.splice(0, 1);

    await expect(eventStore.loadSince(0)).rejects.toThrowError(EventStoreCorruptionError);
  });
});
