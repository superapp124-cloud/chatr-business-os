import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDBEventStore } from '../../kernel/storage/IndexedDBEventStore';
import { SyncEngine } from '../../presentation-runtime/sync/SyncEngine';
import { CommandQueue } from '../../presentation-runtime/sync/CommandQueue';
import { SyncTransport, CommandEnvelope } from '../../presentation-runtime/sync/SyncTransport';
import { PresentationEventBus } from '../../presentation-runtime/events/PresentationEventBus';
import { KernelEvent } from '../../kernel/storage/EventStore';
import { InMemoryTelemetrySink } from '../../presentation-runtime/telemetry/TelemetrySink';

class FlakyMockTransport implements SyncTransport {
  status: 'online' | 'offline' = 'online';
  executeCalls = 0;
  events: KernelEvent[] = [];

  async sendCommand(envelope: CommandEnvelope): Promise<KernelEvent[]> {
    this.executeCalls++;
    if (this.executeCalls === 1) {
      throw new Error('Network timeout');
    }
    return [{
      eventId: 'evt-retry',
      streamId: 'stream-1',
      aggregateType: 'Candidate',
      aggregateId: '123',
      expectedVersion: 1,
      eventType: 'CandidateHired',
      timestamp: new Date(),
      actorId: 'test',
      tenantId: 'test',
      payload: {},
      metadata: {},
      globalSequence: 1,
      commandId: envelope.commandId
    }];
  }
  async pullEventsSince(payload: any): Promise<KernelEvent[]> {
    return this.events;
  }
  async uploadTelemetry() {}
}

describe('Duplicate Retry & Idempotency', () => {
  let eventStore: IndexedDBEventStore;
  let commandQueue: CommandQueue;
  let remoteClient: FlakyMockTransport;
  let eventBus: PresentationEventBus;
  let telemetry: InMemoryTelemetrySink;
  let syncEngine: SyncEngine;

  beforeEach(async () => {
    eventStore = new IndexedDBEventStore();
    await eventStore.clear();
    commandQueue = new CommandQueue();
    await commandQueue.clear();
    
    remoteClient = new FlakyMockTransport();
    eventBus = new PresentationEventBus();
    telemetry = new InMemoryTelemetrySink();
    syncEngine = new SyncEngine(remoteClient, commandQueue, eventStore, eventBus, telemetry);
  });

  afterEach(() => {
    syncEngine.stop();
  });

  it('Retries failed commands until success', async () => {
    // Enqueue command
    await commandQueue.enqueue({
      aggregateType: 'Candidate',
      aggregateId: '123',
      action: 'Hire',
      payload: {},
      correlationId: 'corr-retry-1'
    }, 'test', 'test');

    syncEngine.start(50); // fast polling

    // Wait enough time for 2 sync cycles
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(remoteClient.executeCalls).toBeGreaterThanOrEqual(2);

    // Should not be in queue anymore
    const pending = await commandQueue.getPendingCommands();
    expect(pending.length).toBe(0);

    // Event should be applied to event store from the server response
    const events = await eventStore.loadStream('stream-1');
    expect(events.length).toBe(1);
    expect(events[0].eventId).toBe('evt-retry');
  });
});
