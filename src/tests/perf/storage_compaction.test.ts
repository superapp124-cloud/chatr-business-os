import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { CommandQueue } from '../../kernel/../presentation-runtime/sync/CommandQueue';
import { SyncEngine } from '../../presentation-runtime/sync/SyncEngine';
import { IndexedDBEventStore } from '../../kernel/storage/IndexedDBEventStore';
import { SyncTransport, CommandEnvelope } from '../../presentation-runtime/sync/SyncTransport';
import { PresentationEventBus } from '../../presentation-runtime/events/PresentationEventBus';
import { KernelEvent } from '../../kernel/storage/EventStore';
import { InMemoryTelemetrySink } from '../../presentation-runtime/telemetry/TelemetrySink';

class SuccessfulTransport implements SyncTransport {
  async sendCommand(envelope: CommandEnvelope): Promise<KernelEvent[]> {
    return [{
      eventId: 'evt-' + envelope.commandId,
      streamId: `urn:chatr:object:${envelope.payload.aggregateType.toLowerCase()}:${envelope.payload.aggregateId}`,
      aggregateType: envelope.payload.aggregateType,
      aggregateId: envelope.payload.aggregateId,
      expectedVersion: 1,
      eventType: 'EventCreated',
      timestamp: new Date(),
      actorId: 'test',
      tenantId: 'test',
      payload: envelope.payload.payload,
      metadata: {},
      globalSequence: 1,
      commandId: envelope.commandId
    }];
  }
  async pullEventsSince(payload: any): Promise<KernelEvent[]> { return []; }
  async uploadTelemetry() {}
}

describe('CommandQueue Storage Compaction', () => {
  let eventStore: IndexedDBEventStore;
  let remoteClient: SuccessfulTransport;
  let eventBus: PresentationEventBus;
  let telemetry: InMemoryTelemetrySink;
  let commandQueue: CommandQueue;
  let syncEngine: SyncEngine;

  beforeEach(async () => {
    commandQueue = new CommandQueue('compaction');
    await commandQueue.clear();
    eventStore = new IndexedDBEventStore('compaction');
    await eventStore.clear();
    
    remoteClient = new SuccessfulTransport();
    eventBus = new PresentationEventBus();
    telemetry = new InMemoryTelemetrySink();
    
    syncEngine = new SyncEngine(remoteClient, commandQueue, eventStore, eventBus, telemetry);
  });

  it('Purges completed and rolled-back commands from the queue database', async () => {
    // 1. Enqueue command
    const id = await commandQueue.enqueue({
      aggregateType: 'Candidate',
      aggregateId: '123',
      action: 'Create',
      payload: {},
      correlationId: 'corr-compact'
    }, 'test', 'test');

    // 2. Start SyncEngine which will process it successfully
    syncEngine.start(50);
    
    // 3. Wait for processing
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // 4. Verify it's removed from IndexedDB entirely
    const allPending = await commandQueue.getPendingCommands();
    expect(allPending.length).toBe(0);

    const allQueued = await commandQueue.getCommandsByStatus(['queued', 'sending', 'acknowledged', 'completed', 'rolled-back', 'confirmed', 'rejected']);
    expect(allQueued.length).toBe(0); // The DB should be completely empty of this command

    syncEngine.stop();
  });
});
