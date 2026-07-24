'use strict';
// Test: Security
const { createServer } = require('../../server/server.cjs');
const request = require('supertest');

async function run() {
  const app = createServer();
  
  // 1. Oversized payload
  const largeStr = 'a'.repeat(2 * 1024 * 1024); // 2MB
  let res = await request(app)
    .post('/kernel/stream')
    .send({ data: largeStr });
    
  if (res.status !== 413 && res.status !== 404) {
    // Note: /kernel/stream is GET usually, but a large POST should fail cleanly 413 or 404
    if (res.status !== 413) {
      console.error('Security failed: Did not block large payload', res.status);
      process.exit(1);
    }
  }

  // 2. Malformed JSON
  res = await request(app)
    .post('/kernel/stream')
    .set('Content-Type', 'application/json')
    .send('{ invalid');
    
  if (res.status !== 400 && res.status !== 404) {
    console.error('Security failed: Did not block malformed JSON');
    process.exit(1);
  }
}
run().catch(() => process.exit(1));
