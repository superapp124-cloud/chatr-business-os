'use strict';

const { scenarioEngine } = require('./scenario-engine.cjs');
const { worldModel } = require('../electron/chatr-core/world-model/world-model.cjs');
const { goalEngine } = require('../electron/chatr-core/intelligence/goal-engine.cjs');
const { reasoningEngine } = require('../electron/chatr-core/intelligence/reasoning-engine.cjs');
const { predictionEngine } = require('../electron/chatr-core/intelligence/prediction-engine.cjs');
const { bus } = require('../electron/chatr-core/events/bus.cjs');

async function runTests() {
  console.log('--- TEST: CHATR Intelligence Platform Phase 3 (Reasoning & Prediction) ---');

  // Track emitted events
  const emittedConflicts = [];
  const emittedForecasts = [];

  bus.subscribe('intelligence.reasoning.conflict_detected', (e) => {
    emittedConflicts.push(e.payload);
  });

  bus.subscribe('intelligence.prediction.forecast', (e) => {
    emittedForecasts.push(e.payload);
  });

  // 1. Run the Scenario Engine (which now backdates the funding goal)
  await scenarioEngine.run('startup_founder');

  // Allow synchronous bus processing
  await new Promise(r => setTimeout(r, 100));

  // 2. Validate Reasoning Engine Conflicts
  if (emittedConflicts.length === 0) {
    throw new Error('Reasoning Engine failed to detect the travel budget conflict.');
  }

  const fundingConflict = emittedConflicts.find(c => c.goal_id === 'goal_q3_funding');
  if (!fundingConflict) {
    throw new Error('Reasoning Engine did not flag goal_q3_funding.');
  }

  console.log(`✅ Reasoning Engine successfully detected conflict:`, fundingConflict.conflicts[0]);

  // 3. Validate Reasoning Engine Tactics Generation
  const tactics = reasoningEngine.generateTactics('goal_health'); // Has 0% progress
  if (!tactics || tactics.length === 0 || tactics[0].action !== 'research') {
    throw new Error('Reasoning Engine failed to generate correct tactics for stalled goal.');
  }
  console.log(`✅ Reasoning Engine successfully generated tactics for stalled goal_health.`);

  // 4. Validate Prediction Engine Forecasts
  if (emittedForecasts.length === 0) {
    throw new Error('Prediction Engine failed to emit forecast warning.');
  }

  const fundingForecast = emittedForecasts.find(f => f.goal_id === 'goal_q3_funding');
  if (!fundingForecast) {
    throw new Error('Prediction Engine did not forecast goal_q3_funding.');
  }

  if (fundingForecast.prediction !== 'miss_deadline') {
    throw new Error(`Prediction Engine forecasted ${fundingForecast.prediction} instead of miss_deadline`);
  }

  console.log(`✅ Prediction Engine successfully forecasted trajectory:`, fundingForecast.reason);

  console.log('\\n✅ All Intelligence Platform Phase 3 Tests Passed!');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
