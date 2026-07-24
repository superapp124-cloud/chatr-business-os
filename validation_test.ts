process.env.VITE_SUPABASE_URL = 'http://localhost:54321';
process.env.VITE_SUPABASE_ANON_KEY = 'dummy-key';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-key';

import { IntentService } from './server/src/services/IntentService.js';
import { CapabilityLoader } from './server/src/kernel/CapabilityLoader.js';

async function runValidation() {
  console.log('\n--- BOOTING OS KERNEL ---\n');
  await CapabilityLoader.discoverAndLoad();

  const intents = [
    "Log an urgent hiring decision", // Should hit DecisionTracker
    "Create a new sales lead for Acme Corp", // Should hit Sales
    "Open a new job requirement for a React Developer" // Should hit Recruitment
  ];

  for (const text of intents) {
    console.log(`\n\n--- PROCESSING INTENT: "${text}" ---`);
    try {
      const result = await IntentService.resolveIntent(text, 'test-user', 'test-tenant');
      console.log(`\n✅ SUCCESS: Intent successfully processed.`);
      console.log(`Action Executed: ${result.action}`);
    } catch (err: any) {
      console.error(`\n❌ FAILED: Intent failed to process.`);
      console.error(err.message);
    }
  }

  process.exit(0);
}

runValidation();
