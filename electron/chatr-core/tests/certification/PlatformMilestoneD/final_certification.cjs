'use strict';

/**
 * Platform Milestone D — Final Certification Runner
 * Runs all Milestone D unit certifications and the Integration Prototype.
 */

const { execSync } = require('child_process');
const path = require('path');

const tests = [
  'electron/chatr-core/tests/certification/PlatformMilestoneD_Gate/stress_test.cjs',
  'electron/chatr-core/tests/certification/PlatformMilestoneD/goal_runtime_certification.cjs',
  'electron/chatr-core/tests/certification/PlatformMilestoneD/workflow_generator_certification.cjs',
  'electron/chatr-core/tests/certification/PlatformMilestoneD/scheduler_certification.cjs',
  'electron/chatr-core/tests/certification/PlatformMilestoneD/observer_certification.cjs',
  'electron/chatr-core/tests/certification/PlatformMilestoneD/reconciliation_certification.cjs',
  'electron/chatr-core/tests/certification/PlatformMilestoneD/verification_certification.cjs',
  'experience/biryani_experience_prototype.cjs'
];

console.log('=== Platform Milestone D Certification Review ===\n');

let allPassed = true;

for (const test of tests) {
  console.log(`Running: ${test}`);
  try {
    const cwd = path.resolve(__dirname, '../../../../..');
    const out = execSync(`.\\node_modules\\.bin\\electron.cmd ${test}`, { cwd, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
    console.log(`✅ Passed\n`);
  } catch (err) {
    console.error(`❌ Failed: ${test}`);
    console.error(err.stdout ? err.stdout.toString() : err.message);
    allPassed = false;
  }
}

if (allPassed) {
  console.log('🏆 Platform Milestone D is FULLY CERTIFIED.');
} else {
  console.log('🚨 Platform Milestone D Certification FAILED.');
  process.exit(1);
}
