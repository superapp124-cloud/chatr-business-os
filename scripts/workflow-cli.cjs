const fs = require('fs');
const path = require('path');

const command = process.argv[2];
const domain = process.argv[3];

if (command !== 'create' || !domain) {
  console.log("Usage: node workflow-cli.js create <domain> (e.g. 'hr', 'crm')");
  process.exit(1);
}

const dir = path.join(__dirname, '../src/core/capabilities', domain);

if (fs.existsSync(dir)) {
  console.log(`Capability domain '${domain}' already exists.`);
  process.exit(1);
}

fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(path.join(dir, 'stages'));

// Write manifest.json
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
  id: `core.${domain}`,
  name: domain.toUpperCase(),
  version: "1.0.0",
  category: "business",
  tags: [domain],
  keywords: [domain]
}, null, 2));

// Write types
fs.writeFileSync(path.join(dir, 'types.ts'), `// Artifact Types for ${domain}\n`);

// Write orchestrator using SDK
fs.writeFileSync(path.join(dir, `${domain}Planner.ts`), `import { WorkflowSDK } from '@/core/sdk/WorkflowSDK';

export const ${domain}Capability = WorkflowSDK.createCapability(
  '${domain}', 
  [], // TODO: Insert Stages here
  (intent) => ({
    id: crypto.randomUUID(),
    type: '${domain}',
    state: {},
    artifacts: {},
    policies: {}
  })
);
`);

console.log(`Successfully scaffolded '${domain}' capability at src/core/capabilities/${domain}`);
