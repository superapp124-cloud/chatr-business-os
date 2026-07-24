const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');

const schemaPath = path.join(__dirname, '../electron/chatr-core/schema/capability.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

// Simple JSON Schema validator stub
function validateSchema(data, schemaObj) {
  // We'll trust the input for this demo, or add a real schema validator like ajv
  if (!data.identity || !data.runtime || !data.metadata) {
    throw new Error('Manifest is missing required sections: identity, runtime, metadata');
  }
}

function certify(capabilityDir) {
  const manifestPath = path.join(capabilityDir, 'capability.yaml');
  if (!fs.existsSync(manifestPath)) {
    console.error(`Manifest not found at ${manifestPath}`);
    process.exit(1);
  }

  const manifestStr = fs.readFileSync(manifestPath, 'utf8');
  let manifest;
  try {
    manifest = yaml.load(manifestStr);
  } catch (e) {
    console.error(`Invalid YAML: ${e.message}`);
    process.exit(1);
  }

  try {
    validateSchema(manifest, schema);
  } catch (e) {
    console.error(`Schema validation failed: ${e.message}`);
    process.exit(1);
  }

  // Create capability certificate
  const manifestHash = crypto.createHash('sha256').update(manifestStr).digest('hex');
  const certificate = {
    capabilityId: manifest.identity.id,
    version: manifest.identity.version,
    manifestHash: manifestHash,
    interfaceHash: crypto.createHash('sha256').update(JSON.stringify(manifest.runtime)).digest('hex'),
    schemaVersion: "1.0",
    abiVersion: "1.0",
    certificationDate: new Date().toISOString(),
    certificationToolVersion: "1.0.0",
    result: "CERTIFIED",
    warnings: []
  };

  const certPath = path.join(capabilityDir, 'certificate.json');
  fs.writeFileSync(certPath, JSON.stringify(certificate, null, 2), 'utf8');
  
  console.log(`✅ Certified Capability: ${manifest.identity.id}@${manifest.identity.version}`);
  console.log(`Certificate generated at: ${certPath}`);
  
  // Also register it globally (copy to a mock registry folder for now)
  const registryDir = path.join(__dirname, '../electron/chatr-core/capabilities/registry');
  if (!fs.existsSync(registryDir)) {
    fs.mkdirSync(registryDir, { recursive: true });
  }
  
  fs.writeFileSync(path.join(registryDir, `${manifest.identity.id}.json`), JSON.stringify({
    manifest,
    certificate
  }, null, 2));
}

const targetDir = process.argv[2];
if (!targetDir) {
  console.error("Usage: node certify-capability.cjs <capability-directory>");
  process.exit(1);
}

certify(path.resolve(targetDir));
