import { describe, bench, beforeAll, afterAll } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDBEventStore } from '../../kernel/storage/IndexedDBEventStore';
import { KernelEvent } from '../../kernel/storage/EventStore';

const SCALES = [100, 1000, 10000];
const MEMORY_LOGS: any[] = [];

function generateEvents(count: number, streamId: string): KernelEvent[] {
  const events: KernelEvent[] = [];
  for (let i = 1; i <= count; i++) {
    events.push({
      eventId: `evt-${streamId}-${i}`,
      streamId,
      aggregateType: 'Candidate',
      aggregateId: streamId,
      expectedVersion: i,
      eventType: i === 1 ? 'CandidateCreated' : 'CandidateUpdated',
      timestamp: new Date(),
      actorId: 'test-runner',
      tenantId: 'perf-tenant',
      payload: { value: i },
      metadata: {},
      globalSequence: i,
      commandId: `cmd-${streamId}-${i}`
    });
  }
  return events;
}

describe('Replay Throughput Benchmarks (Multi-Scale)', () => {
  let eventStore: IndexedDBEventStore;
  let baseMemory: NodeJS.MemoryUsage;

  beforeAll(async () => {
    eventStore = new IndexedDBEventStore('perf-multi');
    await eventStore.clear();

    baseMemory = process.memoryUsage();

    for (const scale of SCALES) {
      const streamId = `urn:chatr:object:candidate:scale-${scale}`;
      const events = generateEvents(scale, streamId);
      await eventStore.appendFromServer(events);
    }
  });

  afterAll(() => {
    console.log('\n--- Memory Usage Report ---');
    console.table(MEMORY_LOGS);
    console.log('---------------------------\n');
  });

  for (const scale of SCALES) {
    bench(`Load ${scale} events from IndexedDB`, async () => {
      const memBefore = process.memoryUsage();
      const streamId = `urn:chatr:object:candidate:scale-${scale}`;
      const stream = await eventStore.loadStream(streamId);
      
      const memAfter = process.memoryUsage();
      
      if (stream.length !== scale) {
        throw new Error(`Expected ${scale} events, got ${stream.length}`);
      }
      
      // Track peak memory loosely during iterations (vitest runs this many times, so we record the diffs)
      MEMORY_LOGS.push({
        Scale: scale,
        HeapDeltaMB: ((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2),
        ExtDeltaMB: ((memAfter.external - memBefore.external) / 1024 / 1024).toFixed(2),
      });

    }, { iterations: 10 });
  }
});
