import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDBEventStore } from '../../kernel/storage/IndexedDBEventStore';
import { SyncEngine } from '../../presentation-runtime/sync/SyncEngine';
import { CommandQueue } from '../../presentation-runtime/sync/CommandQueue';
import { SyncTransport, CommandEnvelope } from '../../presentation-runtime/sync/SyncTransport';
import { PresentationEventBus } from '../../presentation-runtime/events/PresentationEventBus';
import { KernelEvent } from '../../kernel/storage/EventStore';
import { InMemoryTelemetrySink } from '../../presentation-runtime/telemetry/TelemetrySink';

class TimeSkewedTransport implements SyncTransport {
  events: KernelEvent[] = [];
  commandsExecuted: CommandEnvelope[] = [];
  serverSequence = 0;

  async sendCommand(envelope: CommandEnvelope): Promise<KernelEvent[]> {
    this.commandsExecuted.push(envelope);
    this.serverSequence++;
    
    // Server clock is wildly skewed: 1 year in the past!
    const skewedDate = new Date();
    skewedDate.setFullYear(skewedDate.getFullYear() - 1);

    const mockEvent = {
      eventId: 'evt-' + envelope.commandId,
      streamId: `urn:chatr:object:${envelope.payload.aggregateType.toLowerCase()}:${envelope.payload.aggregateId}`,
      aggregateType: envelope.payload.aggregateType,
      aggregateId: envelope.payload.aggregateId,
      expectedVersion: this.serverSequence,
      eventType: 'EventCreated',
      timestamp: skewedDate, // SKEWED!
      actorId: 'test',
      tenantId: 'test',
      payload: envelope.payload.payload,
      metadata: {},
      globalSequence: this.serverSequence,
      commandId: envelope.commandId
    };
    
    this.events.push(mockEvent);
    return [mockEvent];
  }
  async pullEventsSince(payload: any): Promise<KernelEvent[]> {
    return this.events.filter(e => (e.globalSequence || 0) > payload.sequence);
  }
  async uploadTelemetry() {}
}

describe('Time Skew Synchronization', () => {
  let eventStore: IndexedDBEventStore;
  let remoteClient: TimeSkewedTransport;
  let eventBus: PresentationEventBus;
  let telemetry: InMemoryTelemetrySink;
  let commandQueue: CommandQueue;
  let syncEngine: SyncEngine;

  beforeEach(async () => {
    commandQueue = new CommandQueue('timeskew');
    await commandQueue.clear();
    eventStore = new IndexedDBEventStore('timeskew');
    await eventStore.clear();
    
    remoteClient = new TimeSkewedTransport();
    eventBus = new PresentationEventBus();
    telemetry = new InMemoryTelemetrySink();
    
    syncEngine = new SyncEngine(remoteClient, commandQueue, eventStore, eventBus, telemetry);
  });

  it('Relies on sequences and IDs, ignoring timestamp discrepancies', async () => {
    await commandQueue.enqueue({
      aggregateType: 'Candidate',
      aggregateId: '123',
      action: 'Create',
      payload: { name: 'Chronos' },
      correlationId: 'corr-time-1'
    }, 'test', 'test');

    syncEngine.start(50);

    // Wait for queue to process
    await new Promise(resolve => setTimeout(resolve, 150));

    // The projection/event store should contain the event despite the timestamp
    const stream = await eventStore.loadStream('urn:chatr:object:candidate:123');
    expect(stream.length).toBe(1);
    expect(stream[0].payload.name).toBe('Chronos');
    
    // Watermark should rely on sequence, NOT timestamp
    let session;
    syncEngine.onStateChange(s => session = s);
    expect(session?.watermark.clientSequence).toBe(1);
    expect(session?.watermark.serverSequence).toBe(1);

    syncEngine.stop();
  });
});
