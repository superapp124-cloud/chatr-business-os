const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/sdk/capabilities');
const files = fs.readdirSync(dir);

let migratedCount = 0;

for (const file of files) {
  if (!file.endsWith('.sdk.ts')) continue;
  
  // Skip HR.ATS and Executive.CEOOffice as they are already upgraded
  if (file === 'HR.ATS.sdk.ts' || file === 'Executive.CEOOffice.sdk.ts') {
    continue;
  }

  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // 1. Upgrade Import and Type
  content = content.replace(/import \{ ICapabilitySDK \} from '\.\.\/types';/g, "import { ICapabilityManifest } from '../types';");
  content = content.replace(/: ICapabilitySDK = \{/g, ": ICapabilityManifest = {");

  // 2. Inject new intelligence arrays before workflows if they don't exist
  if (!content.includes('stateMachines: [')) {
    const injection = `
  // ABI v1.0: Intelligence & Execution
  stateMachines: [],
  policies: [],
  agents: [],
  tools: [],
  workflows: [],`;
    
    // Replace the old empty workflows array with the new injection block
    content = content.replace(/workflows: \[\],/g, injection);
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  migratedCount++;
}

console.log(`Successfully migrated ${migratedCount} capabilities to ABI v1.0.`);
