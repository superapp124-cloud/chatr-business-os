(global as any).window = {
  addEventListener: () => {},
  removeEventListener: () => {}
};
(global as any).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

async function main() {
  const { capabilityRegistry } = await import('../src/core/capabilities/CapabilityRegistry');
  const { initializeCapabilities } = await import('../src/core/capabilities/init');
  initializeCapabilities();

  const capabilities = capabilityRegistry.getAll();
  let passed = 0;
  let failed = 0;

  console.log(`Found ${capabilities.length} capabilities registered.`);

  for (const cap of capabilities) {
    console.log(`\nTesting ${cap.manifest.id}...`);
    try {
      if (cap.tests) {
        await cap.tests();
        console.log(`✅ ${cap.manifest.id} tests passed`);
        passed++;
      } else {
        console.log(`⚠️ ${cap.manifest.id} has no tests function`);
        failed++;
      }
    } catch (e: any) {
      console.log(`❌ ${cap.manifest.id} tests failed: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch(console.error);
