'use strict';

/**
 * Platform Milestone C — Certification Suite
 * Validates the full Resolution Pipeline:
 * CapabilityRequest -> Strategy -> Policy -> Trust -> ProviderIntelligence
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const { StrategyResolver }     = require('../../../kernel/strategy-resolver.cjs');
const { PolicyService }        = require('../../../kernel/policy-service.cjs');
const { TrustService }         = require('../../../kernel/trust-service.cjs');
const { ResourceManager }      = require('../../../kernel/resource-manager.cjs');
const { ProviderIntelligence } = require('../../../kernel/provider-intelligence.cjs');

// Mock persistence to avoid sqlite binary mismatch in test environments
const mockPersistence = {
  retrieve: () => ({}),
  store: () => {}
};

const strategyResolver     = new StrategyResolver({ persistence: mockPersistence });
const policyService        = new PolicyService({ persistence: mockPersistence });
const trustService         = new TrustService({ persistence: mockPersistence });
const resourceManager      = new ResourceManager({ persistence: mockPersistence });
const providerIntelligence = new ProviderIntelligence({
  persistence: mockPersistence,
  strategy: strategyResolver,
  policy: policyService,
  trust: trustService,
  resources: resourceManager
});

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

async function runCertification() {
  console.log('=== Platform Milestone C Certification ===\n');

  // Dry run pipeline
  const capRequest = {
    abi: 'chatr.capability_request.v0_9_rc',
    request_id: 'req_123',
    capability: 'DISCOVER',
    strategy_support: ['fastest', 'cheapest', 'highest_rated', 'most_trusted', 'local_first', 'privacy_first'],
    goal_id: 'goal_123'
  };

  const ctx = {
    network: { available: true, quality: 'good' },
    preferences: { local_first: true }
  };

  // Test Strategy
  const strategy = strategyResolver.resolve({ capability_request: capRequest, context_frame: ctx, dry_run: true });
  assert(strategy.abi === 'chatr.strategy_selection.v0_9_rc', 'Strategy ABI correct');
  assert(strategy.strategy === 'local_first', 'Strategy respects context preferences');
  assert(Object.isFrozen(strategy), 'Strategy is immutable');

  // Test Policy
  const policy = policyService.evaluate({ capability_request: capRequest, context_frame: ctx, dry_run: true });
  assert(policy.abi === 'chatr.policy_decision.v0_9_rc', 'Policy ABI correct');
  assert(policy.decision === 'allow', 'Policy defaults to allow for DISCOVER');
  assert(Object.isFrozen(policy), 'Policy is immutable');

  // Test Provider Intelligence (which internally uses Trust and Resources)
  const selections = providerIntelligence.resolveProvider({
    capability_request: capRequest,
    context_frame: ctx,
    dry_run: true
  });
  
  assert(Array.isArray(selections) && selections.length > 0, 'Provider Intelligence returns selections');
  
  for (const s of selections) {
    assert(s.abi === 'chatr.provider_selection.v0_9_rc', 'ProviderSelection ABI correct');
    assert(s.provider_id.startsWith('provider.'), 'Provider ID format correct');
    assert(s.execution_mode, 'Execution mode set');
    assert(Object.isFrozen(s), 'Selection is immutable');
  }
  
  const winningSelection = selections[0];
  const strategyRef = winningSelection.strategy_selection_ref;
  const policyRef = winningSelection.policy_decision_ref;
  
  assert(strategyRef && strategyRef.startsWith('strategy_sel_'), 'Links to Strategy');
  assert(policyRef && policyRef.startsWith('policy_dec_'), 'Links to Policy');

  // Performance gate (warm up)
  for (let i=0; i<10; i++) {
    providerIntelligence.resolveProvider({ capability_request: capRequest, context_frame: ctx, dry_run: true });
  }

  const iters = 100;
  const start = performance.now();
  for (let i=0; i<iters; i++) {
    providerIntelligence.resolveProvider({ capability_request: capRequest, context_frame: ctx, dry_run: true });
  }
  const end = performance.now();
  const avg = (end - start) / iters;
  
  assert(avg < 50, `Pipeline regression gate: avg ${avg.toFixed(2)}ms (must be < 50ms)`);

  const totalTests = passed + failed;
  
  console.log(`\nTests: ${passed} passed, ${failed} failed.`);
  
  // Write Artifact
  const artifactPath = path.resolve(__dirname, '../../../../certifications/PlatformMilestoneC/certification-artifact.json');
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  
  const artifact = {
    schema: "chatr.certification.v1",
    certification_id: `cert-platform-milestone-c-resolution-layer-${new Date().toISOString().split('T')[0]}`,
    milestone: "Platform Milestone C — Resolution Layer",
    milestone_key: "PlatformMilestoneC",
    kernel_version: "0.9.1-pre",
    abi_version: "chatr.kernel.v0_9_rc",
    certified: failed === 0,
    certification_date: new Date().toISOString(),
    status: failed === 0 ? "CERTIFIED" : "FAILED",
    tests_passed: passed,
    tests_failed: failed,
    performance_snapshot: {
      ci_regression_gate_ms: 50,
      measurement: `avg, ${iters} runs, no I/O (dry_run)`,
      value_ms: parseFloat(avg.toFixed(2))
    }
  };
  
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), 'utf8');
  console.log(`Artifact written to ${artifactPath}`);
  
  if (failed > 0) process.exit(1);
}

runCertification().catch(err => {
  console.error(err);
  process.exit(1);
});
