'use strict';

const { intelligencePlatform } = require('./electron/chatr-core/intelligence/intelligence-platform.cjs');

async function run() {
  try {
    await intelligencePlatform.bootstrap();
    
    console.log('\n--- SIMULATING USER REQUEST ---\n');
    const capabilityGraph = await intelligencePlatform.processRequest('Book me a flight to NYC');
    
    console.log('\n--- FINAL CAPABILITY GRAPH ---');
    console.log(JSON.stringify(capabilityGraph, null, 2));
    
  } catch (err) {
    console.error('Test Failed:', err);
  }
}

run();
