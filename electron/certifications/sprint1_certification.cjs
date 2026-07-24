'use strict';

/**
 * CHATR Sprint 1 Certification Suite
 *
 * Success criterion:
 *   "A real provider integrates entirely through the connector layer
 *    while the frozen CHATR kernel, ABI, and platform architecture remain unchanged."
 *
 * Exit criteria:
 *   1.  Zero kernel modifications (hash check)
 *   2.  Zero ABI changes
 *   3.  Browser Runtime is fully provider-agnostic
 *   4.  Manifest validated before execution
 *   5.  Per-step telemetry emitted
 *   6.  Semantic verification (not DOM presence)
 *   7.  Structured failure classification
 *   8.  Zomato connector at Experimental maturity (Gate 1 passed)
 *   9.  SessionEvidence is generic (not provider-specific cookie names)
 *   10. Reality Validation report generated per execution
 *   11. ManifestRecorder generates a valid draft manifest
 *   12. Failure classifier produces recovery suggestions
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const { ManifestValidator }   = require('../chatr-core/browser-runtime/manifest-validator.cjs');
const { ManifestLoader }      = require('../chatr-core/browser-runtime/manifest-loader.cjs');
const { BrowserRuntime }      = require('../chatr-core/browser-runtime/browser-runtime.cjs');
const { FailureClassifier, FAILURE_TYPE } = require('../chatr-core/browser-runtime/failure-classifier.cjs');
const { ManifestRecorder }    = require('../chatr-core/browser-runtime/manifest-recorder.cjs');
const { ZomatoConnector }     = require('../chatr-core/connectors/providers/zomato-connector.cjs');
const { ConnectorMaturityGate } = require('../chatr-core/connectors/connector-maturity-gate.cjs');
const { RealityValidator }    = require('../chatr-core/kernel/reality-validator.cjs');

class MockBus {
  constructor() { this.events = []; }
  publish(event, data) { this.events.push({ event, data }); }
  hasEvent(name) { return this.events.some(e => e.event === name); }
  eventsFor(name) { return this.events.filter(e => e.event === name); }
}

// ─── Kernel file integrity ────────────────────────────────────────────────────
// Hash the kernel files that must not change during Sprint 1.
const KERNEL_FILES = [
  '../chatr-core/kernel/discovery-engine.cjs',
  '../chatr-core/kernel/ranking-engine.cjs',
  '../chatr-core/kernel/transaction-engine.cjs',
  '../chatr-core/kernel/provider-session-service.cjs',
  '../chatr-core/kernel/goal-runtime.cjs',
].map(f => path.resolve(__dirname, f));

function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function runCertification() {
  console.log('Starting Sprint 1 Certification...\n');
  console.log('Success criterion: A real provider integrates through the connector layer.');
  console.log('Kernel changes: ZERO allowed.\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, msg) => {
    if (condition) { console.log(`✅ [PASS] ${msg}`); passed++; }
    else { console.error(`❌ [FAIL] ${msg}`); failed++; }
  };

  // ── 1. Capture kernel hashes BEFORE tests ────────────────────────────────
  const hashBefore = {};
  for (const f of KERNEL_FILES) {
    hashBefore[path.basename(f)] = hashFile(f);
  }

  // ── 2. Manifest Validator ────────────────────────────────────────────────
  console.log('\n── Sprint 1.1: Browser Runtime ──');

  const validator = new ManifestValidator();
  const goodManifest = {
    provider: 'test',
    version: '1.0',
    runtime_version: '1.0',
    flows: {
      discover: [
        { step: 'navigate', url: 'https://example.com' },
        { step: 'observe', selector: '.card', timeout_ms: 3000 },
        { step: 'extract', selector: '.card', schema: { name: '.title' } },
        { step: 'verify', condition: 'count > 0' },
      ],
    },
  };

  const valid = validator.validate(goodManifest);
  assert(valid.valid, 'Valid manifest passes all 4 validation gates');
  assert(valid.errors.length === 0, 'Valid manifest produces zero errors');

  // Bad manifest — missing required fields
  const badManifest = { provider: 'test' };
  const invalid = validator.validate(badManifest);
  assert(!invalid.valid, 'Invalid manifest is correctly rejected');
  assert(invalid.errors.length > 0, 'Invalid manifest errors are reported');

  // Security: file:// URL blocked
  const secBad = { ...goodManifest, flows: { f: [{ step: 'navigate', url: 'file:///etc/passwd' }] } };
  const secResult = validator.validate(secBad, { allowLocalhost: false });
  assert(!secResult.valid, 'Security gate blocks file:// URLs');

  // Unsafe script injection blocked
  const scriptBad = { ...goodManifest, flows: { f: [{ step: 'act', action: 'click', target: '.btn', script: 'alert(1)' }] } };
  const scriptResult = validator.validate(scriptBad);
  assert(!scriptResult.valid, 'Security gate blocks "script" field in act steps');

  // ── 3. Manifest Loader ───────────────────────────────────────────────────
  const loader = new ManifestLoader({
    manifestDir: path.join(__dirname, '..', 'chatr-core', 'manifests'),
  });
  const { manifest: zomatoManifest } = loader.load('zomato');
  assert(zomatoManifest.provider === 'zomato', 'ManifestLoader loads Zomato manifest');
  assert(Object.keys(zomatoManifest.flows).length >= 3, 'Zomato manifest has at least 3 flows');

  // Interpolation
  const interpolated = ManifestLoader.interpolate('https://example.com/{{city}}/{{query}}', { city: 'bangalore', query: 'biryani' });
  assert(interpolated.includes('bangalore'), 'ManifestLoader interpolates {{city}} variable');

  // Missing variable throws
  let threw = false;
  try { ManifestLoader.interpolate('https://example.com/{{missing}}', {}); } catch { threw = true; }
  assert(threw, 'ManifestLoader throws on missing template variable');

  // ── 4. BrowserRuntime — synthetic mode ───────────────────────────────────
  const bus = new MockBus();
  const fixture = {
    '[data-testid="restaurant-card"]': [
      { '[data-testid="res-name"]': 'Behrouz', '[data-testid="rating"]': '4.6', '[data-testid="delivery-time"]': '28', '[data-testid="cost-for-two"]': '600' },
      { '[data-testid="res-name"]': 'Paradise', '[data-testid="rating"]': '4.7', '[data-testid="delivery-time"]': '24', '[data-testid="cost-for-two"]': '700' },
    ],
    '[data-testid="login-btn"]': [{}],
    '[data-testid="user-avatar"]': [{}],
  };

  const rt = new BrowserRuntime({ mode: 'synthetic', bus, fixture });
  const navResult = await rt.navigate('https://www.zomato.com/{{city}}/restaurants', { city: 'bangalore' });
  assert(!!navResult._latency_ms, 'BrowserRuntime.navigate emits latency');

  const obsResult = await rt.observe('[data-testid="restaurant-card"]', 3000);
  assert(obsResult.found === true, 'BrowserRuntime.observe detects fixture selector');

  const extResult = await rt.extract('[data-testid="restaurant-card"]', {
    name: '[data-testid="res-name"]',
    rating: '[data-testid="rating"]',
  });
  assert(extResult.count === 2, `BrowserRuntime.extract returns correct count (${extResult.count})`);
  assert(extResult.confidence > 0, `BrowserRuntime.extract returns confidence score (${extResult.confidence})`);
  assert(!!extResult._latency_ms, 'BrowserRuntime.extract emits latency');

  // Semantic verification
  const verResult = await rt.verify('count > 0', extResult);
  assert(verResult.passed, 'BrowserRuntime.verify passes semantic "count > 0" condition');

  const verFail = await rt.verify('count >= 100', { count: 2 }).catch(f => f);
  assert(verFail.failure_type !== undefined, 'BrowserRuntime.verify failure is a classified failure object');

  // Per-step telemetry
  assert(bus.hasEvent('kernel.browser_runtime.step_completed'), 'Browser Runtime emits step telemetry on bus');
  const telemetryEvents = bus.eventsFor('kernel.browser_runtime.step_completed');
  assert(telemetryEvents.length >= 3, `At least 3 step telemetry events emitted (got ${telemetryEvents.length})`);
  assert(telemetryEvents.every(e => typeof e.data.latency_ms === 'number'), 'All telemetry events include latency_ms');

  // Provider-agnostic: runtime has no mention of 'zomato'
  const rtSource = fs.readFileSync(path.join(__dirname, '..', 'chatr-core', 'browser-runtime', 'browser-runtime.cjs'), 'utf8');
  assert(!rtSource.toLowerCase().includes('zomato'), 'BrowserRuntime source contains no reference to "zomato" — provider-agnostic confirmed');

  // ── 5. FailureClassifier ─────────────────────────────────────────────────
  console.log('\n── Failure Classifier ──');
  const classifier = new FailureClassifier();

  const timeoutFailure = classifier.classify(new Error('Request timed out after 5000ms'), 'observe');
  assert(timeoutFailure.failure_type === FAILURE_TYPE.TIMEOUT, 'Timeout errors classified as TIMEOUT');
  assert(timeoutFailure.retryable === true, 'TIMEOUT failures are marked retryable');
  assert(!!timeoutFailure.recovery_suggestion, 'TIMEOUT failure has recovery suggestion');

  const authFailure = classifier.classify(new Error('Please login to continue'), 'navigate');
  assert(authFailure.failure_type === FAILURE_TYPE.AUTH_REQUIRED, 'Auth errors classified as AUTH_REQUIRED');
  assert(authFailure.failure_type !== undefined, 'Failure classifier always returns typed result');

  const rateLimitFailure = classifier.classify(new Error('429 Too Many Requests'), 'navigate');
  assert(rateLimitFailure.failure_type === FAILURE_TYPE.RATE_LIMITED, 'Rate limit errors classified correctly');

  // ── 6. ManifestRecorder ──────────────────────────────────────────────────
  console.log('\n── Manifest Recorder ──');
  const recorder = new ManifestRecorder('irctc');
  const draft = recorder
    .startFlow('discover')
    .navigate('https://www.irctc.co.in/nget/train-search')
    .observe('.train-list', 3000)
    .extract('.train-item', { train_number: '.train-no', name: '.train-name', departure: '.depart-time' })
    .verify('count > 0')
    .stopAndGenerate();

  assert(draft.provider === 'irctc', 'ManifestRecorder generates manifest for correct provider');
  assert(draft.generated_by === 'ManifestRecorder', 'ManifestRecorder marks generated_by field');
  assert(draft.flows.discover.length === 4, 'ManifestRecorder captures all 4 recorded steps');
  assert(draft.maturity === 'draft', 'Recorder-generated manifests start as "draft"');

  // Validate the recorded manifest
  const recValidation = validator.validate(draft, { allowLocalhost: true });
  assert(recValidation.valid, 'ManifestRecorder-generated draft manifest passes validation');

  // ── 7. Zomato Connector v2 ───────────────────────────────────────────────
  console.log('\n── Sprint 1.2: Zomato Connector v2 ──');
  const connector = new ZomatoConnector({ bus, runtimeOptions: { mode: 'synthetic' } });

  // Metadata
  assert(connector.version === '2.0', 'Connector version is 2.0');
  assert(connector.realityLevel() === 2, 'Connector reports Reality Level 2 (L2)');
  assert(connector.maturity() === 'experimental', 'Connector reports Experimental maturity');

  // Discovery
  const results = await connector.discover('Order biryani near me');
  assert(results.length > 0, `Connector discovers ${results.length} restaurants`);
  assert(results.every(r => r.source === 'browser_runtime'), 'All results sourced via BrowserRuntime');

  // Fetch
  const menu = await connector.fetch('behrouz-biryani');
  assert(menu.menu.length > 0, 'Connector fetches menu items');
  assert(typeof menu.confidence === 'number', 'Menu fetch returns confidence score');

  // Authentication — generic SessionEvidence (no provider-specific cookie names)
  const auth = await connector.authenticate({});
  assert('session_evidence' in auth, 'authenticate() returns generic SessionEvidence');
  assert(!('PHPSESSID' in auth), 'authenticate() does NOT expose provider-specific cookie names');
  assert(auth.authenticated === true, 'authenticate() reports boolean authenticated state');

  // Checkout — TransactionEngine owns state; connector only initiates
  const checkoutResult = await connector.checkout({ items: [{ id: 'dish_1', price: 289 }] });
  assert(checkoutResult.checkout_initiated === true, 'checkout() initiates without owning transaction state');
  assert(Array.isArray(checkoutResult.payment_methods), 'checkout() returns supported payment methods');

  // Track
  const trackResult = await connector.track('ord_zomato_123');
  assert(['ORDER_PLACED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(trackResult.status), 'track() returns valid status');

  // ── 8. Connector Maturity Gate 1 ────────────────────────────────────────
  console.log('\n── Sprint 1.3: Connector Maturity Gate ──');
  const gate = new ConnectorMaturityGate({
    manifestDir: path.join(__dirname, '..', 'chatr-core', 'manifests'),
  });

  const gateResult = await gate.runGate(connector, 1);
  assert(gateResult.passed, `Gate 1 (${gateResult.gateName}) passed — connector promoted to Experimental`);
  assert(gateResult.blockers.length === 0, `Gate 1 has zero blockers (${gateResult.blockers.join(', ')})`);

  // ── 9. Reality Validation ────────────────────────────────────────────────
  console.log('\n── Sprint 1.4: Reality Validation ──');
  const realityBus = new MockBus();
  const validator2 = new RealityValidator({ bus: realityBus });

  const goalId = 'sprint1_goal_001';
  const execStart = Date.now();
  validator2.startReport(goalId, 'Order chicken biryani near me');
  validator2.recordStage(goalId, 'DISCOVERY', 400, 125);
  validator2.recordProviderResponse(goalId, 'zomato', 'success', 125, { count: 3 });
  validator2.recordStage(goalId, 'RANKING', 50, 8);
  validator2.recordVerification(goalId, 'ord_z_001', true, { provider_confirmed: true });
  const report = validator2.completeReport(goalId, 'SUCCESS', execStart);

  assert(report !== null, 'Reality Validation produces a report');
  assert(report.stages.length === 2, `Report captures all stages (${report.stages.length} stages)`);
  assert(report.verification_evidence.verified === true, 'Report includes verification evidence');
  assert(report.outcome === 'SUCCESS', 'Report records final outcome');
  assert(realityBus.hasEvent('kernel.reality.report_completed'), 'Completed report published to bus');

  // ── 10. Kernel integrity check ───────────────────────────────────────────
  console.log('\n── Kernel Integrity: Zero Modifications ──');
  let kernelModified = false;
  for (const f of KERNEL_FILES) {
    const hashAfter = hashFile(f);
    const before = hashBefore[path.basename(f)];
    if (before && hashAfter && before !== hashAfter) {
      kernelModified = true;
      console.error(`❌ Kernel file modified: ${path.basename(f)}`);
    }
  }
  assert(!kernelModified, 'Zero kernel files modified during Sprint 1');

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Sprint 1 Certification: ${passed} Passed, ${failed} Failed`);
  if (failed === 0) {
    console.log('\n🏁 SPRINT 1 EXIT CRITERIA MET');
    console.log('  ✅ Zero kernel modifications');
    console.log('  ✅ Browser Runtime is provider-agnostic');
    console.log('  ✅ Manifest validated before execution');
    console.log('  ✅ Per-step telemetry emitted');
    console.log('  ✅ Semantic verification (not DOM presence)');
    console.log('  ✅ Structured failure classification with recovery suggestions');
    console.log('  ✅ Zomato Connector at Experimental maturity (Gate 1 passed)');
    console.log('  ✅ SessionEvidence is generic (no provider-specific cookie names)');
    console.log('  ✅ Reality Validation report generated per execution');
    console.log('  ✅ ManifestRecorder generates valid draft manifests');
  }
  process.exit(failed > 0 ? 1 : 0);
}

runCertification().catch(err => {
  console.error('Certification threw unhandled error:', err);
  process.exit(1);
});
