'use strict';
const { createServer } = require('../../server/server.cjs');
const { moduleLoader } = require('../../kernel/module-loader.cjs');
const { providerRegistry } = require('../../registry/provider-registry.cjs');
const request = require('supertest');

async function run() {
  await moduleLoader.loadAll();
  
  providerRegistry.register('test-provider', {
    health: async () => ({ ok: true, provider: 'test', readyModels: [], latencyMs: 1 }),
    listModels: async () => []
  });
  providerRegistry.setActive('test-provider');
  
  const app = createServer();
  
  const res = await request(app).get('/conversation/health');
  if (res.status !== 200 || !res.body.version) {
    console.error('Backward compatibility failed: Health check missing', res.status, res.body);
    process.exit(1);
  }
}
run().catch(e => { console.error(e); process.exit(1); });
