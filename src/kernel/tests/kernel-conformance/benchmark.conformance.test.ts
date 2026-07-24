import { describe, it, expect, beforeAll } from 'vitest';
import { ObjectRuntime } from '../../runtime/ObjectRuntime';
import { InMemoryEventStore } from '../../storage/InMemoryEventStore';
import { ProjectionService } from '../../projections/ProjectionService';
import { QueryEngine } from '../../query/QueryEngine';
import { EvidenceBuilder } from '../../evidence/EvidenceBuilder';
import { CapabilityRegistry } from '../../registry/CapabilityRegistry';
import { PackLoader } from '../../registry/PackLoader';
import { EDLLivingObject } from '../../contracts/edl/types';
import { performance } from 'perf_hooks';

// Helper to calculate P50, P95, P99
function calculatePercentiles(times: number[]) {
  if (times.length === 0) return { p50: 0, p95: 0, p99: 0 };
  const sorted = [...times].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return { p50, p95, p99, min: sorted[0], max: sorted[sorted.length - 1], avg: times.reduce((a, b) => a + b, 0) / times.length };
}

describe('Kernel Performance Benchmarks (SLO Verification)', () => {
  let eventStore: InMemoryEventStore;
  let objectRuntime: ObjectRuntime;
  let projectionService: ProjectionService;
  let queryEngine: QueryEngine;
  let evidenceBuilder: EvidenceBuilder;

  // Simple EDL object for benchmarking
  const benchmarkEDL: EDLLivingObject = {
    urn: 'urn:chatr:object:benchmark_item',
    type: 'BenchmarkItem',
    name: 'Benchmark Item',
    primitiveType: 'LivingObject',
    metadata: {},
    properties: [
      { key: 'name', type: 'string', required: true },
      { key: 'value', type: 'number', required: true }
    ],
    relationships: [],
    lifecycle: {
      initialState: 'Created',
      states: [{ name: 'Created' }, { name: 'Updated' }],
      transitions: [
        { from: ['Created'], to: 'Updated', triggeredByEvent: 'BenchmarkItemUpdated' }
      ]
    },
    eventsProduced: ['BenchmarkItemCreated', 'BenchmarkItemUpdated']
  };

  const actorId = 'urn:chatr:actor:system:benchmark';
  const ITERATIONS = 100; // Realistic sample size for local E2E P95

  beforeAll(async () => {
    eventStore = new InMemoryEventStore();
    
    const registry = new CapabilityRegistry();
    const loader = new PackLoader(registry);
    await loader.loadFromJSON({ id: 'test-benchmark', version: '1.0', edlVersion: '1.0', name: 'Benchmark' }, [BenchmarkEDL as any]);

    objectRuntime = new ObjectRuntime(eventStore, registry);
    
    projectionService = new ProjectionService(eventStore);
    projectionService.start();

    queryEngine = new QueryEngine(projectionService);
    evidenceBuilder = new EvidenceBuilder(queryEngine);
  });

  it('Gate A: Event Append Latency (SLO: ≤ 50ms)', async () => {
    const times: number[] = [];
    
    for (let i = 0; i < ITERATIONS; i++) {
      const aggregateId = `bench_app_${Date.now()}_${i}`;
      
      const start = performance.now();
      await objectRuntime.executeCommand(
        benchmarkEDL,
        {
          aggregateType: 'BenchmarkItem',
          aggregateId,
          action: 'Create',
          payload: { name: `Item ${i}`, value: i }
        },
        actorId,
        'tenant_bench'
      );
      const end = performance.now();
      times.push(end - start);
    }

    const { p95 } = calculatePercentiles(times);
    console.log(`Event Append Latency - P95: ${p95.toFixed(2)}ms`);
    
    expect(p95).toBeLessThanOrEqual(50);
  }, 30000); // Allow 30s for the benchmark iteration

  it('Gate A: Query Engine Response (SLO: ≤ 50ms)', async () => {
    // Generate some data first
    const aggregateId = `bench_q_${Date.now()}`;
    await objectRuntime.executeCommand(
      benchmarkEDL,
      {
        aggregateType: 'BenchmarkItem',
        aggregateId,
        action: 'Create',
        payload: { name: 'Query Target', value: 42 }
      },
      actorId,
      'tenant_bench'
    );
    
    // Wait for projection to catch up
    await new Promise(resolve => setTimeout(resolve, 500));

    const times: number[] = [];
    
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      await queryEngine.get({
        actorId,
        aggregateType: 'BenchmarkItem',
        aggregateId
      });
      const end = performance.now();
      times.push(end - start);
    }

    const { p95 } = calculatePercentiles(times);
    console.log(`Query Engine Response - P95: ${p95.toFixed(2)}ms`);
    
    expect(p95).toBeLessThanOrEqual(50);
  }, 30000);

  it('Gate A: Single Aggregate Replay (SLO: ≤ 200ms)', async () => {
    const aggregateId = `bench_rep_${Date.now()}`;
    
    // Create an aggregate with 50 events (realistic history)
    await objectRuntime.executeCommand(
      benchmarkEDL,
      {
        aggregateType: 'BenchmarkItem',
        aggregateId,
        action: 'Create',
        payload: { name: 'Replay Target', value: 0 }
      },
      actorId,
      'tenant_bench'
    );

    for (let i = 1; i <= 50; i++) {
      await objectRuntime.executeCommand(
        benchmarkEDL,
        {
          aggregateType: 'BenchmarkItem',
          aggregateId,
          action: 'Update',
          payload: { value: i }
        },
        actorId,
        'tenant_bench'
      );
    }

    const times: number[] = [];

    // Benchmark the replay
    for (let i = 0; i < 20; i++) { // Replays are heavier, do fewer iterations
      const start = performance.now();
      await eventStore.loadAggregate('BenchmarkItem', aggregateId);
      const end = performance.now();
      times.push(end - start);
    }

    const { p95 } = calculatePercentiles(times);
    console.log(`Single Aggregate Replay (50 events) - P95: ${p95.toFixed(2)}ms`);
    
    expect(p95).toBeLessThanOrEqual(200);
  }, 30000);

});
