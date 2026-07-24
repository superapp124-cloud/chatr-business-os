import { commitmentPlanner } from '../src/core/services/CommitmentPlanner';
import { commitmentRuntime } from '../src/core/capabilities/CommitmentRuntime';
import { eventBus } from '../src/core/services/EventBus';
import { realityEngine } from '../src/core/services/RealityEngine';
import { Intent } from '../src/core/capabilities/types';
import { initializeCapabilities } from '../src/core/capabilities/init';

async function testReminder() {
  // instantiate realityEngine by referencing it
  const re = realityEngine;
  initializeCapabilities();
  
  console.log('--- Starting Reminder Test ---');

  // Let's set up a listener to confirm commitments automatically for the test
  eventBus.subscribe('chatr:commitment-suggested', async (event) => {
    console.log(`[Test] Automatically confirming suggested commitment...`);
    await commitmentRuntime.confirmCommitment(event.payload.commitment);
  });
  
  eventBus.subscribe('chatr:timer-fired', async (event) => {
    console.log(`[Test] Timer fired for commitment ${event.payload.commitmentId}`);
  });

  const intent: Intent = {
    action: 'Remind me to drink water in 1 second',
    confidence: 1.0,
    entities: {
      title: 'Drink water',
      time: new Date(Date.now() + 1000).toISOString()
    }
  };

  const commitment = await commitmentPlanner.plan(intent);
  
  if (commitment) {
    // Wait for the Reality Engine to do its thing
    setTimeout(() => {
      console.log('--- Event History ---');
      const history = eventBus.getHistory();
      history.forEach((evt, idx) => {
        console.log(`${idx + 1}. [${evt.source}] ${evt.type}`);
      });
      console.log('--- Test Complete ---');
      process.exit(0);
    }, 2000);
  }
}

testReminder();
