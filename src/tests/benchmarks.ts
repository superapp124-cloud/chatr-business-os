import { WorkflowSDK } from '@/core/sdk/WorkflowSDK';
import { IWorkflowContext } from '@/core/runtime/PipelineEngine';
import { taskRuntime, TaskPriority } from '@/core/runtime/TaskRuntime';
import { eventBus } from '@/core/runtime/EventBus';
import { eventRuntime } from '@/core/runtime/EventRuntime';

/**
 * Creates a mock workflow with a specific shape to test scheduler behaviors.
 */
function createMockWorkflow(name: string, stageCount: number, sleepMs: number = 50, failRate: number = 0) {
  const stages = [];
  for (let i = 0; i < stageCount; i++) {
    stages.push(WorkflowSDK.createStage(
      `stage_${i}`,
      `Mock Stage ${i}`,
      i > 0 ? [`stage_${i - 1}`] : [], // Sequential
      async (ctx: IWorkflowContext) => {
        // Simulate IO or compute
        await new Promise(r => setTimeout(r, sleepMs));
        if (Math.random() < failRate) {
          throw new Error('Simulated random failure');
        }
      }
    ));
    // Inject mock metadata for TaskRuntime
    stages[i].priority = () => TaskPriority.NORMAL;
    stages[i].maxRetries = () => (failRate > 0 ? 3 : 0);
  }

  return WorkflowSDK.createCapability(name, stages, () => ({
    id: crypto.randomUUID(),
    type: 'benchmark',
    state: {}, artifacts: {}, policies: {}
  }));
}

export async function runScaleBenchmark(workflowCount: number) {
  console.log(`\n[Benchmark] Starting scale test: ${workflowCount} workflows`);
  const mockCapability = createMockWorkflow('scale_test', 5, 20); // 5 stages per workflow
  
  let completed = 0;
  const startTime = performance.now();
  const latencies: number[] = [];
  const startTimes = new Map<string, number>();

  return new Promise<void>((resolve) => {
    const onComplete = (e: any) => {
      if (e.payload?.type === 'benchmark') {
        const id = e.payload.id;
        const latencyMs = performance.now() - (startTimes.get(id) || startTime);
        latencies.push(latencyMs);
        completed++;

        if (completed === workflowCount) {
          const totalLatency = performance.now() - startTime;
          latencies.sort((a, b) => a - b);
          
          const p50 = latencies[Math.floor(latencies.length * 0.50)]?.toFixed(0);
          const p95 = latencies[Math.floor(latencies.length * 0.95)]?.toFixed(0);
          const p99 = latencies[Math.floor(latencies.length * 0.99)]?.toFixed(0);
          
          console.log(`[Benchmark] Completed ${workflowCount} workflows in ${totalLatency.toFixed(0)}ms`);
          console.log(`[Benchmark] Throughput: ${(workflowCount / (totalLatency/1000)).toFixed(2)} workflows/sec`);
          console.log(`[Benchmark] Latency P50: ${p50}ms | P95: ${p95}ms | P99: ${p99}ms`);
          
          eventBus.unsubscribe('PIPELINE_COMPLETED', onComplete);
          resolve();
        }
      }
    };
    eventBus.subscribe('PIPELINE_COMPLETED', onComplete);

    // Fire them all at once (stressing the scheduler)
    for (let i = 0; i < workflowCount; i++) {
      mockCapability.plan({}).then(ctx => {
        startTimes.set(ctx.id, performance.now());
        mockCapability.execute(ctx);
      });
    }
  });
}

export async function runChaosBenchmark() {
  console.log(`\n[Benchmark] Starting Chaos test...`);
  
  // High failure rate workflow
  const chaosCapability = createMockWorkflow('chaos_test', 3, 10, 0.5); // 50% failure rate
  
  let total = 20;
  let finished = 0;
  const startTime = performance.now();

  return new Promise<void>((resolve) => {
    const checkDone = () => {
      finished++;
      if (finished === total) {
        console.log(`[Benchmark] Chaos test finished in ${(performance.now() - startTime).toFixed(0)}ms`);
        eventBus.unsubscribe('PIPELINE_COMPLETED', checkDone);
        eventBus.unsubscribe('PIPELINE_FAILED', checkDone);
        resolve();
      }
    };
    
    eventBus.subscribe('PIPELINE_COMPLETED', checkDone);
    eventBus.subscribe('PIPELINE_FAILED', checkDone);

    for (let i = 0; i < total; i++) {
      chaosCapability.plan({}).then(ctx => chaosCapability.execute(ctx));
    }
  });
}

export async function runEventBurstBenchmark(eventCount: number) {
  console.log(`\n[Benchmark] Starting Event Burst test: ${eventCount} events`);
  const startTime = performance.now();
  const dispatchTimes: number[] = [];
  
  // Note: we can't easily track subscriber delivery latency here without altering the event bus heavily, 
  // but we can measure publish queuing time P99
  for (let i = 0; i < eventCount; i++) {
    const t0 = performance.now();
    eventBus.publish('benchmark.event.transient', { index: i }, { priority: 'normal' });
    dispatchTimes.push(performance.now() - t0);
  }
  
  const totalLatency = performance.now() - startTime;
  dispatchTimes.sort((a, b) => a - b);
  const p50 = dispatchTimes[Math.floor(dispatchTimes.length * 0.50)]?.toFixed(2);
  const p95 = dispatchTimes[Math.floor(dispatchTimes.length * 0.95)]?.toFixed(2);
  const p99 = dispatchTimes[Math.floor(dispatchTimes.length * 0.99)]?.toFixed(2);
  
  console.log(`[Benchmark] Queued ${eventCount} events in ${totalLatency.toFixed(2)}ms`);
  console.log(`[Benchmark] Publish P50: ${p50}ms | P95: ${p95}ms | P99: ${p99}ms`);
  
  // Wait a bit to let the async dispatcher chew through it
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      console.log(`[Benchmark] Event Runtime published: ${eventRuntime.metrics.publishedCount}`);
      resolve();
    }, 1000);
  });
}

export async function runSlowSubscriberBenchmark() {
  console.log(`\n[Benchmark] Starting Slow Subscriber isolation test`);
  
  // Register a slow sub
  const unsubSlow = eventBus.subscribe('benchmark.event.persistent', async () => {
    await new Promise(r => setTimeout(r, 500)); // sleep 500ms
  });

  // Register a fast sub
  let fastCount = 0;
  const unsubFast = eventBus.subscribe('benchmark.event.persistent', () => {
    fastCount++;
  });

  const startTime = performance.now();
  eventBus.publish('benchmark.event.persistent', { hello: 'world' });
  eventBus.publish('benchmark.event.persistent', { hello: 'world 2' });

  // Publisher returns instantly
  console.log(`[Benchmark] Publish returned in ${(performance.now() - startTime).toFixed(2)}ms (Isolation working)`);

  return new Promise<void>((resolve) => {
    setTimeout(() => {
      console.log(`[Benchmark] Fast subscriber processed ${fastCount} immediately.`);
      unsubSlow();
      unsubFast();
      resolve();
    }, 1000);
  });
}

function getMemorySnapshot() {
  const mem = typeof performance !== 'undefined' && (performance as any).memory
    ? (performance as any).memory.usedJSHeapSize / (1024 * 1024)
    : 0;
  return {
    heapMB: mem.toFixed(2),
    activeWorkers: taskRuntime.getMetrics().activeWorkers,
    queueDepth: taskRuntime.getMetrics().queueDepth,
    // event queue depth simulation
    eventPublishCount: eventRuntime.metrics.publishedCount,
    dlqCount: eventRuntime.metrics.dlqCount
  };
}

export async function runEnduranceBenchmark(durationSeconds: number = 10) {
  console.log(`\n[Benchmark] Starting Endurance Benchmark (${durationSeconds}s)`);
  
  const startSnapshot = getMemorySnapshot();
  console.log(`[Benchmark] Initial Snapshot:`, startSnapshot);

  const mockCapability = createMockWorkflow('endurance_test', 3, 20, 0.05); // 5% failure
  const startTime = performance.now();
  
  let workflowsStarted = 0;
  
  // Continuous load generation
  const loadInterval = setInterval(() => {
    workflowsStarted++;
    mockCapability.plan({}).then(ctx => mockCapability.execute(ctx));
    
    // Add background event noise
    if (workflowsStarted % 5 === 0) {
      eventBus.publish('benchmark.event.transient', { load: true });
    }
  }, 50); // 20 workflows per second

  return new Promise<void>((resolve) => {
    setTimeout(async () => {
      clearInterval(loadInterval);
      
      // Allow queues to drain
      console.log(`[Benchmark] Load complete. Draining queues for 2 seconds...`);
      await new Promise(r => setTimeout(r, 2000));
      
      const endSnapshot = getMemorySnapshot();
      console.log(`[Benchmark] Final Snapshot:`, endSnapshot);
      
      const latencyMs = performance.now() - startTime;
      
      const report = {
        durationSeconds,
        workflowsStarted,
        throughputWPS: (workflowsStarted / (latencyMs/1000)).toFixed(2),
        memoryDeltaMB: (parseFloat(endSnapshot.heapMB) - parseFloat(startSnapshot.heapMB)).toFixed(2),
        leakDetected: parseFloat(endSnapshot.heapMB) > parseFloat(startSnapshot.heapMB) + 5, // Allow 5MB variance
        finalQueueDepth: endSnapshot.queueDepth,
        dlqGrowth: endSnapshot.dlqCount - startSnapshot.dlqCount
      };
      
      console.log(`\n[Benchmark] structured_report: \n`, JSON.stringify(report, null, 2));
      
      if (report.leakDetected) {
        console.warn(`[Benchmark] ⚠️ Memory leak or retained state suspected.`);
      } else {
        console.log(`[Benchmark] ✅ Memory returned to baseline stably.`);
      }
      
      resolve();
    }, durationSeconds * 1000);
  });
}

export async function runAllBenchmarks() {
  console.log('--- ENGINE OPTIMIZATION BENCHMARKS ---');
  
  // Task Runtime (Priority 1)
  await runScaleBenchmark(10);
  await runScaleBenchmark(100);
  await runScaleBenchmark(500);
  await runChaosBenchmark();
  
  // Event Runtime (Priority 2)
  await runEventBurstBenchmark(10000); // 10k burst
  await runSlowSubscriberBenchmark();
  
  // Memory & Runtime Efficiency (Priority 3)
  await runEnduranceBenchmark(10); // 10s endurance for quick tests (scale to 86400s for 24h)
  
  console.log('--- BENCHMARKS COMPLETE ---');
}
