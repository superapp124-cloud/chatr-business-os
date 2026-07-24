'use strict';
// Test: Performance
const { bus } = require('../../events/bus.cjs');
const { senseModule } = require('../../modules/sense/service.cjs');

async function run() {
  const start = process.hrtime.bigint();
  
  const p = new Promise(resolve => {
    bus.subscribe('KERNEL.UNDERSTANDING.CREATED', () => resolve());
  });
  
  await senseModule.observe({ messageText: "Let's meet John tomorrow", conversationId: "perf-id", requestId: 'req-1' });
  await p;
  
  const end = process.hrtime.bigint();
  
  const ms = Number(end - start) / 1e6;
  if (ms > 50) {
    console.error('Performance SLA failed. Resolvers took:', ms, 'ms');
    process.exit(1);
  }
}
run().catch(() => process.exit(1));
