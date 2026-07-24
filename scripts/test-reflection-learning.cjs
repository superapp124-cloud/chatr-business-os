'use strict';

const { scenarioEngine } = require('./scenario-engine.cjs');
const { worldModel } = require('../electron/chatr-core/world-model/world-model.cjs');
// These need to be required to attach their bus listeners
require('../electron/chatr-core/intelligence/reflection-service.cjs');
require('../electron/chatr-core/intelligence/learning-engine.cjs');

async function runTests() {
  console.log('--- TEST: CHATR Intelligence Platform Phase 4 (Reflection & Learning) ---');

  // Verify initial constraint state
  const initialConstraints = worldModel.getConstraints('travel');
  let initialLimit = 0;
  if (initialConstraints.length > 0) {
    initialLimit = initialConstraints[0].limit;
  }

  // 1. Run the Scenario Engine (which now emits a goal failure at the end)
  await scenarioEngine.run('startup_founder');

  // Allow synchronous bus processing for reflection & learning
  await new Promise(r => setTimeout(r, 100));

  // 2. Validate UWM mutation by Learning Engine
  const updatedConstraints = worldModel.getConstraints('travel');
  if (updatedConstraints.length === 0) {
    throw new Error('Travel constraint is missing from UWM.');
  }

  const updatedLimit = updatedConstraints[0].limit;
  
  // The original limit is 5000. Reflection recommends +20%. So new limit should be 6000.
  if (updatedLimit === 5000) {
    throw new Error('Learning Engine failed to mutate the UWM constraint. Limit is still 5000.');
  }
  
  if (updatedLimit !== 6000) {
    throw new Error(`Learning Engine mutated constraint incorrectly. Expected 6000, got ${updatedLimit}`);
  }

  if (!updatedConstraints[0]._learned) {
    throw new Error('Learning Engine failed to tag the mutated constraint with _learned: true');
  }

  console.log(`✅ Reflection Service generated insight on goal failure.`);
  console.log(`✅ Learning Engine successfully mutated UWM (increased budget from 5000 to ${updatedLimit}).`);
  
  console.log('\\n✅ All Intelligence Platform Phase 4 Tests Passed!');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
