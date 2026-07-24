import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDBEventStore } from '../../kernel/storage/IndexedDBEventStore';
import { SyncEngine } from '../../presentation-runtime/sync/SyncEngine';
import { CommandQueue } from '../../presentation-runtime/sync/CommandQueue';
import { SyncTransport, CommandEnvelope } from '../../presentation-runtime/sync/SyncTransport';
import { PresentationEventBus } from '../../presentation-runtime/events/PresentationEventBus';
import { KernelEvent } from '../../kernel/storage/EventStore';
import { InMemoryTelemetrySink } from '../../presentation-runtime/telemetry/TelemetrySink';

class MockTransport implements SyncTransport {
  status: 'online' | 'offline' = 'online';
  events: KernelEvent[] = [];
  commandsExecuted: CommandEnvelope[] = [];
  streamVersions: Record<string, number> = {};

  async sendCommand(envelope: CommandEnvelope): Promise<KernelEvent[]> {
    if (this.status === 'offline') throw new Error('Network error');
    this.commandsExecuted.push(envelope);
    
    const streamId = `urn:chatr:object:${envelope.payload.aggregateType.toLowerCase()}:${envelope.payload.aggregateId}`;
    this.streamVersions[streamId] = (this.streamVersions[streamId] || 0) + 1;
    
    const mockEvent = {
      eventId: 'evt-' + envelope.commandId,
      streamId,
      aggregateType: envelope.payload.aggregateType,
      aggregateId: envelope.payload.aggregateId,
      expectedVersion: this.streamVersions[streamId],
      eventType: 'EventCreated',
      timestamp: new Date(),
      actorId: 'test',
      tenantId: 'test',
      payload: envelope.payload.payload,
      metadata: {},
      globalSequence: this.commandsExecuted.length,
      commandId: envelope.commandId
    };
    this.events.push(mockEvent);
    return [mockEvent];
  }
  async pullEventsSince(payload: any): Promise<KernelEvent[]> {
    if (this.status === 'offline') throw new Error('Network error');
    return this.events.filter(e => (e.globalSequence || 0) > payload.sequence);
  }
  async uploadTelemetry() {}
}

describe('Browser Refresh & Queue restore', () => {
  let eventStore: IndexedDBEventStore;
  let remoteClient: MockTransport;
  let eventBus: PresentationEventBus;
  let telemetry: InMemoryTelemetrySink;

  beforeEach(async () => {
    const queue = new CommandQueue();
    await queue.clear();
  });

  it('Restores pending queue on refresh, preserves ordering, and converges state', async () => {
    let commandQueue1 = new CommandQueue();
    // Enqueue two commands offline to verify ordering
    await commandQueue1.enqueue({
      aggregateType: 'Candidate',
      aggregateId: '123',
      action: 'Create',
      payload: { name: 'John' },
      correlationId: 'corr-refresh-1'
    }, 'test', 'test');
    
    await commandQueue1.enqueue({
      aggregateType: 'Candidate',
      aggregateId: '123',
      action: 'Hire',
      payload: { role: 'Dev' },
      correlationId: 'corr-refresh-2'
    }, 'test', 'test');

    const pending1 = await commandQueue1.getPendingCommands();
    expect(pending1.length).toBe(2);

    // --- SIMULATE PAGE REFRESH ---
    commandQueue1 = null as any; 
    
    // Phase 2: Page reloads
    const commandQueue2 = new CommandQueue();
    eventStore = new IndexedDBEventStore();
    remoteClient = new MockTransport();
    eventBus = new PresentationEventBus();
    telemetry = new InMemoryTelemetrySink();
    const syncEngine = new SyncEngine(remoteClient, commandQueue2, eventStore, eventBus, telemetry);

    syncEngine.start(100);

    // Wait for queue to process
    await new Promise(resolve => setTimeout(resolve, 250));

    // Commands should be sent preserving order
    expect(remoteClient.commandsExecuted.length).toBe(2);
    expect(remoteClient.commandsExecuted[0].payload.action).toBe('Create');
    expect(remoteClient.commandsExecuted[1].payload.action).toBe('Hire');
    
    // Queue should be empty
    const pending2 = await commandQueue2.getPendingCommands();
    expect(pending2.length).toBe(0);

    // The projection/event store should contain the events
    const stream = await eventStore.loadStream('urn:chatr:object:candidate:123');
    expect(stream.length).toBe(2);
    expect(stream[0].payload.name).toBe('John');
    expect(stream[1].payload.role).toBe('Dev');

    // Verify duplicate commands are not replayed if we refresh again
    // (They were removed from queue)
    syncEngine.stop();
    
    const commandQueue3 = new CommandQueue();
    const pending3 = await commandQueue3.getPendingCommands();
    expect(pending3.length).toBe(0);
  });
});
