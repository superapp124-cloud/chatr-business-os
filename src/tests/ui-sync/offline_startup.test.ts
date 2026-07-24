import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDBEventStore } from '../../kernel/storage/IndexedDBEventStore';
import { SyncEngine } from '../../presentation-runtime/sync/SyncEngine';
import { CommandQueue } from '../../presentation-runtime/sync/CommandQueue';
import { SyncTransport, CommandEnvelope } from '../../presentation-runtime/sync/SyncTransport';
import { PresentationEventBus } from '../../presentation-runtime/events/PresentationEventBus';
import { KernelEvent } from '../../kernel/storage/EventStore';
import { InMemoryTelemetrySink } from '../../presentation-runtime/telemetry/TelemetrySink';

class MockTransport implements SyncTransport {
  status: 'online' | 'offline' = 'offline';
  events: KernelEvent[] = [];

  async sendCommand(envelope: CommandEnvelope): Promise<KernelEvent[]> {
    if (this.status === 'offline') throw new Error('Network error');
    return [];
  }
  async pullEventsSince(payload: any): Promise<KernelEvent[]> {
    if (this.status === 'offline') throw new Error('Network error');
    return this.events;
  }
  async uploadTelemetry() {}
}

describe('Offline Startup & IndexedDB load', () => {
  let eventStore: IndexedDBEventStore;
  let commandQueue: CommandQueue;
  let remoteClient: MockTransport;
  let eventBus: PresentationEventBus;
  let telemetry: InMemoryTelemetrySink;
  let syncEngine: SyncEngine;

  beforeEach(async () => {
    // We recreate DB connections for each test.
    // fake-indexeddb keeps state across tests if not cleared, 
    // but clearing is easier done via IDB native methods or using a new db name.
    eventStore = new IndexedDBEventStore();
    await eventStore.clear();
    commandQueue = new CommandQueue();
    await commandQueue.clear();
    
    remoteClient = new MockTransport();
    eventBus = new PresentationEventBus();
    telemetry = new InMemoryTelemetrySink();
    syncEngine = new SyncEngine(remoteClient, commandQueue, eventStore, eventBus, telemetry);
  });

  afterEach(() => {
    syncEngine.stop();
  });

  it('Starts offline, loads data from IndexedDB, and queues new commands', async () => {
    // 1. Preload IndexedDB with some existing data (simulating past usage)
    await eventStore.append('urn:chatr:object:candidate:123', 0, {
      eventId: 'evt-1',
      aggregateType: 'Candidate',
      aggregateId: '123',
      eventType: 'CandidateCreated',
      timestamp: new Date(),
      actorId: 'test',
      tenantId: 'test',
      payload: { name: 'John Doe' },
      metadata: {}
    });

    // 2. Start SyncEngine in offline mode
    remoteClient.status = 'offline';
    syncEngine.start(100); // quick poll for tests

    // Let it try to sync and fail
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify it knows it's offline
    let currentSession;
    syncEngine.onStateChange(s => currentSession = s);
    expect(currentSession?.connectionState).toBe('offline');

    // Verify data is available (App is usable offline)
    const stream = await eventStore.loadStream('urn:chatr:object:candidate:123');
    expect(stream.length).toBe(1);
    expect(stream[0].payload.name).toBe('John Doe');

    // 3. User performs an action while offline
    const cmd = {
      aggregateType: 'Candidate',
      aggregateId: '123',
      action: 'UpdateName',
      payload: { name: 'Jane Doe' },
      correlationId: 'corr-1'
    };

    // UI emits CommandStarted
    eventBus.publish({
      type: 'CommandStarted',
      correlationId: 'corr-1',
      command: cmd,
      actorId: 'test',
      tenantId: 'test'
    });

    // Allow time for event bus and queue to process
    await new Promise(resolve => setTimeout(resolve, 50));

    // Command should be in the queue
    const pending = await commandQueue.getPendingCommands();
    expect(pending.length).toBe(1);
    expect(pending[0].command.action).toBe('UpdateName');
    
    expect(currentSession?.queuedCommands).toBe(1);
  });
});
