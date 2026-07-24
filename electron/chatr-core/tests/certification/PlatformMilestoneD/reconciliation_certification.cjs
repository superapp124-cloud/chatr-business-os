'use strict';

/**
 * Platform Milestone D — Reconciliation Engine Certification Suite
 * 
 * Asserts the Reconciliation Engine guarantees:
 * - No False Recovery (Happy path = null)
 * - Correct Drift Detection (Failure = Proposal)
 * - Idempotency (Duplicate Observation = null)
 * - Determinism (Same input = Same Hash)
 * - Performance (<5ms)
 * - Purity
 */

const { performance } = require('perf_hooks');
const { ReconciliationEngine, DriftSeverity } = require('../../../kernel/reconciliation-engine.cjs');

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
  console.log('=== Platform Milestone D: Reconciliation Engine Certification ===\n');

  const engine = new ReconciliationEngine();
  
  const mockGoalState = { goal_id: 'goal_recon_1' };
  const mockWorkflow = {
    nodes: [
      { node_id: 'node_1', action: 'AUTHENTICATE' },
      { node_id: 'node_2', action: 'PAY' }
    ]
  };

  const happyObservation = {
    observation_id: 'obs_happy_1',
    workflow_step: 'AUTHENTICATE',
    payload: { status: 'Login successful' },
    sequence: 1
  };

  const failObservation = {
    observation_id: 'obs_fail_1',
    workflow_step: 'AUTHENTICATE',
    payload: { status: 'Login Expired' },
    sequence: 2
  };

  const invalidObservation = {
    observation_id: 'obs_invalid_1',
    workflow_step: 'JUMP_OUT_OF_AIRPLANE',
    payload: { status: 'Falling' },
    sequence: 3
  };

  // 1. No False Recovery & Performance
  const t0 = performance.now();
  const proposalNone = engine.reconcile(mockGoalState, mockWorkflow, happyObservation);
  const t1 = performance.now();
  
  assert(proposalNone === null, 'No False Recovery: Happy path yields no proposal');
  assert((t1 - t0) < 5.0, `Performance budget met: Reconciliation took ${(t1 - t0).toFixed(3)}ms (<5ms required)`);

  // 2. Correct Drift Detection
  const proposalFail = engine.reconcile(mockGoalState, mockWorkflow, failObservation);
  assert(proposalFail !== null, 'Correct Drift Detection: Failure generated a RecoveryProposal');
  assert(proposalFail.proposal_type === 're_authenticate', 'Drift Classification: correctly identified auth expiration');
  assert(proposalFail.metadata.severity === DriftSeverity.HIGH, 'Drift Classification: correctly assigned High severity');

  // 3. Determinism
  // Reset idempotency cache just for determinism test
  const determinismEngine = new ReconciliationEngine();
  const proposalFail2 = determinismEngine.reconcile(mockGoalState, mockWorkflow, failObservation);
  assert(proposalFail.deterministic_hash === proposalFail2.deterministic_hash, 'Determinism: Same observation yields identical proposal hash');

  // 4. Idempotency (Duplicate Observation)
  const proposalDup = engine.reconcile(mockGoalState, mockWorkflow, failObservation);
  assert(proposalDup === null, 'Idempotency: Exact duplicate observation generates no conflicting proposal');

  // 5. Invalid State (Out of bounds)
  const proposalInvalid = determinismEngine.reconcile(mockGoalState, mockWorkflow, invalidObservation);
  assert(proposalInvalid.proposal_type === 'abort_workflow', 'Drift Detection: Invalid workflow step caught as CRITICAL');
  assert(proposalInvalid.metadata.severity === DriftSeverity.CRITICAL, 'Drift Detection: Missing step is CRITICAL severity');

  // 6. Purity validation
  const cacheKeys = Object.keys(require.cache);
  const tainted = cacheKeys.some(k => k.includes('zomato') || k.includes('browser-runtime') || k.includes('scheduler.cjs'));
  assert(!tainted, 'Architectural Purity: ReconciliationEngine does not import executors or schedule routines');

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runSuite();
