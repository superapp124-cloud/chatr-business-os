'use strict';
// Test: Recovery
process.env.CHATR_DATA_DIR = require('os').tmpdir();
process.env.NODE_ENV = 'test';

const persistence = require('../../db/persistence.cjs');
const contextRuntime = require('../../context/runtime.cjs');

async function run() {
  // Corrupt the DB
  const fs = require('fs');
  const path = require('path');
  const dbPath = path.join(persistence.baseDir, 'chatr.db');
  
  if (persistence.db) {
    persistence.db.close();
  }
  
  fs.writeFileSync(dbPath, 'garbage binary string');
  
  // Re-instantiate / reload
  // We need to re-initialize persistence because we closed the DB
  persistence.db = new (require('better-sqlite3'))(dbPath);
  try {
    persistence.db.pragma('journal_mode = WAL');
    persistence._initializeSchema();
  } catch(e) {
    // Expected to fail, persistence handles it in retrieve/store
  }
  
  contextRuntime.loadFromDisk();
  
  // Verify it didn't crash and has empty state
  if (contextRuntime.activeContext.size !== 0) {
    console.error('Context not empty after corruption recovery. Size:', contextRuntime.activeContext.size);
    console.error('Context entries:', Array.from(contextRuntime.activeContext.entries()));
    process.exit(1);
  }
  
  console.log('Recovery test passed successfully.');
  process.exit(0);
}
run().catch((e) => {
  console.error('Test failed with exception:', e);
  process.exit(1);
});
