'use strict';

const { scenarioEngine } = require('./scenario-engine.cjs');
const { worldModel } = require('../electron/chatr-core/world-model/world-model.cjs');
// Initialize intelligence engines to attach their bus listeners
require('../electron/chatr-core/intelligence/goal-engine.cjs');
require('../electron/chatr-core/intelligence/opportunity-engine.cjs');
const { bus } = require('../electron/chatr-core/events/bus.cjs');

async function runTests() {
  console.log('--- TEST: CHATR Intelligence Platform Phase 5 (Opportunity Engine) ---');

  const identifiedOpportunities = [];

  bus.subscribe('intelligence.opportunity.identified', (e) => {
    identifiedOpportunities.push(e.payload);
  });

  // 1. Run the Scenario Engine (which emits a person_2 with high availability and slipping goals)
  await scenarioEngine.run('startup_founder');

  // Allow synchronous bus processing
  await new Promise(r => setTimeout(r, 100));

  // 2. Validate Opportunity Engine
  if (identifiedOpportunities.length === 0) {
    throw new Error('Opportunity Engine failed to identify any opportunities.');
  }

  // The engine should identify that 'goal_q3_funding' is critical but slipping (<50% progress before fail), 
  // and suggest delegating to person_2 (Sarah).
  const delegationOpp = identifiedOpportunities.find(opp => opp.type === 'delegation' && opp.goal_id === 'goal_q3_funding');
  
  if (!delegationOpp) {
    throw new Error('Opportunity Engine did not suggest delegating the stalled funding goal.');
  }

  if (delegationOpp.target_person_id !== 'person_2') {
    throw new Error(`Opportunity Engine suggested wrong person. Expected person_2, got ${delegationOpp.target_person_id}`);
  }

  console.log(`✅ Opportunity Engine successfully identified delegation opportunity:`);
  console.log(`   -> ${delegationOpp.recommendation}`);
  
  console.log('\\n✅ All Intelligence Platform Phase 5 Tests Passed!');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
