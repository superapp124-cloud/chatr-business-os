'use strict';

/**
 * P1.4 Universal Transaction Platform Certification Suite
 *
 * Validates:
 *  1.  chatr.transaction.v0_9_rc ABI compliance
 *  2.  Transaction state machine — all legal transitions
 *  3.  Illegal transition rejection
 *  4.  Idempotency — duplicate pay rejected, same transaction returned
 *  5.  Audit log is immutable and append-only
 *  6.  Payment Engine separation — no raw credentials in result
 *  7.  COD / zero-payment instant confirmation
 *  8.  Retryable payment recovery path
 *  9.  Post-payment verification fires separately
 *  10. Transaction build latency < 20ms
 *  11. Multi-vertical: hotel reservation uses same Transaction Engine
 *  12. Tracker emits bus events for state progressions
 */

const { TransactionEngine, TRANSACTION_STATUS } = require('../chatr-core/kernel/transaction-engine.cjs');
const { PaymentEngine, PAYMENT_METHOD }          = require('../chatr-core/kernel/payment-engine.cjs');
const { TransactionVerificationEngine }          = require('../chatr-core/kernel/transaction-verification-engine.cjs');
const { TransactionTracker }                     = require('../chatr-core/kernel/transaction-tracker.cjs');
const { TransactionAuditLog }                    = require('../chatr-core/kernel/transaction-audit-log.cjs');

class MockBus {
  constructor() { this.events = []; }
  publish(event, data) { this.events.push({ event, data }); }
  hasEvent(name) { return this.events.some(e => e.event === name); }
}

async function runCertification() {
  console.log('Starting P1.4 Universal Transaction Platform Certification...\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition, msg) => {
    if (condition) { console.log(`✅ [PASS] ${msg}`); passed++; }
    else { console.error(`❌ [FAIL] ${msg}`); failed++; }
  };

  const bus = new MockBus();
  const txEngine  = new TransactionEngine({ bus });
  const payEngine = new PaymentEngine({ bus });
  const verifier  = new TransactionVerificationEngine({ bus });
  const tracker   = new TransactionTracker({ bus });

  // ─── Test 1: ABI compliance ────────────────────────────────────────────
  const createStart = Date.now();
  const tx = txEngine.create({
    goalId: 'goal_test_001',
    provider: 'zomato',
    amount: 289,
    currency: 'INR',
    entityType: 'restaurant_order',
    paymentRequired: true,
  });
  const createMs = Date.now() - createStart;

  assert(tx.abi === 'chatr.transaction.v0_9_rc', 'ABI field is correct');
  assert(!!tx.transaction_id, 'transaction_id is generated');
  assert(tx.status === TRANSACTION_STATUS.PENDING, 'Initial status is PENDING');
  assert(!('idempotency_key' in tx) || tx.idempotency_key === undefined || typeof tx.idempotency_key === 'undefined', '... (idempotency key checked internally)');
  // createMs check
  assert(createMs < 20, `Transaction creation latency was ${createMs}ms < 20ms`);

  // ─── Test 2: Legal state transitions ──────────────────────────────────
  txEngine.transition(tx.transaction_id, TRANSACTION_STATUS.PAYMENT_PENDING);
  const afterPending = txEngine.get(tx.transaction_id);
  assert(afterPending.status === TRANSACTION_STATUS.PAYMENT_PENDING, 'PENDING → PAYMENT_PENDING legal transition succeeds');

  txEngine.transition(tx.transaction_id, TRANSACTION_STATUS.PAYMENT_CONFIRMED);
  txEngine.transition(tx.transaction_id, TRANSACTION_STATUS.VERIFIED);
  txEngine.transition(tx.transaction_id, TRANSACTION_STATUS.TRACKING);
  const afterTracking = txEngine.get(tx.transaction_id);
  assert(afterTracking.status === TRANSACTION_STATUS.TRACKING, 'Full happy path transitions succeed: PENDING → TRACKING');

  // ─── Test 3: Illegal transition rejected ──────────────────────────────
  let threw = false;
  try {
    txEngine.transition(tx.transaction_id, TRANSACTION_STATUS.PENDING); // Can't go back
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Illegal state transition (TRACKING → PENDING) correctly rejected');

  // ─── Test 4: Idempotency ───────────────────────────────────────────────
  const tx2 = txEngine.create({
    goalId: 'goal_test_001',
    provider: 'zomato',
    amount: 289,
    idempotencyKey: `goal_test_001_zomato_289`, // Same key
  });
  assert(tx2.transaction_id === tx.transaction_id, 'Duplicate transaction returns existing — idempotency enforced');

  // ─── Test 5: Audit log is append-only ─────────────────────────────────
  const audit = txEngine.auditTrail(tx.transaction_id);
  assert(audit.length >= 4, `Audit log has ${audit.length} immutable entries`);
  const seqs = audit.map(e => e.seq);
  const sorted = [...seqs].sort((a, b) => a - b);
  assert(JSON.stringify(seqs) === JSON.stringify(sorted), 'Audit log entries are in monotonically increasing sequence order');

  // ─── Test 6: Payment Engine never leaks credentials ────────────────────
  const payResult = await payEngine.dispatch({
    transactionId: 'test_pay_001',
    amount: 289,
    currency: 'INR',
    method: PAYMENT_METHOD.UPI,
    paymentToken: 'upi_token_xyz',
  });
  assert(['CONFIRMED', 'RETRYABLE', 'FAILED'].includes(payResult.outcome), 'PaymentEngine returns a valid outcome');
  assert(!('raw_card' in payResult), 'Raw card data not in payment result');
  assert(!('cvv' in payResult), 'CVV not in payment result');
  assert(!('pan' in payResult), 'PAN not in payment result');

  // ─── Test 7: COD zero-payment instant confirmation ────────────────────
  const codResult = await payEngine.dispatch({
    transactionId: 'test_cod_001',
    amount: 150,
    currency: 'INR',
    method: PAYMENT_METHOD.COD,
  });
  assert(codResult.outcome === 'CONFIRMED', 'COD payment instantly confirmed');
  assert(codResult.latency_ms < 5, `COD confirmation was instant (${codResult.latency_ms}ms)`);

  // ─── Test 8: Retryable path ────────────────────────────────────────────
  const txRetry = txEngine.create({ goalId: 'goal_retry_001', provider: 'swiggy', amount: 249, entityType: 'restaurant_order' });
  txEngine.transition(txRetry.transaction_id, TRANSACTION_STATUS.PAYMENT_PENDING);
  txEngine.transition(txRetry.transaction_id, TRANSACTION_STATUS.PAYMENT_RETRYABLE);
  const retryState = txEngine.get(txRetry.transaction_id);
  assert(retryState.status === TRANSACTION_STATUS.PAYMENT_RETRYABLE, 'PAYMENT_RETRYABLE state set');
  assert(retryState.retry_count === 1, 'retry_count incremented to 1');
  // Can retry back to PAYMENT_PENDING
  txEngine.transition(txRetry.transaction_id, TRANSACTION_STATUS.PAYMENT_PENDING);
  assert(txEngine.get(txRetry.transaction_id).status === TRANSACTION_STATUS.PAYMENT_PENDING, 'RETRYABLE → PAYMENT_PENDING recovery path works');

  // ─── Test 9: Verification fires separately ─────────────────────────────
  const txVerify = txEngine.create({ goalId: 'goal_v_001', provider: 'zomato', amount: 289, entityType: 'restaurant_order' });
  const verResult = await verifier.verify(txVerify, 'pay_ref_123');
  assert(typeof verResult.verified === 'boolean', 'Verification engine returns boolean result');
  assert(bus.hasEvent('kernel.transaction.verification_started'), 'Bus event verification_started was published');
  assert(bus.hasEvent('kernel.transaction.verification_completed'), 'Bus event verification_completed was published');

  // ─── Test 10: Multi-vertical — Hotel reservation uses same engine ──────
  const hotelTx = txEngine.create({
    goalId: 'goal_hotel_001',
    provider: 'makemytrip',
    amount: 15000,
    currency: 'INR',
    entityType: 'hotel_reservation',
    paymentRequired: true,
  });
  assert(hotelTx.entity_type === 'hotel_reservation', 'Hotel reservation uses identical TransactionEngine');
  assert(hotelTx.abi === 'chatr.transaction.v0_9_rc', 'Hotel transaction conforms to same ABI');

  // ─── Test 11: Tracker emits bus events ────────────────────────────────
  const txTrackTest = txEngine.create({ goalId: 'goal_track_001', provider: 'zomato', amount: 289, entityType: 'restaurant_order' });
  tracker.startTracking(txTrackTest.transaction_id, 'ord_zomato_999', 'zomato', 'restaurant_order');
  await new Promise(r => setTimeout(r, 50)); // Let first tick fire
  tracker.stopAll();
  assert(bus.hasEvent('kernel.transaction.tracking_updated'), 'TransactionTracker emits tracking_updated events on bus');

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log(`\nCertification Complete: ${passed} Passed, ${failed} Failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runCertification().catch(err => {
  console.error('Certification threw unhandled error:', err);
  process.exit(1);
});
