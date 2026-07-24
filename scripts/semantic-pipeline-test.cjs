/**
 * CHATR Core — Semantic Pipeline Test
 * 
 * Verifies the pipeline: Sense -> Knowledge -> Time -> Semantic -> Enriched
 */

const { boot } = require('../electron/chatr-core/index.cjs');
const { bus } = require('../electron/chatr-core/events/bus.cjs');
const { INTELLIGENCE } = require('../electron/chatr-core/events/events.cjs');

async function runTest() {
  console.log('Booting Kernel...');
  await boot();
  
  const { senseModule } = require('../electron/chatr-core/modules/sense/service.cjs');
  require('../electron/chatr-core/modules/semantic/service.cjs');
  
  let enrichedReceived = false;

  bus.subscribe(INTELLIGENCE.UNDERSTANDING_ENRICHED, (payload) => {
    console.log('\n✅ Pipeline test complete. Received UNDERSTANDING_ENRICHED event:');
    console.log(JSON.stringify(payload.understanding, null, 2));
    enrichedReceived = true;
    
    // Verify provenance exists
    const person = payload.understanding.entities.people?.[0];
    if (person && !person.provenance) {
      console.error('❌ Missing provenance on entity');
      process.exit(1);
    }
    
    setTimeout(() => process.exit(0), 100);
  });

  console.log('\nSending test observation...');
  // Force Dev Mode so the stub generates the LLM fallback for testing the whole pipeline
  process.env.CHATR_DEV_MOCK_MODE = 'true';
  await senseModule.observe({
    messageText: "Let's meet tomorrow with John",
    conversationId: "test-conv-01",
    requestId: "test-req-01"
  });

  setTimeout(() => {
    if (!enrichedReceived) {
      console.error('❌ Pipeline timed out.');
      process.exit(1);
    }
  }, 2000);
}

runTest().catch(e => {
  console.error(e);
  process.exit(1);
});
