'use strict';

/**
 * Platform Milestone D — Goal Runtime Certification Suite
 * 
 * Asserts the Goal Runtime strict pure state machine guarantees:
 * - Illegal transition rejection
 * - Duplicate event handling (idempotency)
 * - Out-of-order events
 * - State immutability
 * - Performance (<1ms transitions)
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { GoalRuntime, GoalStatus } = require('../../../kernel/goal-runtime.cjs');

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
  console.log('=== Platform Milestone D: Goal Runtime Certification ===\n');

  const runtime = new GoalRuntime();
  
  // 1. Initial State
  const goal = runtime.createGoal('goal_test_1', 'intent_1');
  assert(goal.status === GoalStatus.CREATED, 'Goal initialized in CREATED state');

  // 2. Illegal Transition Rejection
  try {
    runtime.process({
      abi: 'chatr.observation_frame.v0_9_rc',
      goal_id: 'goal_test_1',
      sequence: 1
    });
    assert(false, 'Failed to reject illegal transition (ObservationFrame from CREATED)');
  } catch (err) {
    assert(err.message.includes('Illegal transition'), 'Correctly rejected ObservationFrame in CREATED state');
  }

  // 3. Valid Transition & Performance
  const t0 = performance.now();
  const nextGoal = runtime.process({
    abi: 'chatr.workflow_graph.v0_9_rc',
    goal_id: 'goal_test_1',
    sequence: 1,
    producer: 'workflow-generator'
  });
  const t1 = performance.now();
  assert(nextGoal.status === GoalStatus.READY, 'Goal transitioned to READY upon receiving WorkflowGraph');
  assert((t1 - t0) < 1.0, `Performance budget met: Transition took ${(t1 - t0).toFixed(3)}ms (<1ms required)`);

  // 4. Duplicate Event Handling (Idempotency)
  const duplicateGoal = runtime.process({
    abi: 'chatr.workflow_graph.v0_9_rc',
    goal_id: 'goal_test_1',
    sequence: 1,
    producer: 'workflow-generator'
  });
  // Since we already processed sequence 1, this should return the current state unchanged, without throwing an illegal transition error
  assert(duplicateGoal.history.length === nextGoal.history.length, 'Duplicate processing ignored (Idempotency check)');
  
  // 5. Out-of-order Events
  // Currently in READY. We need SchedulerAllocation (seq 2) -> RUNNING.
  const runningGoal = runtime.process({
    abi: 'chatr.scheduler_allocation.v0_9_rc',
    goal_id: 'goal_test_1',
    sequence: 2
  });
  assert(runningGoal.status === GoalStatus.RUNNING, 'Goal transitioned to RUNNING via SchedulerAllocation');

  // Next we expect ObservationFrame (seq 4) -> (seq 3 arrives late)
  const obs4 = runtime.process({
    abi: 'chatr.observation_frame.v0_9_rc',
    goal_id: 'goal_test_1',
    sequence: 4
  });
  assert(obs4.status === GoalStatus.RUNNING, 'Processed out-of-order sequence 4 (Observation)');

  // Sequence 3 arrives late!
  const lateObs3 = runtime.process({
    abi: 'chatr.observation_frame.v0_9_rc',
    goal_id: 'goal_test_1',
    sequence: 3
  });
  // Should ignore sequence 3 because 4 was already processed. (idempotency/ordering invariant)
  assert(lateObs3.history.length === obs4.history.length, 'Ignored strictly older sequence 3 arriving after sequence 4 (Clock Skew/Out-of-order protection)');

  // 6. Terminal Evidence
  const completedGoal = runtime.process({
    abi: 'chatr.verification_result.v0_9_rc',
    goal_id: 'goal_test_1',
    sequence: 5,
    result: 'verified'
  });
  assert(completedGoal.status === GoalStatus.COMPLETED, 'Goal transitioned to COMPLETED upon VerificationResult');

  // Attempting to transition after terminal
  try {
    runtime.process({
      abi: 'chatr.observation_frame.v0_9_rc',
      goal_id: 'goal_test_1',
      sequence: 6
    });
    assert(false, 'Failed to reject transition on Terminal state');
  } catch (err) {
    assert(err.message.includes('already terminal'), 'Correctly rejected transition on terminal Goal');
  }

  // 7. State Immutability
  // Modifying the returned object should not mutate the internal kernel state
  completedGoal.status = 'HACKED';
  const realGoal = runtime.getGoal('goal_test_1');
  assert(realGoal.status === GoalStatus.COMPLETED, 'Internal GoalRuntimeState is immutable against external mutations');

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runSuite();
