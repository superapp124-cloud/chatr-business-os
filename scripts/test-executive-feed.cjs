'use strict';

const { scenarioEngine } = require('./scenario-engine.cjs');
// Initialize all intelligence engines so they attach to the bus and process events
require('../electron/chatr-core/intelligence/goal-engine.cjs');
require('../electron/chatr-core/intelligence/reasoning-engine.cjs');
require('../electron/chatr-core/intelligence/prediction-engine.cjs');
require('../electron/chatr-core/intelligence/opportunity-engine.cjs');
require('../electron/chatr-core/intelligence/reflection-service.cjs');
require('../electron/chatr-core/intelligence/learning-engine.cjs');
const { executiveFeed } = require('../electron/chatr-core/intelligence/executive-feed.cjs');

async function runTests() {
  console.log('====================================================');
  console.log(' CHATR OS - System Boot (Executing Scenario)');
  console.log('====================================================\\n');

  // 1. Run the massive integrated Scenario Engine
  await scenarioEngine.run('startup_founder');

  // Allow synchronous bus processing for all intelligence layers
  await new Promise(r => setTimeout(r, 250));

  // 2. Fetch the aggregated feed
  const feed = executiveFeed.getUnreadFeed();

  console.log('\\n====================================================');
  console.log(' ⚡ CHATR INTELLIGENCE FEED (Command Center Mockup)');
  console.log('====================================================\\n');

  if (feed.length === 0) {
    console.log('   No new intelligence to report.\\n');
  } else {
    for (const card of feed) {
      let icon = 'ℹ️';
      if (card.priority === 'high') icon = '🔴';
      if (card.priority === 'medium') icon = '🟡';
      if (card.priority === 'low') icon = '🟢';

      console.log(`${icon} [${card.type.toUpperCase()}] ${card.content.title}`);
      console.log(`   └─ ${card.content.body}`);
      console.log(`   └─ Action: [ ${card.content.action} ]\\n`);
    }
  }

  // 3. Validation
  const hasPrediction = feed.find(c => c.type === 'Prediction');
  const hasConflict = feed.find(c => c.type === 'Conflict');
  const hasOpportunity = feed.find(c => c.type === 'Opportunity');
  const hasInsight = feed.find(c => c.type === 'Insight');

  if (!hasPrediction || !hasConflict || !hasOpportunity || !hasInsight) {
    console.error('Test Failed: Missing one or more expected feed categories.');
    console.error({ hasPrediction: !!hasPrediction, hasConflict: !!hasConflict, hasOpportunity: !!hasOpportunity, hasInsight: !!hasInsight });
    process.exit(1);
  }
  
  console.log('✅ All Intelligence Platform Phase 6 Tests Passed!');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
