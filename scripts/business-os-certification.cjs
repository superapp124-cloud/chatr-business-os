'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const auditPath = path.join(root, 'certifications', 'business-os-capability-audit.json');
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
const dimensionNames = Object.keys(audit.scoring);
const maximumScore = Object.values(audit.scoring).reduce((total, value) => total + value, 0);
const failures = [];

for (const capability of audit.capabilities) {
  const score = dimensionNames.reduce((total, dimension) => {
    const value = capability.scores[dimension];
    const maximum = audit.scoring[dimension];

    if (!Number.isFinite(value) || value < 0 || value > maximum) {
      failures.push(`${capability.id}: ${dimension} must be between 0 and ${maximum}`);
      return total;
    }

    return total + value;
  }, 0);

  if (!audit.gates.includes(capability.gate)) {
    failures.push(`${capability.id}: unknown release gate ${capability.gate}`);
  }

  if (!Array.isArray(capability.evidence) || capability.evidence.length === 0) {
    failures.push(`${capability.id}: at least one evidence path is required`);
  } else {
    for (const evidencePath of capability.evidence) {
      if (!fs.existsSync(path.join(root, evidencePath))) {
        failures.push(`${capability.id}: missing evidence ${evidencePath}`);
      }
    }
  }

  capability.cms = score;
}

if (failures.length > 0) {
  console.error('Business OS certification audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('CHATR Business OS v1.0 Capability Audit');
console.log(`Maximum CMS: ${maximumScore}`);
console.log('');
for (const capability of audit.capabilities) {
  console.log(`${capability.name} (${capability.route}): ${capability.cms}/${maximumScore} — ${capability.gate}`);
}
