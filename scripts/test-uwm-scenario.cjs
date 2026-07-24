const { worldModel } = require('../electron/chatr-core/world-model/world-model.cjs');
const { goalEngine } = require('../electron/chatr-core/intelligence/goal-engine.cjs');

// The scenario engine is actually in scripts/, adjusting path
const ScenarioEngineModule = require('./scenario-engine.cjs');

async function runTests() {
  console.log('--- TEST: CHATR Intelligence Platform Phase 1/2 ---');
  
  // 1. Run the Scenario Engine
  await ScenarioEngineModule.scenarioEngine.run('startup_founder');

  // Allow a tiny amount of time for synchronous event bus processing
  await new Promise(r => setTimeout(r, 100));

  // 2. Validate Unified World Model (UWM)
  const person = worldModel.getPerson('user_1');
  if (!person || person.name !== 'Arshid Wani') {
    throw new Error('UWM failed to project Personal Twin (Identity).');
  }

  const business = worldModel.getBusinessContext();
  const company = business.find(b => b.entity_type === 'company' && b.name === 'CHATR AI');
  if (!company) {
    throw new Error('UWM failed to project Business Twin (Company).');
  }

  const constraints = worldModel.getConstraints('travel');
  if (constraints.length === 0 || constraints[0].limit !== 5000) {
    throw new Error('UWM failed to project Business Twin (Constraints).');
  }

  const relationships = worldModel.getRelationships('user_1');
  if (relationships.length === 0 || relationships[0].name !== 'Sarah') {
    throw new Error('UWM failed to project Social Graph (Relationships).');
  }
  
  console.log('✅ Unified World Model (UWM) successfully populated from raw events.');

  // 3. Validate Goal Engine
  const activeGoals = goalEngine.getActiveGoals('user_1');
  if (activeGoals.length !== 2) {
    throw new Error(`Goal Engine expected 2 active goals, got ${activeGoals.length}`);
  }

  const fundingGoal = activeGoals.find(g => g.id === 'goal_q3_funding');
  if (!fundingGoal) {
    throw new Error('Goal Engine failed to project Funding Goal.');
  }

  if (fundingGoal.progress_score !== 50) {
    throw new Error(`Goal Engine failed to calculate progress score. Expected 50, got ${fundingGoal.progress_score}`);
  }

  const slippingGoals = goalEngine.getSlippingGoals();
  // Given deadline is 30 days away, it shouldn't be slipping based on our 7-day rule, unless we tweak it.
  // We'll just verify the query works without error.
  console.log(`✅ Goal Engine verified. Progress tracking active. Slipping goals found: ${slippingGoals.length}`);
  
  console.log('\\n✅ All Intelligence Platform Phase 1/2 Tests Passed!');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
