'use strict';
// Test: Determinism (100 runs)
const { bus } = require('../../events/bus.cjs');
const { senseModule } = require('../../modules/sense/service.cjs');
require('../../modules/meetings/index.cjs');

function sanitize(payload) {
  if (!payload) return null;
  const p = JSON.parse(JSON.stringify(payload));
  if (p.classifications) {
    p.classifications.forEach(c => {
      delete c.id;
      if (c.entities) {
        c.entities.people = c.entities.people.map(p => typeof p === 'object' ? p.name || p : p);
      }
    });
  }
  return p;
}

async function run() {
  const cId = require('crypto').randomUUID();
  let latestPayload = null;
  bus.subscribe('KERNEL.UNDERSTANDING.CREATED', env => { latestPayload = env.payload; });

  await senseModule.observe({ messageText: "Let's meet John tomorrow", conversationId: cId, requestId: 'req-1' });
  await new Promise(r => setTimeout(r, 50));
  const baseline = JSON.stringify(sanitize(latestPayload));
  
  for (let i = 0; i < 100; i++) {
    latestPayload = null;
    await senseModule.observe({ messageText: "Let's meet John tomorrow", conversationId: cId, requestId: 'req-1' });
    await new Promise(r => setTimeout(r, 10)); // wait for async classifications
    
    const currentStr = JSON.stringify(sanitize(latestPayload));
    if (currentStr !== baseline) {
      console.error('Determinism failed on iteration', i);
      console.error('Baseline:', baseline);
      console.error('Current :', currentStr);
      process.exit(1);
    }
  }
}
run().catch(() => process.exit(1));
