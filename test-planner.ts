import { eventBus } from './src/core/runtime/EventBus';
import { initializeCapabilities } from './src/core/capabilities/init';
import { CommitmentPlannerImpl } from './src/core/services/CommitmentPlanner';
import { commitmentRuntime } from './src/core/capabilities/CommitmentRuntime';

async function test() {
  initializeCapabilities();

  eventBus.subscribe('chatr:commitment-planned', (e) => console.log('EVENT: chatr:commitment-planned', JSON.stringify(e)));
  eventBus.subscribe('chatr:commitment-suggested', (e) => console.log('EVENT: chatr:commitment-suggested', JSON.stringify(e)));

  const planner = CommitmentPlannerImpl.getInstance();
  await planner.plan({
    id: "test-id",
    action: "Remind me to call Mom tomorrow at 6 PM",
    entities: { title: "Remind me to call Mom tomorrow at 6 PM" },
    confidence: 0.8
  });

  // wait a bit for async events
  await new Promise(r => setTimeout(r, 1000));
}

test().catch(console.error);
