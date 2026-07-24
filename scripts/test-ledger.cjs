const { bus } = require('../electron/chatr-core/events/bus.cjs');
const { ledger } = require('../electron/chatr-core/events/ledger.cjs');
const { getTransactionEngine } = require('../electron/chatr-core/kernel/transaction-engine.cjs');
const fs = require('fs');

async function runTests() {
  console.log('--- TEST: EVENT LEDGER & TRANSACTION REPLAY ---');
  
  // 1. Clear ledger for a clean test
  ledger._clear();
  console.log('Ledger cleared.');

  // 2. Initialize engine
  const engine1 = getTransactionEngine();
  console.log('Engine 1 initialized.');

  // 3. Create a transaction (this publishes to bus, appends to ledger, and updates projection)
  const tx1 = engine1.create({
    goalId: 'test_goal_1',
    provider: 'test_provider',
    amount: 100,
    entityType: 'test_order'
  });
  console.log('Created Transaction:', tx1.transaction_id);

  // 4. Transition status
  engine1.transition(tx1.transaction_id, 'PAYMENT_PENDING');
  engine1.transition(tx1.transaction_id, 'PAYMENT_CONFIRMED');
  console.log('Transitioned to PAYMENT_CONFIRMED.');

  // 5. Verify Ledger Size
  const events = ledger.readAll();
  console.log(`Events in ledger: ${events.length}`);
  if (events.length !== 3) { // 1 create, 2 state_changed
    throw new Error('Ledger did not persist exactly 3 events.');
  }

  // 6. Simulate Process Restart by creating a new isolated engine instance
  console.log('\\n--- SIMULATING PROCESS RESTART ---');
  const { TransactionEngine } = require('../electron/chatr-core/kernel/transaction-engine.cjs');
  const engine2 = new TransactionEngine({ bus });
  engine2.rebuildFromLedger(); // This would happen on boot
  console.log('Engine 2 initialized and rebuilt from ledger.');

  // 7. Verify Projection Rebuilt
  const rebuiltTx = engine2.get(tx1.transaction_id);
  console.log('Rebuilt Transaction Status:', rebuiltTx.status);

  if (rebuiltTx.status !== 'PAYMENT_CONFIRMED') {
    throw new Error('Transaction state did not survive replay.');
  }

  console.log('\\n✅ All Ledger Tests Passed!');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
