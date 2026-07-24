const { planner } = require('../electron/chatr-core/kernel/planner.cjs');
const { resolver } = require('../electron/chatr-core/kernel/resolver.cjs');
const { capabilityRegistry } = require('../electron/chatr-core/kernel/capability-registry.cjs');
const { providerRegistry } = require('../electron/chatr-core/kernel/provider-registry.cjs');

async function runTests() {
  console.log('--- TEST: INTELLIGENCE LAYER (PHASE 3) ---');
  
  // 1. Verify Registries
  const bookRideCap = capabilityRegistry.getContract('Transport.BookRide');
  if (!bookRideCap) throw new Error('Capability Transport.BookRide not found in registry');
  console.log('✅ Capability Registry: Loaded standard taxonomy.');
  
  const providers = providerRegistry.findProvidersFor('Transport.BookRide');
  if (providers.length < 2) throw new Error('Expected at least 2 mock providers for BookRide');
  console.log(`✅ Provider Registry: Found ${providers.length} providers for Transport.BookRide.`);

  // 2. Planning Engine (Intent -> Abstract Graph)
  const mockIntent = {
    id: 'intent_123',
    raw_text: 'Book a ride to the airport',
    constraints: { from: 'Home', to: 'Airport', type: 'budget' }
  };
  
  console.log(`\\nProcessing Intent: "${mockIntent.raw_text}"`);
  
  const abstractGraph = planner.plan(mockIntent);
  if (abstractGraph.nodes.length !== 2) throw new Error('Planner failed to output the expected 2-node Abstract Graph');
  
  console.log('✅ Planner: Generated Abstract Graph');
  abstractGraph.nodes.forEach(n => console.log(`   - [Abstract Node] Capability: ${n.capability}`));
  
  // Verify planner stripped provider logic
  if (abstractGraph.nodes.some(n => n.providerId || n.providerName)) {
    throw new Error('Planner output contained provider bindings! (Should be purely abstract)');
  }

  // 3. Dynamic Resolver (Abstract Graph -> Concrete Graph)
  const concreteGraph = resolver.resolve(abstractGraph);
  
  console.log('\\n✅ Resolver: Generated Concrete Graph');
  concreteGraph.nodes.forEach(n => console.log(`   - [Concrete Node] Capability: ${n.capability} -> Bound Provider: ${n.providerName} (${n.providerId})`));

  // Verify resolution logic (Uber has highest trust (0.9), so it should win in default tie-breaker)
  const bookedNode = concreteGraph.nodes.find(n => n.capability === 'Transport.BookRide');
  if (bookedNode.providerId !== 'provider.uber.mock') {
    throw new Error(`Resolver picked wrong provider: ${bookedNode.providerId}. Expected provider.uber.mock based on default Trust metric optimization.`);
  }

  console.log('\\n✅ All Intelligence Layer Tests Passed!');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
