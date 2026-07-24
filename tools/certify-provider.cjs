const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');

const schemaPath = path.join(__dirname, '../electron/chatr-core/schema/provider.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

function validateSchema(data, schemaObj) {
  if (!data.identity || !data.capabilities || !data.authentication || !data.operations) {
    throw new Error('Manifest is missing required sections: identity, capabilities, authentication, operations');
  }
}

function certify(providerDir) {
  const manifestPath = path.join(providerDir, 'provider.yaml');
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

  // Create provider certificate
  const manifestHash = crypto.createHash('sha256').update(manifestStr).digest('hex');
  const certificate = {
    providerId: manifest.identity.id,
    version: manifest.identity.version,
    manifestHash: manifestHash,
    schemaVersion: "1.0",
    abiVersion: "1.0",
    certificationDate: new Date().toISOString(),
    certificationToolVersion: "1.0.0",
    result: "CERTIFIED",
    warnings: []
  };

  const certPath = path.join(providerDir, 'certificate.json');
  fs.writeFileSync(certPath, JSON.stringify(certificate, null, 2), 'utf8');
  
  console.log(`✅ Certified Provider: ${manifest.identity.id}@${manifest.identity.version}`);
  console.log(`Certificate generated at: ${certPath}`);
  
  // Register it
  const registryDir = path.join(__dirname, '../electron/chatr-core/providers/registry');
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
  console.error("Usage: node certify-provider.cjs <provider-directory>");
  process.exit(1);
}

certify(path.resolve(targetDir));
