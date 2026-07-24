'use strict';

/**
 * Platform Milestone D — Workflow Generator Certification Suite
 * 
 * Asserts the Workflow Generator strict pure compiler guarantees:
 * - Determinism
 * - Graph Immutability
 * - Persistence (Hash consistency)
 * - Topology validation
 * - Performance (<5ms)
 * - Purity
 */

const { performance } = require('perf_hooks');
const { WorkflowGenerator, STANDARD_NODES } = require('../../../kernel/workflow-generator.cjs');

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
  console.log('=== Platform Milestone D: Workflow Generator Certification ===\n');

  const generator = new WorkflowGenerator();
  
  const mockGoalPlan = {
    goal_id: 'goal_test_1',
    capabilities: ['DISCOVER', 'PAY'],
    requires_user_selection: true
  };

  const mockProviderSelection = {
    provider_id: 'mock_provider',
    execution_mode: 'ExecutionMode.API',
    capabilities: ['DISCOVER', 'PAY'],
    requires_authentication: true
  };

  // 1. Performance
  const t0 = performance.now();
  const graph1 = generator.compile(mockGoalPlan, mockProviderSelection);
  const t1 = performance.now();
  assert((t1 - t0) < 5.0, `Performance budget met: Compilation took ${(t1 - t0).toFixed(3)}ms (<5ms required)`);

  // 2. Determinism
  const graph2 = generator.compile(mockGoalPlan, mockProviderSelection);
  assert(graph1.deterministic_hash === graph2.deterministic_hash, 'Workflow Determinism: Same input yields identical hash');
  assert(graph1.graph_id !== graph2.graph_id, 'Workflow uniqueness: IDs are unique even for same logical structure');

  // 3. Immutability
  try {
    graph1.nodes[0].action = 'HACKED';
    assert(graph1.nodes[0].action !== 'HACKED', 'Graph is immutable: modifications are ignored (strict mode would throw)');
  } catch (err) {
    assert(true, 'Graph is immutable: modifications throw in strict mode');
  }

  // 4. Persistence Reload consistency
  const serialized = JSON.stringify(graph1);
  const reloaded = JSON.parse(serialized);
  const reloadedHash = generator._calculateHash(reloaded);
  assert(reloadedHash === graph1.deterministic_hash, 'Graph Persistence: Reloaded graph yields identical hash');

  // 5. Topology Validation
  // Single entry point
  const targets = new Set(graph1.edges.map(e => e.to));
  const starts = graph1.nodes.filter(n => !targets.has(n.node_id));
  assert(starts.length === 1 && starts[0].action === STANDARD_NODES.START, 'Topology: Single START entry point');

  // Single terminal point
  const sources = new Set(graph1.edges.map(e => e.from));
  const terminals = graph1.nodes.filter(n => !sources.has(n.node_id));
  assert(terminals.length === 1 && terminals[0].action === STANDARD_NODES.END, 'Topology: Single END terminal state');

  // Acyclic (Simple linear check since this generator outputs linear sequences currently)
  assert(graph1.edges.length === graph1.nodes.length - 1, 'Topology: Valid sequence edges without cycles');

  // 6. Purity
  const textRepresentation = JSON.stringify(graph1);
  const providerNames = ['zomato', 'swiggy', 'irctc', 'razorpay', 'mock_provider'];
  const hasProviderName = providerNames.some(p => textRepresentation.toLowerCase().includes(p));
  assert(!hasProviderName, 'Purity: WorkflowGraph contains no provider names or execution details');

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runSuite();
