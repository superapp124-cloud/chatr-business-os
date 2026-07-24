'use strict';

/**
 * Platform Milestone D — Observer Loop Certification Suite
 * 
 * Asserts the Observer Loop guarantees:
 * - Throughput (>10,000/sec)
 * - No Event Loss (100k events)
 * - Arrival order preservation
 * - Duplicate preservation
 * - Memory bounds (Backpressure load shedding)
 * - Architectural Purity
 */

const { performance } = require('perf_hooks');
const { ObserverLoop } = require('../../../kernel/observer-loop.cjs');

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(message);
    console.error(`❌ [FAIL] ${message}`);
  }
}

async function runSuite() {
  console.log('=== Platform Milestone D: Observer Loop Certification ===\n');

  const emittedFrames = [];
  const mockBus = {
    publish: (eventName, frame) => {
      emittedFrames.push(frame);
    }
  };

  const observer = new ObserverLoop({ bus: mockBus });

  // Pluggable Adapter
  observer.registerAdapter('browser', (raw) => {
    return {
      goal_id: raw.gId,
      observation_type: 'dom',
      payload: { html: raw.content }
    };
  });

  // 1. Throughput & No Event Loss
  const TARGET_EVENTS = 100000;
  console.log(`Pumping ${TARGET_EVENTS} events...`);
  const t0 = performance.now();
  
  for (let i = 0; i < TARGET_EVENTS; i++) {
    // We mock the queue size check bypass for the pure throughput test,
    // or we just set MAX_QUEUE_SIZE large enough. Wait, Observer has MAX_QUEUE_SIZE=50000.
    // If we pump synchronously, the ingest method drains synchronously, so the queue never hits 50,000.
    observer.ingest('browser', { gId: 'goal_throughput', content: `div_${i}` });
  }
  
  // Wait for queue drain if it was async (it's synchronous here but returns Promise in theory, though we designed it sync).
  const t1 = performance.now();
  const durationSec = (t1 - t0) / 1000;
  const throughput = TARGET_EVENTS / durationSec;

  assert(emittedFrames.length === TARGET_EVENTS, `No Event Loss: 100,000/100,000 events delivered`);
  assert(throughput > 10000, `Throughput met: ${throughput.toFixed(0)} obs/sec (>10k required)`);

  // 2. Ordering & Duplicates
  let orderingPreserved = true;
  let duplicatesFound = 0;
  
  const testGoalFrames = emittedFrames.filter(f => f.goal_id === 'goal_throughput');
  for (let i = 0; i < testGoalFrames.length; i++) {
    if (testGoalFrames[i].sequence !== i + 1) {
      orderingPreserved = false;
    }
  }
  
  assert(orderingPreserved, 'Arrival order strictly preserved via sequence monotonically increasing');

  // Inject duplicate
  observer.ingest('browser', { gId: 'goal_dup', content: `dup_1` });
  observer.ingest('browser', { gId: 'goal_dup', content: `dup_1` }); // Exact duplicate
  
  const dupFrames = emittedFrames.filter(f => f.goal_id === 'goal_dup');
  assert(dupFrames.length === 2, 'Duplicate preservation: Observer emitted the exact duplicate without collapsing');

  // 3. Memory Bounds (Load Shedding)
  const boundedObserver = new ObserverLoop({ bus: mockBus });
  // Artificially block drain
  boundedObserver.isProcessing = true; 
  let accepted = 0;
  let shed = 0;
  for (let i = 0; i < 60000; i++) {
    if (boundedObserver.ingest('browser', { gId: 'flood' })) accepted++;
    else shed++;
  }
  assert(accepted === 50000, 'Memory Bounds: Accepted exactly MAX_QUEUE_SIZE (50,000)');
  assert(shed === 10000, 'Backpressure: Gracefully shed 10,000 events over capacity to prevent OOM');

  // 4. Purity validation
  // Simply ensuring no GoalRuntime or Scheduler is loaded in the module cache from observer
  const cacheKeys = Object.keys(require.cache);
  const tainted = cacheKeys.some(k => k.includes('goal-runtime.cjs') || k.includes('scheduler.cjs') || k.includes('workflow-generator.cjs'));
  assert(!tainted, 'Architectural Purity: ObserverLoop does not import any decision-making or state-owning modules');

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(console.error);
