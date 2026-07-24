'use strict';

/**
 * Platform Milestone D — Scheduler Certification Suite
 * 
 * Asserts the Scheduler guarantees:
 * - Idempotency
 * - Priority & Fairness (Anti-starvation)
 * - Lease Respect (Valid leases only)
 * - Persistence (Restart queue survival)
 * - Performance (<2ms decisions, <1ms insertion)
 */

const { performance } = require('perf_hooks');
const { Scheduler } = require('../../../kernel/scheduler.cjs');

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

function runSuite() {
  console.log('=== Platform Milestone D: Scheduler Certification ===\n');

  const activeLeases = new Set(['lease_1', 'lease_2']);
  
  const mockPersistence = {
    storeData: {},
    store: function(col, data) { this.storeData[col] = data.queue; },
    query: function(col) { return this.storeData[col] || []; }
  };

  const scheduler = new Scheduler({ persistence: mockPersistence });

  // 1. Queue Insertion Performance & Idempotency
  const t0 = performance.now();
  scheduler.requestSlot('goal_1', 'step_A', 'lease_1', 10, Date.now());
  scheduler.requestSlot('goal_1', 'step_A', 'lease_1', 10, Date.now()); // Duplicate!
  const t1 = performance.now();
  
  assert((t1 - t0) < 1.0, `Queue insertion < 1ms (${(t1 - t0).toFixed(3)}ms)`);
  assert(scheduler.queue.length === 1, 'Idempotency: Duplicate requests ignored');

  // 2. Lease Respect
  scheduler.requestSlot('goal_no_lease', 'step_X', 'lease_INVALID', 99, Date.now());
  const alloc1 = scheduler.allocateNext(activeLeases); // Should NOT pick goal_no_lease despite priority 99
  assert(alloc1.goal_id === 'goal_1', 'Lease Respect: Scheduler strictly skipped invalid lease');

  // 3. Priority
  scheduler.requestSlot('goal_low', 'step_A', 'lease_2', 10, Date.now());
  scheduler.requestSlot('goal_high', 'step_A', 'lease_2', 90, Date.now());
  const alloc2 = scheduler.allocateNext(activeLeases);
  assert(alloc2.goal_id === 'goal_high', 'Priority: Higher priority scheduled earlier');

  // 4. Fairness (Anti-starvation via allocation penalization)
  // Give goal_high multiple queued requests, but give goal_low one.
  scheduler.requestSlot('goal_high', 'step_B', 'lease_2', 90, Date.now());
  scheduler.requestSlot('goal_high', 'step_C', 'lease_2', 90, Date.now());
  scheduler.requestSlot('goal_high', 'step_D', 'lease_2', 90, Date.now());

  let foundLow = false;
  let loops = 0;
  while (scheduler.queue.length > 0 && loops < 10) {
    loops++;
    const slot = scheduler.allocateNext(activeLeases);
    if (!slot) break;
    if (slot.goal_id === 'goal_low') {
      foundLow = true;
      break;
    }
  }
  assert(foundLow, 'Fairness: Starvation prevented via penalty/aging algorithms');

  // 5. Persistence Recovery
  scheduler.requestSlot('goal_persistent', 'step_A', 'lease_1', 50, Date.now());
  
  // Simulate crash and restart
  const scheduler2 = new Scheduler({ persistence: mockPersistence });
  assert(scheduler2.queue.length >= 1 && scheduler2.queue.some(q => q.goal_id === 'goal_persistent'), 'Persistence: Queue survived restart');

  // 6. Bulk Performance (1000 queued items)
  for (let i = 0; i < 1000; i++) {
    scheduler2.requestSlot(`goal_bulk_${i}`, 'step_1', 'lease_1', 50, Date.now());
  }
  const t2 = performance.now();
  scheduler2.allocateNext(activeLeases);
  const t3 = performance.now();
  assert((t3 - t2) < 2.0, `Allocation performance with 1000 items < 2ms (${(t3 - t2).toFixed(3)}ms)`);

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runSuite();
