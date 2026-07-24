import { config } from 'dotenv';
config();

import { eventBus } from '../core/runtime/EventBus';
import { eventRuntime } from '../core/runtime/EventRuntime';
import { SupabaseEventStore } from '../core/runtime/adapters/SupabaseEventStore';
import { supabase } from '../integrations/supabase/client';

async function run() {
  console.log('--- Stage 1.3: Realtime Validation ---');
  
  // 1. Setup adapter and realtime
  const store = new SupabaseEventStore();
  eventRuntime.setStoreAdapter(store);
  store.enableRealtimeBroadcast();

  let receivedLocally = false;

  // 2. Subscribe locally. Since realtimeActive = true, we should ONLY receive this 
  // after the database commits it and Realtime broadcasts it back.
  eventBus.subscribe('TEST_REALTIME_EVENT', (event) => {
    console.log(`[UI Subscription] Received event: ${event.type}`);
    console.log(`[UI Subscription] Payload:`, event.payload);
    console.log(`[UI Subscription] Source:`, event.source);
    receivedLocally = true;
  });

  console.log('[System] Publishing TEST_REALTIME_EVENT (persist: true)...');
  
  // 3. Publish persistent event. It should go to persistenceBuffer, flush to Supabase, 
  // and NOT be delivered locally yet.
  eventBus.publish('TEST_REALTIME_EVENT', { hello: 'realtime' }, { persist: true });

  console.log('[System] Event published. Waiting for realtime round-trip...');

  // Wait up to 5 seconds for Realtime to bounce it back
  for (let i = 0; i < 50; i++) {
    if (receivedLocally) {
      console.log('✅ Realtime round-trip successful!');
      process.exit(0);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  console.error('❌ Failed: Did not receive realtime event within 5 seconds.');
  process.exit(1);
}

run();
