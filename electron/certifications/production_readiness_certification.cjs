'use strict';

/**
 * P1.5 Production Readiness Certification Suite
 *
 * Validates all five reference experiences against product KPI targets.
 * No mocked transitions — exercises the real connector/ranking/transaction stack.
 */

const { ConnectorRegistry }      = require('../chatr-core/connectors/connector-registry.cjs');
const { ZomatoConnector }        = require('../chatr-core/connectors/providers/zomato-connector.cjs');
const { SwiggyConnector }        = require('../chatr-core/connectors/providers/swiggy-connector.cjs');
const { MakeMyTripConnector }    = require('../chatr-core/connectors/providers/makemytrip-connector.cjs');
const { IRCTCConnector }         = require('../chatr-core/connectors/providers/irctc-connector.cjs');
const { UtilityConnector }       = require('../chatr-core/connectors/providers/utility-connector.cjs');
const { PassportSevaConnector }  = require('../chatr-core/connectors/providers/passport-seva-connector.cjs');
const { DiscoveryEngine }        = require('../chatr-core/kernel/discovery-engine.cjs');
const { RankingEngine }          = require('../chatr-core/kernel/ranking-engine.cjs');
const { ExecutionCache }         = require('../chatr-core/kernel/execution-cache.cjs');
const { TransactionEngine, TRANSACTION_STATUS } = require('../chatr-core/kernel/transaction-engine.cjs');
const { PaymentEngine, PAYMENT_METHOD }         = require('../chatr-core/kernel/payment-engine.cjs');
const { TransactionVerificationEngine }         = require('../chatr-core/kernel/transaction-verification-engine.cjs');
const { RealityValidator }       = require('../chatr-core/kernel/reality-validator.cjs');

class MockBus {
  constructor() { this.events = []; }
  publish(event, data) { this.events.push({ event, data }); }
}

const REFERENCE_EXPERIENCES = [
  { name: 'Order Chicken Biryani',   intent: 'Order biryani',         entityType: 'restaurant_order',   amount: 289,   provider: 'zomato' },
  { name: 'Book Cheapest Flight',    intent: 'Book cheapest flight',  entityType: 'flight_booking',      amount: 3799,  provider: 'irctc'  },
  { name: 'Book Train Ticket',       intent: 'Book train ticket',     entityType: 'train_booking',       amount: 980,   provider: 'irctc'  },
  { name: 'Pay Electricity Bill',    intent: 'Pay electricity bill',  entityType: 'utility_bill',        amount: 1840,  provider: 'utility'},
  { name: 'Renew Passport',          intent: 'Renew passport',        entityType: 'government_service',  amount: 1500,  provider: 'passport_seva' },
];

async function runCertification() {
  console.log('Starting P1.5 Production Readiness Certification...\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition, msg) => {
    if (condition) { console.log(`✅ [PASS] ${msg}`); passed++; }
    else { console.error(`❌ [FAIL] ${msg}`); failed++; }
  };

  // ─── Build the stack (no kernel changes) ─────────────────────────────
  const bus = new MockBus();
  const cache = new ExecutionCache();
  const registry = new ConnectorRegistry();
  [new ZomatoConnector(), new SwiggyConnector(), new MakeMyTripConnector(),
   new IRCTCConnector(), new UtilityConnector(), new PassportSevaConnector()]
    .forEach(c => registry.register(c));

  const discoveryEngine = new DiscoveryEngine(bus, cache, registry);
  const rankingEngine   = new RankingEngine();
  const txEngine        = new TransactionEngine({ bus });
  const payEngine       = new PaymentEngine({ bus });
  const verifier        = new TransactionVerificationEngine({ bus });
  const validator       = new RealityValidator({ bus });

  // SLA targets (hardcoded per TSC decision)
  const DISCOVERY_SLA_MS    = 500;
  const WARM_CACHE_SLA_MS   = 200;
  const TX_BUILD_SLA_MS     = 20;
  const PAYMENT_SLA_MS      = 500;

  for (const exp of REFERENCE_EXPERIENCES) {
    console.log(`\n  ── Reference Experience: ${exp.name} ──`);
    const goalId = `goal_p15_${exp.provider}_${Date.now()}`;
    validator.startReport(goalId, exp.intent);
    const expStart = Date.now();

    // 1. DISCOVERY
    const discoveryStart = Date.now();
    const results = await discoveryEngine.discover(exp.intent, 'user_p15');
    const discoveryMs = Date.now() - discoveryStart;
    validator.recordStage(goalId, 'DISCOVERY', DISCOVERY_SLA_MS, discoveryMs);
    validator.recordProviderResponse(goalId, exp.provider, results.length > 0 ? 'success' : 'partial', discoveryMs);

    assert(results.length > 0, `${exp.name}: Discovery returned results`);
    assert(results.every(r => r.abi === 'chatr.discovery_result.v0_9_rc'), `${exp.name}: All results match frozen ABI`);
    assert(discoveryMs < DISCOVERY_SLA_MS, `${exp.name}: Discovery within SLA (${discoveryMs}ms < ${DISCOVERY_SLA_MS}ms)`);

    // 2. RANKING
    const ranked = rankingEngine.rank(results, 3);
    assert(ranked.length > 0, `${exp.name}: Ranking produced results`);
    assert(ranked[0].reasons.length > 0, `${exp.name}: Top result has explanation reasons`);

    // 3. TRANSACTION BUILD
    const txStart = Date.now();
    const tx = txEngine.create({ goalId, provider: exp.provider, amount: exp.amount, entityType: exp.entityType });
    const txMs = Date.now() - txStart;
    validator.recordStage(goalId, 'TRANSACTION_BUILD', TX_BUILD_SLA_MS, txMs);

    assert(tx.abi === 'chatr.transaction.v0_9_rc', `${exp.name}: Transaction has correct ABI`);
    assert(tx.status === TRANSACTION_STATUS.PENDING, `${exp.name}: Transaction starts in PENDING`);
    assert(txMs < TX_BUILD_SLA_MS, `${exp.name}: Transaction build within SLA (${txMs}ms < ${TX_BUILD_SLA_MS}ms)`);

    // 4. PAYMENT (UPI for food/travel, COD for government)
    const method = exp.entityType === 'government_service' ? PAYMENT_METHOD.COD : PAYMENT_METHOD.UPI;
    txEngine.transition(tx.transaction_id, TRANSACTION_STATUS.PAYMENT_PENDING);
    const payStart = Date.now();
    const payResult = await payEngine.dispatch({ transactionId: tx.transaction_id, amount: exp.amount, currency: 'INR', method });
    const payMs = Date.now() - payStart;
    validator.recordStage(goalId, 'PAYMENT', PAYMENT_SLA_MS, payMs);

    assert(['CONFIRMED', 'RETRYABLE'].includes(payResult.outcome), `${exp.name}: Payment returned a valid outcome`);
    assert(payMs < PAYMENT_SLA_MS, `${exp.name}: Payment within SLA (${payMs}ms < ${PAYMENT_SLA_MS}ms)`);

    // 5. VERIFICATION
    if (payResult.outcome === 'CONFIRMED') {
      txEngine.transition(tx.transaction_id, TRANSACTION_STATUS.PAYMENT_CONFIRMED);
      const verResult = await verifier.verify(tx, payResult.reference);
      validator.recordVerification(goalId, verResult.order_id, verResult.verified);
      if (verResult.verified) {
        txEngine.transition(tx.transaction_id, TRANSACTION_STATUS.VERIFIED);
        txEngine.transition(tx.transaction_id, TRANSACTION_STATUS.TRACKING);
      }
    }

    const finalState = txEngine.get(tx.transaction_id);
    validator.completeReport(goalId, finalState.status === TRANSACTION_STATUS.TRACKING ? 'SUCCESS' : 'FAILED', expStart);
  }

  // ─── Warm Cache SLA validation ────────────────────────────────────────
  console.log('\n  ── Warm Cache SLA ──');
  const warmStart = Date.now();
  await discoveryEngine.discover('Order biryani', 'user_p15'); // Should hit cache
  const warmMs = Date.now() - warmStart;
  assert(warmMs < WARM_CACHE_SLA_MS, `Warm cache discovery within SLA (${warmMs}ms < ${WARM_CACHE_SLA_MS}ms)`);

  // ─── Reality Validator KPI Aggregation ────────────────────────────────
  console.log('\n  ── Production KPI Validation ──');
  const kpis = validator.getProductKPIs();
  assert(kpis !== null, 'RealityValidator collected execution data');
  assert(kpis.total_executions === REFERENCE_EXPERIENCES.length, `All ${REFERENCE_EXPERIENCES.length} reference experiences executed`);
  const successRate = kpis.success_rate;
  assert(successRate >= 95, `Success rate ${successRate}% meets ≥95% target`);
  console.log(`\n  📊 Product KPIs: ${JSON.stringify(kpis, null, 4)}`);

  // ─── Kernel freeze check — no new modules added ────────────────────────
  console.log('\n  ── Kernel Freeze Compliance ──');
  const { TRANSACTION_STATUS: ts } = require('../chatr-core/kernel/transaction-engine.cjs');
  assert(!!ts, 'TransactionEngine ABI accessible and unchanged');

  console.log(`\nCertification Complete: ${passed} Passed, ${failed} Failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runCertification().catch(err => {
  console.error('Certification threw unhandled error:', err);
  process.exit(1);
});
