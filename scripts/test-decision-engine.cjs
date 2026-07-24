const { planner } = require('../electron/chatr-core/kernel/planner.cjs');
const { decisionEngine, DECISION } = require('../electron/chatr-core/kernel/decision-engine.cjs');
const { executionEngine } = require('../electron/chatr-core/kernel/execution-graph.cjs');
const { intentStore } = require('../electron/chatr-core/kernel/intent-store.cjs');

async function runTests() {
  console.log('--- TEST: DECISION & EXECUTION PIPELINE (PHASE 4) ---');

  // 1. Create a raw intent with rich semantics
  const intentData = {
    id: 'intent_999',
    raw_text: 'Book a premium ride to the airport',
    intent_type: 'action.book',
    risk: 'low',
    estimated_cost: 600, // Above the default $500 policy threshold!
    dependencies: [],
    constraints: { from: 'Home', to: 'Airport', type: 'premium' }
  };
  
  // Directly simulate IntentStore creation for testing
  intentStore.applyEvent({
    event_type: 'kernel.intent.created',
    timestamp: Date.now(),
    payload: intentData
  });

  const intent = intentStore.get('intent_999');
  
  // 2. Planning Engine -> Abstract Graph
  const abstractGraph = planner.plan(intent);
  
  console.log('\\n[1] Generated Abstract Graph');

  // 3. Decision Engine
  // Test Case A: Should require approval because estimated_cost (600) > maxCostBeforeApproval (500)
  const resultA = decisionEngine.decide(abstractGraph, intent, {});
  
  console.log(`\\n[2] Decision Gate (Cost > 500): ${resultA.decision}`);
  if (resultA.decision !== DECISION.REQUIRE_APPROVAL) {
    throw new Error('Decision Engine failed to halt execution for high cost policy constraint.');
  }

  // Test Case B: Lower cost, should proceed to Binding
  intent.estimated_cost = 40;
  
  // Inject mock WorldModel context for preferred provider
  const wmContext = {
    preferences: {
      'action.book': { preferredConnector: { value: 'provider.ola.mock' } }
    }
  };

  const resultB = decisionEngine.decide(abstractGraph, intent, wmContext);
  
  console.log(`\\n[3] Decision Gate (Cost < 500, with Prefs): ${resultB.decision}`);
  if (resultB.decision !== DECISION.BIND) {
    throw new Error('Decision Engine failed to BIND valid intent.');
  }

  const concreteGraph = resultB.concreteGraph;
  const boundNode = concreteGraph.nodes.find(n => n.capability === 'Transport.BookRide');
  
  console.log(`    Bound Provider: ${boundNode.providerName} (${boundNode.providerId})`);
  
  // Verify preference override (Ola normally loses to Uber on trust, but is explicitly preferred here)
  if (boundNode.providerId !== 'provider.ola.mock') {
    throw new Error('Decision Engine failed to honor WorldModel preference for Ola.');
  }

  // 4. Execution Engine
  console.log('\\n[4] Dispatching to Execution Engine...');
  
  // The execution engine listens to the bus, but we can call it directly for the test
  await executionEngine._startExecution({
    payload: {
      intent_id: intent.id,
      concreteGraph
    }
  });

  console.log('\\n✅ All Decision & Execution Tests Passed!');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
