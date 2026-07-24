const fs = require('fs');
const path = require('path');

const capabilityName = process.argv[2];

if (!capabilityName) {
  console.error('Usage: node scripts/create-capability.js <capability-name>');
  process.exit(1);
}

const capNameLower = capabilityName.toLowerCase();
const capNameCapitalized = capabilityName.charAt(0).toUpperCase() + capabilityName.slice(1);

const baseDir = path.join(__dirname, '..', 'src', 'core', 'capabilities', capNameLower);

if (fs.existsSync(baseDir)) {
  console.error(`Capability ${capNameLower} already exists.`);
  process.exit(1);
}

fs.mkdirSync(baseDir, { recursive: true });
fs.mkdirSync(path.join(baseDir, 'tests'), { recursive: true });

// 1. manifest.json
const manifest = {
  id: `core.${capNameLower}`,
  version: "1.0.0",
  category: "productivity",
  permissions: [],
  supportsUndo: true,
  supportsScheduling: false,
  executionPolicy: "immediate"
};
fs.writeFileSync(path.join(baseDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// 2. index.ts
const indexTs = `import { OutcomeCapability, Outcome, ValidationResult, Preview, ExecutionResult } from '../types';
import manifest from './manifest.json';
import { validate } from './validator';
import { execute, undo, complete, archive } from './executor';

export const ${capNameCapitalized}Capability: OutcomeCapability = {
  manifest: manifest as any,
  validate,
  preview: (outcome: Outcome): Preview => {
    return {
      title: outcome.title,
      subtitle: outcome.description || '',
      actions: ['Confirm', 'Cancel']
    };
  },
  execute,
  undo,
  complete,
  archive
};
`;
fs.writeFileSync(path.join(baseDir, 'index.ts'), indexTs);

// 3. validator.ts
const validatorTs = `import { Outcome, ValidationResult } from '../types';

export async function validate(outcome: Outcome): Promise<ValidationResult> {
  // Add specific validation logic here
  return { isValid: true };
}
`;
fs.writeFileSync(path.join(baseDir, 'validator.ts'), validatorTs);

// 4. executor.ts
const executorTs = `import { Outcome, ExecutionResult } from '../types';

export async function execute(outcome: Outcome): Promise<ExecutionResult> {
  console.log(\`[\${outcome.capability}] Executing outcome \${outcome.id}\`);
  return { success: true, outcomeId: outcome.id };
}

export async function undo(outcomeId: string): Promise<void> {
  console.log(\`[Undo] \${outcomeId}\`);
}

export async function complete(outcomeId: string): Promise<void> {
  console.log(\`[Complete] \${outcomeId}\`);
}

export async function archive(outcomeId: string): Promise<void> {
  console.log(\`[Archive] \${outcomeId}\`);
}
`;
fs.writeFileSync(path.join(baseDir, 'executor.ts'), executorTs);

console.log(`Successfully created capability structure for '${capNameLower}' at src/core/capabilities/${capNameLower}`);
