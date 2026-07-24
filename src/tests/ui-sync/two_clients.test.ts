import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDBEventStore } from '../../kernel/storage/IndexedDBEventStore';
import { SyncEngine } from '../../presentation-runtime/sync/SyncEngine';
import { CommandQueue } from '../../presentation-runtime/sync/CommandQueue';
import { SyncTransport, CommandEnvelope } from '../../presentation-runtime/sync/SyncTransport';
import { PresentationEventBus } from '../../presentation-runtime/events/PresentationEventBus';
import { KernelEvent } from '../../kernel/storage/EventStore';
import { InMemoryTelemetrySink } from '../../presentation-runtime/telemetry/TelemetrySink';

class SharedTransport implements SyncTransport {
  events: KernelEvent[] = [];
  globalSeq = 0;

  async sendCommand(envelope: CommandEnvelope): Promise<KernelEvent[]> {
    this.globalSeq++;
    const newEvent: KernelEvent = {
      eventId: 'evt-' + this.globalSeq,
      streamId: `urn:chatr:object:${envelope.payload.aggregateType.toLowerCase()}:${envelope.payload.aggregateId}`,
      aggregateType: envelope.payload.aggregateType,
      aggregateId: envelope.payload.aggregateId,
      expectedVersion: 1,
      eventType: `${envelope.payload.aggregateType}Updated`,
      timestamp: new Date(),
      actorId: 'test',
      tenantId: 'test',
      payload: envelope.payload.payload,
      metadata: {},
      globalSequence: this.globalSeq,
      commandId: envelope.commandId
    };
    this.events.push(newEvent);
    return [newEvent];
  }
  
  async pullEventsSince(payload: any): Promise<KernelEvent[]> {
    return this.events.filter(e => (e.globalSequence || 0) > payload.sequence);
  }
  
  async uploadTelemetry() {}
}

describe('Two Clients Sync', () => {
  it('Browser A updates server, Browser B receives update via SyncEngine pull', async () => {
    const server = new SharedTransport();
    const telemetry = new InMemoryTelemetrySink();
    
    // Client A
    const eventStoreA = new IndexedDBEventStore('clientA');
    await eventStoreA.clear();
    const queueA = new CommandQueue('clientA');
    await queueA.clear();
    const engineA = new SyncEngine(server, queueA, eventStoreA, new PresentationEventBus(), telemetry);

    // Client B
    const eventStoreB = new IndexedDBEventStore('clientB');
    await eventStoreB.clear();
    const queueB = new CommandQueue('clientB');
    await queueB.clear();
    const engineB = new SyncEngine(server, queueB, eventStoreB, new PresentationEventBus(), telemetry);

    // Client A executes command offline then online
    await queueA.enqueue({
      aggregateType: 'Candidate',
      aggregateId: '123',
      action: 'Hire',
      payload: { name: 'John' },
      correlationId: 'corr-multi-1'
    }, 'test', 'test');

    engineA.start(50);
    // Wait for Client A to push
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Verify server has it
    expect(server.events.length).toBe(1);

    // Client B starts and syncs
    engineB.start(50);
    // Wait for Client B to pull
    await new Promise(resolve => setTimeout(resolve, 150));

    // Verify Client B received the event
    const streamB = await eventStoreB.loadStream('urn:chatr:object:candidate:123');
    expect(streamB.length).toBe(1);
    expect(streamB[0].payload.name).toBe('John');

    engineA.stop();
    engineB.stop();
  });
});
