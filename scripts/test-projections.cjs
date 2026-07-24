const { bus } = require('../electron/chatr-core/events/bus.cjs');
const { ledger } = require('../electron/chatr-core/events/ledger.cjs');
const { projectionManager } = require('../electron/chatr-core/kernel/projection-manager.cjs');
const { intentStore } = require('../electron/chatr-core/kernel/intent-store.cjs');

async function runTests() {
  console.log('--- TEST: PROJECTION MANAGER & SNAPSHOTS ---');
  
  // 1. Clear ledger & snapshots
  ledger._clear();
  console.log('Ledger and Snapshots cleared.');

  // 2. Set snapshot threshold low to force a snapshot
  projectionManager.setSnapshotThreshold(3);

  // 3. Create intents to trigger events
  const intent1 = intentStore.create('test.intent', { from: 'A', to: 'B' });
  intentStore.update(intent1.id, 'PLANNING');
  intentStore.update(intent1.id, 'EXECUTING');
  intentStore.update(intent1.id, 'COMPLETED');
  
  console.log(`Created Intent: ${intent1.id}, applied 4 events.`);

  // 4. Force rebuild to trigger snapshot creation
  projectionManager.rebuild(intentStore);

  // 5. Verify Snapshot exists
  const snapshot = ledger.getLatestSnapshot('IntentStore', '*');
  if (!snapshot) {
    throw new Error('Snapshot was not created after rebuilding with threshold met.');
  }
  console.log(`Snapshot created at sequence: ${snapshot.lastGlobalSequence}`);

  // 6. Add one more event AFTER the snapshot
  intentStore.update(intent1.id, 'FAILED', { reason: 'Test after snapshot' });

  // 7. Verify Rebuild logic
  console.log('\\n--- REBUILDING FROM SNAPSHOT ---');
  intentStore.clear(); // Wipe in-memory state
  projectionManager.rebuild(intentStore);
  
  const rebuiltIntent = intentStore.get(intent1.id);
  console.log(`Rebuilt intent status: ${rebuiltIntent.status} (expected FAILED)`);
  if (rebuiltIntent.status !== 'FAILED') {
    throw new Error('Rebuild did not correctly apply events after the snapshot.');
  }

  console.log('\\n✅ All Projection Tests Passed!');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
