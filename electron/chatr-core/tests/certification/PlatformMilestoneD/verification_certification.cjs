'use strict';

/**
 * Platform Milestone D — Verification Engine Certification Suite
 * 
 * Asserts the Verification Engine guarantees:
 * - True Positive (All evidence present = verified)
 * - False Positive (Missing evidence = null)
 * - Multi-Evidence Confidence scoring
 * - Idempotency & Duplicate handling
 * - Determinism
 * - Performance (<5ms)
 * - Purity
 */

const { performance } = require('perf_hooks');
const { VerificationEngine } = require('../../../kernel/verification-engine.cjs');

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
  console.log('=== Platform Milestone D: Verification Engine Certification ===\n');

  const engine = new VerificationEngine();
  
  const mockGoalState = { goal_id: 'goal_verify_1', sequence: 10 };
  const expectedOutcomes = ['order_confirmed', 'payment_confirmed'];

  const evidenceDOM1 = {
    observation_id: 'obs_dom_1',
    observation_type: 'dom',
    payload: { status: 'restaurant accepted order confirmed' },
    sequence: 11
  };

  const evidenceAPI1 = {
    observation_id: 'obs_api_1',
    observation_type: 'api',
    payload: { state: 'payment_confirmed', tx_id: '123' },
    sequence: 12
  };

  const weakEvidenceDOM2 = {
    observation_id: 'obs_dom_2',
    observation_type: 'dom',
    payload: { msg: 'payment confirmed successfully' },
    sequence: 13
  };

  // 1. False Positive (Missing evidence)
  const resultFalsePos = engine.verify(mockGoalState, expectedOutcomes, [evidenceDOM1]);
  assert(resultFalsePos === null, 'False Positive: Insufficient evidence yields no verification');

  // 2. True Positive (All evidence present) & Performance
  const t0 = performance.now();
  // Using API + DOM gives high confidence
  const resultTruePos = engine.verify(mockGoalState, expectedOutcomes, [evidenceDOM1, evidenceAPI1]);
  const t1 = performance.now();
  
  assert(resultTruePos !== null, 'True Positive: Sufficient evidence yields a VerificationResult');
  assert(resultTruePos.result === 'verified', 'High Confidence: API + DOM yields "verified" status');
  assert(resultTruePos.confidence >= 0.8, 'Confidence Scoring: Multi-source evidence pushes confidence >= 0.8');
  assert(resultTruePos.evidence_refs.includes('obs_dom_1') && resultTruePos.evidence_refs.includes('obs_api_1'), 'Evidence linking preserved in VerificationResult');
  assert((t1 - t0) < 5.0, `Performance budget met: Verification took ${(t1 - t0).toFixed(3)}ms (<5ms required)`);

  // 3. Weak Evidence (Likely Verified)
  const weakEngine = new VerificationEngine();
  const mockGoal2 = { goal_id: 'goal_verify_2', sequence: 10 };
  const resultWeak = weakEngine.verify(mockGoal2, expectedOutcomes, [evidenceDOM1, weakEvidenceDOM2]);
  
  assert(resultWeak !== null, 'Weak Evidence: Evaluates successfully if semantic criteria are met');
  assert(resultWeak.result === 'likely_verified', 'Confidence Scoring: DOM-only evidence yields "likely_verified" (confidence < 0.8)');

  // 4. Idempotency & Duplicates
  const resultDup = engine.verify(mockGoalState, expectedOutcomes, [evidenceDOM1, evidenceAPI1]);
  assert(resultDup === null, 'Idempotency: Re-verifying a completed goal yields no redundant results');

  // 5. Determinism
  const detEngine1 = new VerificationEngine();
  const detEngine2 = new VerificationEngine();
  const res1 = detEngine1.verify({ goal_id: 'goal_det' }, expectedOutcomes, [evidenceDOM1, evidenceAPI1]);
  const res2 = detEngine2.verify({ goal_id: 'goal_det' }, expectedOutcomes, [evidenceDOM1, evidenceAPI1]);
  assert(res1.deterministic_hash === res2.deterministic_hash, 'Determinism: Identical evidence streams generate identical verification hashes');

  // 6. Purity validation
  const cacheKeys = Object.keys(require.cache);
  const tainted = cacheKeys.some(k => k.includes('zomato') || k.includes('browser-runtime') || k.includes('scheduler.cjs') || k.includes('goal-runtime.cjs'));
  assert(!tainted, 'Architectural Purity: VerificationEngine does not import executors, planners, or state mutators');

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runSuite();
