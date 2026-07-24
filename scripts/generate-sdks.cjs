const fs = require('fs');
const path = require('path');

// Basic parser since we can't easily require the TS file without ts-node in a plain CJS script.
// We'll read the file as text, extract the CATALOG array using a regex/eval trick.
const catalogContent = fs.readFileSync(path.join(__dirname, '../src/data/capability-catalog.ts'), 'utf-8');

// Quick and dirty extraction of the array
const arrayMatch = catalogContent.match(/const CATALOG: ICapabilityManifest\[\] = (\[[\s\S]*\]);/);
if (!arrayMatch) {
  console.error('Could not find CATALOG array in capability-catalog.ts');
  process.exit(1);
}

let catalog;
try {
  // Use Function to evaluate the array literal. Need to mock the interfaces just in case.
  const fn = new Function(`return ${arrayMatch[1]}`);
  catalog = fn();
} catch (e) {
  console.error('Failed to parse catalog:', e);
  process.exit(1);
}

const outDir = path.join(__dirname, '../src/sdk/capabilities');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

let importsList = [];
let registryEntries = [];

// Skip ones we already have manually created
const skipIds = ['CRM.LeadManagement', 'Executive.OKRGoals'];

catalog.forEach(cap => {
  if (skipIds.includes(cap.id)) return;

  const safeName = cap.id.replace(/[^a-zA-Z0-9]/g, '');
  const varName = `${safeName}SDK`;
  const fileName = `${cap.id}.sdk.ts`;

  const objectsStr = (cap.objectSchemas || []).map(obj => {
    return `
    {
      name: '${obj.name}',
      pluralName: '${obj.pluralName || obj.name + 's'}',
      icon: '${obj.icon || '📋'}',
      titleField: '${obj.titleField || (obj.fields[0]?.name || 'id')}',
      statusField: '${obj.statusField || ''}',
      fields: ${JSON.stringify(obj.fields, null, 8).replace(/"([^"]+)":/g, '$1:')},
      relations: ${JSON.stringify(obj.relations || [], null, 8).replace(/"([^"]+)":/g, '$1:')},
      features: { comments: true, timeline: true, attachments: true }
    }`;
  }).join(',\n');

  const viewsStr = [
    `{ id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true }`,
    ...((cap.objectSchemas || []).map(obj => 
      `{ id: '${obj.name.toLowerCase()}', label: '${obj.pluralName || obj.name + 's'}', icon: '${obj.icon || '📋'}', type: 'grid', object: '${obj.name}' }`
    )),
    `{ id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }`
  ].join(',\n    ');

  const settingsStr = JSON.stringify(cap.configSchema || [], null, 4).replace(/"([^"]+)":/g, '$1:');

  const fileContent = `/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: ${cap.name} (${cap.id})
 */

import { ICapabilitySDK } from '../types';

export const ${varName}: ICapabilitySDK = {
  id: '${cap.id}',
  name: '${cap.name.replace(/'/g, "\\'")}',
  description: '${cap.description.replace(/'/g, "\\'")}',
  department: '${cap.department}',
  category: '${cap.category}',
  version: '${cap.version || '1.0.0'}',
  maturity: '${cap.maturity || 'L3'}',
  icon: '${cap.icon}',
  rating: ${cap.rating || 4.0},
  installs: ${cap.installs || 0},
  tags: ${JSON.stringify(cap.tags || [])},

  objects: [${objectsStr}
  ],

  views: [
    ${viewsStr}
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: '${cap.name} AI',
    skills: []
  },
  workflows: [],
  automations: [],
  notifications: [],
  permissions: {},
  search: { objects: [] },
  settings: ${settingsStr},
  integrations: [],
  seed: { objects: [] }
};
`;

  fs.writeFileSync(path.join(outDir, fileName), fileContent);
  
  importsList.push(`import { ${varName} } from '../../sdk/capabilities/${cap.id}.sdk';`);
  registryEntries.push(`  '${cap.id}': ${varName},`);
});

console.log('Successfully generated SDK files.');
console.log('\n--- Paste these imports into BusinessOS.tsx ---');
console.log(importsList.join('\n'));
console.log('\n--- Paste these into SDK_REGISTRY ---');
console.log(registryEntries.join('\n'));
