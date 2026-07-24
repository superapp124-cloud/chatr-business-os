#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.log(`
🚀 CHATR OS Capability Engine (v1.0.0)
Usage:
  chatr build <path-to-pack.json>   - Compile a capability pack into SQL & UI schemas
  chatr validate <path-to-pack.json> - Validate metadata against CHATR schema
  `);
  process.exit(1);
}

if (command === 'build') {
  const packPath = args[1];
  if (!packPath) {
    console.error('Error: Please provide a path to a capability pack JSON file.');
    process.exit(1);
  }

  const fullPath = path.resolve(process.cwd(), packPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Error: File not found at ${fullPath}`);
    process.exit(1);
  }

  try {
    const rawData = fs.readFileSync(fullPath, 'utf8');
    const pack = JSON.parse(rawData);

    console.log(`\n📦 Compiling Capability Pack: ${pack.name} (${pack.id})`);
    
    // 1. Generate SQL Migrations for Custom Objects
    let sqlOutput = `-- Auto-generated SQL Migration for ${pack.id}\n\n`;
    if (pack.objects && pack.objects.length > 0) {
      console.log(`[SQL] Generating schema for ${pack.objects.length} custom objects...`);
      pack.objects.forEach(obj => {
        const tableName = `${pack.id.replace(/\./g, '_')}_${obj.name.toLowerCase()}`;
        sqlOutput += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
        sqlOutput += `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n`;
        sqlOutput += `  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,\n`;
        
        if (obj.fields) {
          obj.fields.forEach(field => {
            const dbType = field.type === 'string' ? 'TEXT' : field.type === 'number' ? 'NUMERIC' : field.type === 'boolean' ? 'BOOLEAN' : 'JSONB';
            sqlOutput += `  ${field.name} ${dbType},\n`;
          });
        }
        sqlOutput += `  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\n`;
        sqlOutput += `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;\n\n`;
      });
    }

    // 2. Generate UI Schema Registry Stub
    let uiOutput = `// Auto-generated UI Schema Registry for ${pack.id}\n`;
    uiOutput += `export const ${pack.id.replace(/\./g, '_')}_schema = ${JSON.stringify(pack.ui_schemas || {}, null, 2)};\n`;

    const outDir = path.join(path.dirname(fullPath), 'dist');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir);
    }

    fs.writeFileSync(path.join(outDir, `${pack.id}.sql`), sqlOutput);
    fs.writeFileSync(path.join(outDir, `${pack.id}_ui.ts`), uiOutput);

    console.log(`✅ Success! Compiled artifacts written to /dist`);
    
  } catch (error) {
    console.error('Compilation failed:', error);
    process.exit(1);
  }
} else if (command === 'validate') {
  console.log('Validation engine coming soon...');
} else {
  console.error(`Unknown command: ${command}`);
}
