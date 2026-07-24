'use strict';

/**
 * P1.2 Universal Discovery Engine Certification Suite
 * Validates the core Resolution Layer architecture.
 */

const { ConnectorRegistry } = require('../chatr-core/connectors/connector-registry.cjs');
const { ZomatoConnector } = require('../chatr-core/connectors/providers/zomato-connector.cjs');
const { SwiggyConnector } = require('../chatr-core/connectors/providers/swiggy-connector.cjs');
const { MakeMyTripConnector } = require('../chatr-core/connectors/providers/makemytrip-connector.cjs');
const { DiscoveryEngine } = require('../chatr-core/kernel/discovery-engine.cjs');
const { RankingEngine } = require('../chatr-core/kernel/ranking-engine.cjs');
const { ExecutionCache } = require('../chatr-core/kernel/execution-cache.cjs');

// Mock Bus
class MockBus {
  publish(event, data) {
    // console.log(`[Bus] ${event}`);
  }
}

async function runCertification() {
  console.log('Starting P1.2 Universal Discovery Certification...\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, msg) => {
    if (condition) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
      failed++;
    }
  };

  const registry = new ConnectorRegistry();
  registry.register(new ZomatoConnector());
  registry.register(new SwiggyConnector());
  registry.register(new MakeMyTripConnector());

  const cache = new ExecutionCache();
  const bus = new MockBus();
  const discoveryEngine = new DiscoveryEngine(bus, cache, registry);
  const rankingEngine = new RankingEngine();

  // Test 1: Multi-Provider Food Discovery
  const foodResults = await discoveryEngine.discover('Order biryani', 'user_123');
  assert(foodResults.length >= 3, 'Discovered results from multiple food providers');
  assert(foodResults.every(r => r.abi === 'chatr.discovery_result.v0_9_rc'), 'All results match Normalized ABI');
  
  // Test 2: Ranking Engine Explanations & Sorting
  const rankedFood = rankingEngine.rank(foodResults, 3);
  assert(rankedFood.length > 0, 'Ranking Engine successfully ranked options');
  assert(rankedFood[0].score >= rankedFood[1].score, 'Results are sorted by score descending');
  assert(rankedFood[0].reasons.length > 0, 'Top result includes human-readable reasons (Decision Panel)');

  // Test 3: Multi-Vertical Hotel Discovery
  const hotelResults = await discoveryEngine.discover('Book hotel in Goa', 'user_123');
  assert(hotelResults.length > 0, 'Discovered results from Hotel vertical using identical engine');
  assert(hotelResults[0].entity_type === 'hotel', 'Entity type properly normalized as hotel');

  // Test 4: Warm Cache Latency
  const startWarm = Date.now();
  const warmResults = await discoveryEngine.discover('Order biryani', 'user_123');
  const latencyWarm = Date.now() - startWarm;
  assert(latencyWarm < 20, `Warm cache lookup was extremely fast (${latencyWarm}ms < 20ms)`);
  assert(warmResults.length === foodResults.length, 'Warm cache returned identical result count');

  // Test 5: Capability TTL expiry (DISCOVER -> 30s)
  // We'll simulate expiry by artificially expiring the cache entry
  cache.ttls['DISCOVER'] = -1; // Force immediate expiry
  cache.set('DISCOVER', 'food_user_123', foodResults);
  const expiredResult = cache.get('DISCOVER', 'food_user_123');
  assert(expiredResult === null, 'Cache correctly enforces Capability-specific TTL expiry');

  console.log(`\nCertification Complete: ${passed} Passed, ${failed} Failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runCertification().catch(err => {
  console.error('Certification threw unhandled error:', err);
  process.exit(1);
});
