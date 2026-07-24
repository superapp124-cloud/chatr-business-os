const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const baselinePath = path.join(__dirname, 'lint-baseline.json');
const eslintBin = process.execPath;
const eslintCli = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
const updateBaseline = process.argv.includes('--update-baseline');

const targets = ['src', 'supabase/functions', 'scripts', 'eslint.config.js', 'vite.config.ts', 'tailwind.config.ts'];
const args = [
  eslintCli,
  ...targets,
  '--ext',
  '.ts,.tsx,.js,.cjs',
  '--format',
  'json',
  '--no-error-on-unmatched-pattern',
];

const result = spawnSync(eslintBin, args, {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 1024 * 1024 * 64,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

const output = result.stdout.trim();
let report;
try {
  report = output ? JSON.parse(output) : [];
} catch (error) {
  console.error('ESLint did not return JSON output.');
  if (result.stdout) console.error(result.stdout);
  if (result.stderr) console.error(result.stderr);
  process.exit(1);
}

const summary = summarize(report);

if (updateBaseline || !existsSync(baselinePath)) {
  writeFileSync(
    baselinePath,
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      note: 'Incremental lint baseline. Reduce counts over time; new or increased violations fail npm run lint.',
      targets,
      totals: summary.totals,
      rules: summary.rules,
    }, null, 2)}\n`,
  );
  printSummary('Lint baseline updated', summary);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const failures = [];

for (const severity of ['errors', 'warnings']) {
  if (summary.totals[severity] > (baseline.totals?.[severity] ?? 0)) {
    failures.push(`${severity} increased from ${baseline.totals?.[severity] ?? 0} to ${summary.totals[severity]}`);
  }
}

const ruleNames = new Set([...Object.keys(baseline.rules || {}), ...Object.keys(summary.rules)]);
for (const ruleName of [...ruleNames].sort()) {
  const current = summary.rules[ruleName] || { errors: 0, warnings: 0 };
  const previous = baseline.rules?.[ruleName] || { errors: 0, warnings: 0 };

  if (current.errors > previous.errors) {
    failures.push(`${ruleName} errors increased from ${previous.errors} to ${current.errors}`);
  }
  if (current.warnings > previous.warnings) {
    failures.push(`${ruleName} warnings increased from ${previous.warnings} to ${current.warnings}`);
  }
}

if (failures.length > 0) {
  printSummary('Lint governance failed', summary);
  console.error('\nNew lint debt detected:');
  for (const failure of failures.slice(0, 25)) {
    console.error(`- ${failure}`);
  }
  if (failures.length > 25) {
    console.error(`- ...and ${failures.length - 25} more increases`);
  }
  console.error('\nFix new issues or intentionally refresh the baseline with npm run lint:update-baseline.');
  process.exit(1);
}

printSummary('Lint governance passed', summary);

function summarize(files) {
  const totals = { errors: 0, warnings: 0 };
  const rules = {};

  for (const file of files) {
    for (const message of file.messages || []) {
      const ruleId = message.ruleId || 'parser';
      const bucket = message.severity === 2 ? 'errors' : 'warnings';
      totals[bucket] += 1;
      rules[ruleId] ||= { errors: 0, warnings: 0 };
      rules[ruleId][bucket] += 1;
    }
  }

  return { totals, rules };
}

function printSummary(label, summary) {
  console.log(`${label}: ${summary.totals.errors} errors, ${summary.totals.warnings} warnings`);
}
