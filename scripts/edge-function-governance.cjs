const { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const functionsDir = path.join(root, 'supabase', 'functions');
const baselinePath = path.join(__dirname, 'edge-function-governance-baseline.json');
const reportPath = path.join(root, 'docs', 'security', 'edge-function-governance-report.md');
const updateBaseline = process.argv.includes('--update-baseline');

const functionDirs = readdirSync(functionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => entry.name)
  .sort();

const audited = functionDirs.map(auditFunction);
const summary = summarize(audited);

if (updateBaseline || !existsSync(baselinePath)) {
  const baseline = {
    generatedAt: new Date().toISOString(),
    note: 'Incremental Supabase Edge Function governance baseline. Reduce counts over time; new or increased risk fails edge:functions:audit.',
    totals: summary.totals,
    functions: Object.fromEntries(audited.map((item) => [item.name, item.issueCounts])),
  };

  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  writeReport(audited, summary);
  printSummary('Edge function governance baseline updated', summary);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const failures = [];

for (const key of Object.keys(summary.totals)) {
  const previous = baseline.totals?.[key] ?? 0;
  if (summary.totals[key] > previous) {
    failures.push(`${key} increased from ${previous} to ${summary.totals[key]}`);
  }
}

for (const item of audited) {
  const previous = baseline.functions?.[item.name] || {};
  for (const key of Object.keys(item.issueCounts)) {
    const prior = previous[key] ?? 0;
    if (item.issueCounts[key] > prior) {
      failures.push(`${item.name}:${key} increased from ${prior} to ${item.issueCounts[key]}`);
    }
  }
}

writeReport(audited, summary);

if (failures.length > 0) {
  printSummary('Edge function governance failed', summary);
  console.error('\nNew edge-function governance risk detected:');
  for (const failure of failures.slice(0, 30)) {
    console.error(`- ${failure}`);
  }
  if (failures.length > 30) {
    console.error(`- ...and ${failures.length - 30} more increases`);
  }
  console.error('\nReview docs/security/edge-function-governance-report.md, fix new risk, or intentionally refresh the baseline.');
  process.exit(1);
}

printSummary('Edge function governance passed', summary);

function auditFunction(name) {
  const file = path.join(functionsDir, name, 'index.ts');
  const source = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const classification = classifyFunction(name);
  const usesSharedSecurity = source.includes('../_shared/security.ts') || source.includes('../_core/');
  const usesCoreGovernance = source.includes('../_core/');
  const usesServiceRole = source.includes('SUPABASE_SERVICE_ROLE_KEY');
  const wildcardCors = /Access-Control-Allow-Origin['"]?\s*:\s*['"]\*/.test(source);
  const hasAuth =
    source.includes('requireUser(') ||
    /auth\.getUser\s*\(/.test(source) ||
    /Authorization/.test(source) && /getUser|jwt|verify|api[_-]?key|x-mcp-api-key/i.test(source);
  const hasRateLimit = source.includes('assertRateLimit(') || /rateLimit|rate limit|429/i.test(source);
  const parsesJson = /req\.json\s*\(/.test(source) || source.includes('parseJsonBody(');
  const hasValidation = source.includes('requireString(') ||
    source.includes('requireUuid(') ||
    source.includes('requireEnum(') ||
    /if\s*\([^)]*!\w+/.test(source) ||
    /zod|schema|validate/i.test(source);
  const hasStructuredErrors =
    source.includes('createEdgeFunction(') ||
    source.includes('errorResponse(') ||
    source.includes('PlatformError') ||
    /JSON\.stringify\s*\(\s*\{\s*error/i.test(source);
  const handlesOptions =
    source.includes('createEdgeFunction(') ||
    source.includes('handleCors(') ||
    /method\s*={0,2}=\s*['"]OPTIONS['"]|req\.method\s*===\s*['"]OPTIONS['"]/.test(source);
  const hasAudit = source.includes('auditSecurityEvent(') || /audit|telemetry|log/i.test(source);
  const highValueName = /(ai|pstn|token|push|notification|media|prescription|health|payment|qr|call|webrtc|location|mcp|sms)/i.test(name);

  const issues = [];
  if (!source) issues.push(['missingIndex', 'critical']);
  if (wildcardCors) issues.push(['wildcardCors', 'high']);
  if (usesServiceRole && !hasAuth) issues.push(['serviceRoleWithoutAuth', 'critical']);
  if (highValueName && !hasAuth) issues.push(['highValueWithoutAuth', 'critical']);
  if (parsesJson && !hasValidation) issues.push(['jsonWithoutValidation', 'medium']);
  if (hasAuth && !hasRateLimit && highValueName) issues.push(['highValueWithoutRateLimit', 'medium']);
  if (!handlesOptions) issues.push(['missingOptionsHandler', 'low']);
  if (!hasStructuredErrors) issues.push(['inconsistentErrors', 'low']);
  if (highValueName && !hasAudit) issues.push(['highValueWithoutAudit', 'medium']);
  if (!usesSharedSecurity && (usesServiceRole || highValueName || wildcardCors)) issues.push(['legacySecurityWrapper', 'medium']);

  const issueCounts = {};
  for (const [key] of issues) {
    issueCounts[key] = (issueCounts[key] || 0) + 1;
  }

  return {
    name,
    file,
    classification,
    signals: {
      usesSharedSecurity,
      usesCoreGovernance,
      usesServiceRole,
      wildcardCors,
      hasAuth,
      hasRateLimit,
      hasValidation,
      hasStructuredErrors,
      handlesOptions,
      hasAudit,
      highValueName,
    },
    issues: issues.map(([type, severity]) => ({ type, severity })),
    issueCounts,
  };
}

function summarize(items) {
  const totals = {
    functions: items.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    wildcardCors: 0,
    serviceRoleWithoutAuth: 0,
    highValueWithoutAuth: 0,
    legacySecurityWrapper: 0,
  };

  for (const item of items) {
    for (const issue of item.issues) {
      totals[issue.severity] += 1;
      if (Object.hasOwn(totals, issue.type)) totals[issue.type] += 1;
    }
  }

  return { totals };
}

function writeReport(items, summary) {
  const reportDir = path.dirname(reportPath);
  mkdirSync(reportDir, { recursive: true });

  const rows = items.map((item) => {
    const issueText = item.issues.length
      ? item.issues.map((issue) => `${issue.severity}:${issue.type}`).join(', ')
      : 'none';
    return `| ${item.name} | ${item.classification.join(', ')} | ${yes(item.signals.usesCoreGovernance)} | ${yes(item.signals.usesSharedSecurity)} | ${yes(item.signals.hasAuth)} | ${yes(item.signals.usesServiceRole)} | ${yes(item.signals.wildcardCors)} | ${yes(item.signals.hasRateLimit)} | ${issueText} |`;
  }).join('\n');

  const markdown = `# Supabase Edge Function Governance Report

Generated by \`npm run edge:functions:audit\`.

## Summary

| Metric | Count |
|---|---:|
| Functions audited | ${summary.totals.functions} |
| Critical issues | ${summary.totals.critical} |
| High issues | ${summary.totals.high} |
| Medium issues | ${summary.totals.medium} |
| Low issues | ${summary.totals.low} |
| Wildcard CORS | ${summary.totals.wildcardCors} |
| Service role without auth | ${summary.totals.serviceRoleWithoutAuth} |
| High-value function without auth | ${summary.totals.highValueWithoutAuth} |
| Legacy security wrapper | ${summary.totals.legacySecurityWrapper} |

## Function Inventory

| Function | Classification | Core Governance | Shared Security | Auth | Service Role | Wildcard CORS | Rate Limit | Issues |
|---|---|---:|---:|---:|---:|---:|---:|---|
${rows}
`;

  writeFileSync(reportPath, markdown);
}

function yes(value) {
  return value ? 'yes' : 'no';
}

function classifyFunction(name) {
  const classes = new Set();
  if (/(app-version|search-suggestions)$/i.test(name)) classes.add('PUBLIC_SAFE');
  if (/(auth-phone-otp|firebase-phone-auth|universal-search)$/i.test(name)) classes.add('PUBLIC_SAFE');
  if (/(ai|brain|compose|summary|summarize|translate|transcription|perplexity|visual-search|sticker|feature)/i.test(name)) classes.add('AI_COST_SENSITIVE');
  if (/(payment|qr|coin|reward|wallet|referral|subscription|payout)/i.test(name)) classes.add('PAYMENT_SENSITIVE');
  if (/(health|healthcare|prescription|symptom|nutrition|medication|mental|bmi)/i.test(name)) classes.add('HEALTHCARE_SENSITIVE');
  if (/(cleanup|backfill|notifier|digest|scheduled|daily|streak|crawl|scrape)/i.test(name)) classes.add('CRON_ONLY');
  if (/(mcp|webhook|trigger|notify|send-|process-|verify-|moderation|lookup|token|turn|pstn|webrtc|websocket|location)/i.test(name)) classes.add('SERVICE_ONLY');
  if (/(admin|cc-ai-ceo|cc-engineering-agent|cc-sales-agent)/i.test(name)) classes.add('ADMIN_ONLY');
  if (/(token|push|notification|media|call|pstn|sms|whatsapp|location|search|job|world|user|auth|login|payment|qr|coin|reward|health|ai|mcp|task)/i.test(name)) classes.add('HIGH_VALUE');
  if (classes.size === 0) classes.add('AUTH_REQUIRED');
  return Array.from(classes);
}

function printSummary(label, summary) {
  console.log(`${label}: ${summary.totals.functions} functions, ${summary.totals.critical} critical, ${summary.totals.high} high, ${summary.totals.medium} medium, ${summary.totals.low} low`);
}
