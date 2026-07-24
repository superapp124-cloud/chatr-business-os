import { describe, bench, beforeAll, afterAll } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDBEventStore } from '../../kernel/storage/IndexedDBEventStore';
import { SyncEngine } from '../../presentation-runtime/sync/SyncEngine';
import { CommandQueue } from '../../presentation-runtime/sync/CommandQueue';
import { SyncTransport, CommandEnvelope } from '../../presentation-runtime/sync/SyncTransport';
import { PresentationEventBus } from '../../presentation-runtime/events/PresentationEventBus';
import { KernelEvent } from '../../kernel/storage/EventStore';
import { InMemoryTelemetrySink } from '../../presentation-runtime/telemetry/TelemetrySink';

const QUEUE_SIZE = 500;
const NETWORK_LATENCY_MS = 10;

class DegradedTransport implements SyncTransport {
  events: KernelEvent[] = [];
  globalSeq = 0;
  calls = 0;
  degradeFactor: number; // 0.0 to 1.0 failure rate

  constructor(degradeFactor = 0.0) {
    this.degradeFactor = degradeFactor;
  }

  async sendCommand(envelope: CommandEnvelope): Promise<KernelEvent[]> {
    this.calls++;
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() < this.degradeFactor) {
          reject(new Error('Network intermittent failure'));
          return;
        }

        this.globalSeq++;
        const mockEvent = {
          eventId: 'evt-' + this.globalSeq,
          streamId: `urn:chatr:object:${envelope.payload.aggregateType.toLowerCase()}:${envelope.payload.aggregateId}`,
          aggregateType: envelope.payload.aggregateType,
          aggregateId: envelope.payload.aggregateId,
          expectedVersion: this.globalSeq,
          eventType: 'EventCreated',
          timestamp: new Date(),
          actorId: 'test',
          tenantId: 'test',
          payload: envelope.payload.payload,
          metadata: {},
          globalSequence: this.globalSeq,
          commandId: envelope.commandId
        };
        this.events.push(mockEvent);
        resolve([mockEvent]);
      }, NETWORK_LATENCY_MS);
    });
  }
  
  async pullEventsSince(payload: any): Promise<KernelEvent[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.events.filter(e => (e.globalSequence || 0) > payload.sequence));
      }, NETWORK_LATENCY_MS);
    });
  }
  
  async uploadTelemetry() {}
}

async function setupAndDrain(degradeFactor: number) {
  const commandQueue = new CommandQueue(`latencybench-${degradeFactor}`);
  await commandQueue.clear();
  const eventStore = new IndexedDBEventStore(`latencybench-${degradeFactor}`);
  await eventStore.clear();
  
  const remoteClient = new DegradedTransport(degradeFactor);
  const eventBus = new PresentationEventBus();
  const telemetry = new InMemoryTelemetrySink();
  
  const syncEngine = new SyncEngine(remoteClient, commandQueue, eventStore, eventBus, telemetry);

  for (let i = 0; i < QUEUE_SIZE; i++) {
    await commandQueue.enqueue({
      aggregateType: 'Candidate',
      aggregateId: `candidate-${i}`,
      action: 'Create',
      payload: { value: i },
      correlationId: `corr-${i}`
    }, 'test', 'test');
  }

  syncEngine.start(50);
  
  await new Promise<void>((resolve) => {
    const check = setInterval(async () => {
      const pending = await commandQueue.getPendingCommands();
      if (pending.length === 0) {
        clearInterval(check);
        syncEngine.stop();
        resolve();
      }
    }, 50);
  });
}

describe('Sync Latency & Queue Recovery Benchmarks', () => {
  bench(`Drain ${QUEUE_SIZE} commands (Happy Path - 0% Failure)`, async () => {
    await setupAndDrain(0.0);
  }, { iterations: 1 });

  bench(`Drain ${QUEUE_SIZE} commands (Degraded Path - 20% Failure)`, async () => {
    await setupAndDrain(0.2);
  }, { iterations: 1 });
});
