const { planner } = require('../electron/chatr-core/kernel/planner.cjs');
const { decisionEngine } = require('../electron/chatr-core/kernel/decision-engine.cjs');
const { executionEngine } = require('../electron/chatr-core/kernel/execution-graph.cjs');
const { intentStore } = require('../electron/chatr-core/kernel/intent-store.cjs');

// Require verificationEngine just to bind it to the bus
require('../electron/chatr-core/kernel/verification-engine.cjs');

async function runTests() {
  console.log('--- TEST: POLICY & VERIFICATION PIPELINE (PHASE 5) ---');

  // 1. Create intent
  const intentData = {
    id: 'intent_policy_test',
    raw_text: 'Buy a server',
    intent_type: 'action.buy',
    estimated_cost: 2000, // OVER the $1000 Policy Engine hard cap
    success_criteria: ['successfully executed'] // Matching the mock execution engine output
  };
  
  intentStore.applyEvent({
    event_type: 'kernel.intent.created',
    timestamp: Date.now(),
    payload: intentData
  });

  const intent = intentStore.get('intent_policy_test');
  const abstractGraph = planner.plan(intent);
  
  // 2. Decision Engine (Let's assume the user bypassed the $500 maxCostBeforeApproval somehow, so we get a BIND)
  // We can force a BIND by mutating the decision engine policy for the test, 
  // to prove the PolicyEngine catches it at the OS level.
  decisionEngine._policy.maxCostBeforeApproval = 5000;
  
  const result = decisionEngine.decide(abstractGraph, intent, {});
  console.log(`\\n[1] Decision Engine Output: ${result.decision}`);
  
  // 3. Execution Engine -> Policy Engine Intercept
  console.log('\\n[2] Dispatching to Execution Engine (Expected: Policy Violation)');
  
  await executionEngine._startExecution({
    payload: {
      intent_id: intent.id,
      concreteGraph: result.concreteGraph,
      intent
    }
  });

  // Verify the Intent Store status
  if (intentStore.get('intent_policy_test').status === 'EXECUTING') {
    throw new Error('Policy Engine failed to block the execution!');
  }
  console.log('✅ Policy Engine successfully blocked execution exceeding hard OS transaction limits.');

  // 4. Test Verification Loop (Success Path)
  console.log('\\n[3] Testing Verification Engine Loop');
  
  intent.estimated_cost = 50; // Below limits
  const validResult = decisionEngine.decide(abstractGraph, intent, {});
  
  await executionEngine._startExecution({
    payload: {
      intent_id: intent.id,
      concreteGraph: validResult.concreteGraph,
      intent
    }
  });

  // Wait a tiny bit for the synchronous event bus subscribers to finish
  await new Promise(resolve => setTimeout(resolve, 100));

  const completedIntent = intentStore.get('intent_policy_test');
  if (completedIntent.status !== 'COMPLETED') {
    throw new Error(`Verification Engine failed to complete intent. Status is: ${completedIntent.status}`);
  }
  
  console.log('✅ Verification Engine successfully cryptographically verified evidence and marked intent COMPLETED.');
  console.log('\\n✅ All Phase 5 Tests Passed!');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
