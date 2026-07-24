'use strict';
// Test: Stability (Memory tracking)
const { bus } = require('../../events/bus.cjs');

async function run() {
  const startMem = process.memoryUsage().heapUsed;
  
  for (let i = 0; i < 1000; i++) {
    bus.publish('KERNEL.INPUT.RECEIVED', { text: 'Test' });
  }

  // Force gc if exposed, otherwise just measure
  if (global.gc) global.gc();
  
  const endMem = process.memoryUsage().heapUsed;
  const growth = endMem - startMem;
  
  if (growth > 50 * 1024 * 1024) { // 50MB allowance for 1000 events
    console.error('Stability failed. Memory growth too high:', growth);
    process.exit(1);
  }
}
run().catch(() => process.exit(1));
