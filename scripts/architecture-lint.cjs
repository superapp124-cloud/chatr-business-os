const { existsSync, readFileSync, readdirSync, statSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const baselinePath = path.join(__dirname, 'architecture-lint-baseline.json');
const updateBaseline = process.argv.includes('--update-baseline');

const targetPaths = [
  'electron/chatr-core',
  'src/core',
  'tools/provider-onboarding',
  'scripts/create-capability.cjs',
  'scripts/scaffold-core-15.cjs',
  'scripts/workflow-cli.cjs',
];

const ignoredDirectories = new Set([
  '.git',
  '.idea',
  '.vscode',
  'node_modules',
  'dist',
  'dist-desktop',
  'dist-electron',
  'build',
  'coverage',
  'test-results',
]);

const allowedExtensions = new Set([
  '.cjs',
  '.js',
  '.json',
  '.jsx',
  '.mjs',
  '.ts',
  '.tsx',
]);

const industryTerms = [
  'banking',
  'commerce',
  'finance',
  'flight',
  'food',
  'government',
  'healthcare',
  'hotel',
  'jobs',
  'logistics',
  'shopping',
  'ticketing',
  'transport',
  'travel',
];

const titleIndustryTerms = industryTerms.map((term) => (
  term
    .split(/[_-]/)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('')
));

const industryAlternation = industryTerms
  .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');
const titleIndustryAlternation = titleIndustryTerms.join('|');

const capabilityIdPattern = new RegExp(
  String.raw`['"\`](?:(?:${industryAlternation})\.[a-z0-9_-]+|core\.(?:flight_booking|hotel_booking))['"\`]`,
  'i',
);
const runtimeNamePattern = new RegExp(
  String.raw`\b(?:${titleIndustryAlternation})Runtime\b|\b(?:${industryAlternation})[-_]?runtime\b`,
  'i',
);
const industryBranchPattern = new RegExp(
  String.raw`\b(?:if|else\s+if)\s*\([^)]*\b(?:domain|category|vertical|industry|capability|intent|type)\b[^)]*(?:===|==|!==|!=)[^)]*['"\`](?:${industryAlternation}|core\.(?:flight_booking|hotel_booking))['"\`]`,
  'i',
);
const industryCasePattern = new RegExp(
  String.raw`\bcase\s+['"\`](?:${industryAlternation}|core\.(?:flight_booking|hotel_booking))['"\`]`,
  'i',
);
const providerRoutePattern = new RegExp(
  String.raw`\b(?:provider|connector|runtime)[A-Za-z0-9_$]*(?:Map|Route|Routes|Registry|ByDomain|ByCategory)\b.*\b(?:${industryAlternation})\b|\b(?:${industryAlternation})\b\s*:\s*(?:new\s+)?[A-Za-z0-9_$]+`,
  'i',
);
const industryWidgetPattern = new RegExp(
  String.raw`\b(?:${titleIndustryAlternation})(?:Widget|Card|Panel|View|Renderer)\b|\b(?:Widget|Card|Panel|View|Renderer).*(?:${industryAlternation})\b`,
  'i',
);
const hardcodedProviderRoutePattern = /\b(?:providerId|provider_id|connectorId|connector_id)\s*(?:===|==|:)\s*['"`][a-z0-9_.-]+['"`]/i;
const eventEmitterLinePattern = /\b(?:bus\.)?publish\s*\(|\b[A-Z0-9_]+\s*:\s*['"`][a-z0-9_.:-]+['"`]/i;
const domainEventNamePattern = new RegExp(
  String.raw`['"\`](?:${industryAlternation})(?:[.:][a-z][a-z0-9_-]*)+['"\`]`,
  'i',
);

const rules = [
  {
    id: 'industry-runtime-name',
    description: 'Runtime concepts must not be named for industries.',
    test: ({ line, relativePath }) => runtimeNamePattern.test(line) || runtimeNamePattern.test(relativePath),
  },
  {
    id: 'domain-capability-id',
    description: 'Capability IDs must be universal primitives, not industry-prefixed IDs.',
    test: ({ line }) => capabilityIdPattern.test(line),
  },
  {
    id: 'industry-branch',
    description: 'Kernel/runtime code must not branch on industries or domain capability IDs.',
    test: ({ line }) => industryBranchPattern.test(line) || industryCasePattern.test(line),
  },
  {
    id: 'static-provider-route',
    description: 'Provider routing must flow through Capability -> Strategy -> Provider -> Execution.',
    test: ({ line }) => providerRoutePattern.test(line),
  },
  {
    id: 'industry-ui-widget',
    description: 'UI runtime must be schema-driven, not industry-widget driven.',
    test: ({ line, relativePath }) => industryWidgetPattern.test(line) || industryWidgetPattern.test(relativePath),
  },
  {
    id: 'domain-scaffold-generator',
    description: 'Scaffolding must not create new domain runtimes or core.<domain> capabilities.',
    test: ({ line, relativePath }) => (
      /scripts\/(?:create-capability|scaffold-core-15|workflow-cli)\.cjs$/.test(relativePath)
      && (
        /core\.\$\{?domain\}?|capabilities.*\$\{?domain\}?|create <domain>|Capability domain/i.test(line)
        || capabilityIdPattern.test(line)
      )
    ),
  },
  {
    id: 'hardcoded-provider-route',
    description: 'Kernel routing must not hardcode provider or connector IDs.',
    test: ({ line, relativePath }) => (
      /^(electron\/chatr-core\/(?:kernel|execution|providers|runtimes|registry)|src\/core\/(?:providers|runtime|services|sdk))\//.test(relativePath)
      && hardcodedProviderRoutePattern.test(line)
    ),
  },
  {
    id: 'domain-event-name',
    description: 'Event names must use generic kernel namespaces, never industry namespaces.',
    test: ({ line }) => eventEmitterLinePattern.test(line) && domainEventNamePattern.test(line),
  },
];

const files = collectFiles();
const violations = [];

for (const filePath of files) {
  analyzeFile(filePath, violations);
}

const summary = summarize(violations);

if (updateBaseline || !existsSync(baselinePath)) {
  writeFileSync(
    baselinePath,
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      note: 'Architecture lint baseline. Keep counts flat or decreasing; new or increased drift fails lint.',
      targets: targetPaths,
      totals: summary.totals,
      rules: summary.rules,
      files: summary.files,
    }, null, 2)}\n`,
  );
  printSummary('Architecture lint baseline updated', summary);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const failures = compareToBaseline(summary, baseline);

if (failures.length > 0) {
  printSummary('Architecture lint failed', summary);
  console.error('\nNew architecture drift detected:');
  for (const failure of failures.slice(0, 40)) {
    console.error(`- ${failure}`);
  }
  if (failures.length > 40) {
    console.error(`- ...and ${failures.length - 40} more increases`);
  }
  printSampleViolations(violations);
  console.error('\nFix the drift or intentionally refresh the baseline with npm run lint:architecture:update-baseline.');
  process.exit(1);
}

printSummary('Architecture lint passed', summary);

function collectFiles() {
  const collected = [];

  for (const targetPath of targetPaths) {
    const absoluteTarget = path.join(root, targetPath);
    if (!existsSync(absoluteTarget)) continue;
    collectFromPath(absoluteTarget, collected);
  }

  return collected.sort();
}

function collectFromPath(absolutePath, collected) {
  const stat = statSync(absolutePath);

  if (stat.isDirectory()) {
    const name = path.basename(absolutePath);
    if (ignoredDirectories.has(name)) return;

    for (const entry of readdirSync(absolutePath)) {
      collectFromPath(path.join(absolutePath, entry), collected);
    }
    return;
  }

  if (!stat.isFile()) return;
  if (!allowedExtensions.has(path.extname(absolutePath))) return;
  collected.push(absolutePath);
}

function analyzeFile(filePath, output) {
  const relativePath = toRelativePath(filePath);
  let text;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  if (text.includes('\u0000')) return;

  const lines = text.split(/\r?\n/);
  let disabledNextLineRules = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;
    const inlineDisable = parseDisableComment(line);

    if (inlineDisable?.nextLine) {
      disabledNextLineRules = inlineDisable.rules;
      continue;
    }

    for (const rule of rules) {
      if (isDisabled(rule.id, inlineDisable?.rules) || isDisabled(rule.id, disabledNextLineRules)) {
        continue;
      }

      if (rule.test({ line, relativePath, lineNumber })) {
        output.push({
          rule: rule.id,
          description: rule.description,
          file: relativePath,
          line: lineNumber,
          text: line.trim().slice(0, 180),
        });
      }
    }

    disabledNextLineRules = null;
  }
}

function parseDisableComment(line) {
  const match = line.match(/architecture-lint-disable(?:-next-line)?(?:\s+([a-z0-9_, -]+))?/i);
  if (!match) return null;

  const rulesText = match[1]?.trim();
  return {
    nextLine: /architecture-lint-disable-next-line/i.test(line),
    rules: rulesText ? rulesText.split(/[,\s]+/).filter(Boolean) : ['all'],
  };
}

function isDisabled(ruleId, disabledRules) {
  return Boolean(disabledRules?.includes('all') || disabledRules?.includes(ruleId));
}

function summarize(items) {
  const totals = {
    violations: items.length,
    files: new Set(items.map((item) => item.file)).size,
  };
  const ruleSummary = {};
  const fileSummary = {};

  for (const item of items) {
    ruleSummary[item.rule] ||= { count: 0 };
    ruleSummary[item.rule].count += 1;

    fileSummary[item.file] ||= { count: 0, rules: {} };
    fileSummary[item.file].count += 1;
    fileSummary[item.file].rules[item.rule] ||= 0;
    fileSummary[item.file].rules[item.rule] += 1;
  }

  return {
    totals,
    rules: sortObject(ruleSummary),
    files: sortObject(fileSummary),
  };
}

function compareToBaseline(current, baseline) {
  const failures = [];

  if (current.totals.violations > (baseline.totals?.violations ?? 0)) {
    failures.push(`total violations increased from ${baseline.totals?.violations ?? 0} to ${current.totals.violations}`);
  }

  const ruleNames = new Set([...Object.keys(baseline.rules || {}), ...Object.keys(current.rules || {})]);
  for (const ruleName of [...ruleNames].sort()) {
    const previous = baseline.rules?.[ruleName]?.count ?? 0;
    const next = current.rules?.[ruleName]?.count ?? 0;
    if (next > previous) {
      failures.push(`${ruleName} increased from ${previous} to ${next}`);
    }
  }

  const fileNames = new Set([...Object.keys(baseline.files || {}), ...Object.keys(current.files || {})]);
  for (const fileName of [...fileNames].sort()) {
    const ruleSet = new Set([
      ...Object.keys(baseline.files?.[fileName]?.rules || {}),
      ...Object.keys(current.files?.[fileName]?.rules || {}),
    ]);

    for (const ruleName of [...ruleSet].sort()) {
      const previous = baseline.files?.[fileName]?.rules?.[ruleName] ?? 0;
      const next = current.files?.[fileName]?.rules?.[ruleName] ?? 0;
      if (next > previous) {
        failures.push(`${fileName} ${ruleName} increased from ${previous} to ${next}`);
      }
    }
  }

  return failures;
}

function printSummary(label, summary) {
  console.log(`${label}: ${summary.totals.violations} violations across ${summary.totals.files} files`);
  for (const [ruleName, ruleSummary] of Object.entries(summary.rules)) {
    console.log(`- ${ruleName}: ${ruleSummary.count}`);
  }
}

function printSampleViolations(items) {
  if (items.length === 0) return;

  console.error('\nSample violations:');
  for (const item of items.slice(0, 20)) {
    console.error(`- ${item.file}:${item.line} ${item.rule} ${item.text}`);
  }
}

function sortObject(object) {
  return Object.fromEntries(Object.entries(object).sort(([left], [right]) => left.localeCompare(right)));
}

function toRelativePath(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}
