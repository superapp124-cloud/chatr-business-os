'use strict';
// Test: Functional (Event Ordering & Context Linkage)
const { execSync } = require('child_process');

try {
  const output = execSync('node electron/chatr-core/tests/capability-harness.cjs').toString();
  if (!output.includes('CONTEXT INHERITED')) {
    console.error('Functional failed: Context not inherited.');
    process.exit(1);
  }
} catch (e) {
  console.error('Functional test failed', e.message);
  process.exit(1);
}

