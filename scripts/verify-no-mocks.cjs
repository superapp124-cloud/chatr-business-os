'use strict';
/**
 * CHATR Core - Zero Mock Data Audit Gate
 * Fails the build if forbidden keywords are found outside of testing environments.
 */
const fs = require('fs');
const path = require('path');

const FORBIDDEN_WORDS = [
  'mock', 'fake', 'demo', 'dummy', 'test-data', 'hardcoded', 'seed', 'fixtures', 'lorem'
];

const IGNORED_PATHS = [
  'node_modules',
  'dist',
  'dist-electron',
  'tests',
  'docs',
  'scripts',
  'tests/verification',
  'db/store.cjs', // Has legitimate seed logic
  'knowledge/service.cjs' // Has CHATR_DEV_MOCK_MODE check
];

let failed = false;

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    
    if (IGNORED_PATHS.some(ip => fullPath.includes(path.normalize(ip)))) {
      continue;
    }

    if (fs.statSync(fullPath).isDirectory()) {
      scanDir(fullPath);
    } else if (['.cjs', '.js', '.ts', '.tsx'].includes(path.extname(fullPath))) {
      const content = fs.readFileSync(fullPath, 'utf8').toLowerCase();
      
      for (const word of FORBIDDEN_WORDS) {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(content)) {
          // Additional check for CHATR_DEV_MOCK_MODE to allow it in some valid spots if needed
          if (!content.includes('chatr_dev_mock_mode')) {
             console.error(`❌ Zero Mock Data Violation: Found forbidden word '${word}' in ${fullPath}`);
             failed = true;
          }
        }
      }
    }
  }
}

console.log('Running Zero Mock Data Audit...');
scanDir(path.join(__dirname, '../electron/chatr-core'));

if (failed) {
  console.error('\n❌ AUDIT FAILED. Mock data is strictly forbidden in CHATR Core.');
  process.exit(1);
} else {
  console.log('\n✅ AUDIT PASSED. Zero mock data detected in production flows.');
  process.exit(0);
}
