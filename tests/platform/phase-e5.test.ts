import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { PackageManager } from '../../src/platform/marketplace/PackageManager';
import { PackageRegistry } from '../../src/platform/marketplace/PackageRegistry';
import { BrowserNodeRegistry } from '../../src/platform/execution/BrowserNodeRegistry';
import { KeyStore } from '../../src/platform/marketplace/KeyStore';
import { PlatformCertificationError } from '../../src/platform/marketplace/PlatformCertification';

describe('Phase E.5: Chaos & Recovery Testing', () => {
  let packageManager: PackageManager;
  let registry: PackageRegistry;
  let nodeRegistry: BrowserNodeRegistry;
  let keyStore: KeyStore;
  
  const testDir = path.join(process.cwd(), '.chatr', 'e5-chaos-test');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    registry = new PackageRegistry(path.join(testDir, 'registry.json'));
    nodeRegistry = new BrowserNodeRegistry();
    
    // Setup KeyStore with Ed25519
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    keyStore = new KeyStore([{
      publisherId: 'CHATR Core Team',
      publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }) as string,
      status: 'active'
    }]);

    packageManager = new PackageManager(registry, nodeRegistry, keyStore);

    // Mock PackageRepository's download behavior
    // (Since we are testing Orchestration, not network)
  });

  it('PAT-008: Recovers from Registry Corruption', async () => {
    // 1. Manually write a corrupted JSON to the registry file
    const registryPath = path.join(testDir, 'registry.json');
    fs.writeFileSync(registryPath, '{ corrupted json');

    // 2. Instantiate registry (should gracefully recover or start empty)
    const newRegistry = new PackageRegistry(registryPath);
    expect(newRegistry.list().length).toBe(0);
  });

  it('PAT-010: Rejects Invalid Ed25519 Signatures', async () => {
    // Setup a fake package manifest and signature
    const manifest = {
      id: 'com.chatr.fake',
      version: '1.0.0',
      abiVersion: '1.0.0',
      name: 'Fake',
      description: 'Fake',
      publisher: 'CHATR Core Team',
      license: 'MIT',
      permissions: [],
      dependencies: [],
      checksum: crypto.createHash('sha256').update(Buffer.from('payload')).digest('hex'),
      signature: 'invalid_hex_signature_for_ed25519'
    };

    // Use a helper function or direct call to PlatformCertification
    const { PlatformCertification } = await import('../../src/platform/marketplace/PlatformCertification');
    
    expect(() => {
      PlatformCertification.certify(manifest as any, Buffer.from('payload'), new Set(), keyStore);
    }).toThrowError(/Trust Model Error/);
  });
});
