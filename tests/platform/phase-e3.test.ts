import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PackageManager } from '../../src/platform/marketplace/PackageManager';
import { PackageRegistry } from '../../src/platform/marketplace/PackageRegistry';
import { BrowserNodeRegistry } from '../../src/platform/execution/BrowserNodeRegistry';
import { PlatformCertification, PlatformCertificationError } from '../../src/platform/marketplace/PlatformCertification';
import type { PackageManifest } from '../../src/platform/contracts/PackageManifest.abi';
import * as path from 'path';

describe('Phase E3: Package Manager & Integration Pipeline', () => {
  let registry: PackageRegistry;
  let nodeRegistry: BrowserNodeRegistry;
  let manager: PackageManager;
  const testRegistryPath = path.join(process.cwd(), '.chatr', 'test-registry.json');

  beforeEach(() => {
    registry = new PackageRegistry(testRegistryPath);
    registry.clear(); // Ensure clean state
    nodeRegistry = new BrowserNodeRegistry();
    // We clear out the default nodes for this test so we can prove the package installs them
    (nodeRegistry as any).definitions.clear();
    manager = new PackageManager(registry, nodeRegistry);
  });

  afterEach(() => {
    registry.clear();
  });

  describe('Negative Certification Path (Layer 2 / E3 Additions)', () => {
    const validManifest: PackageManifest = {
      id: 'com.chatr.nodes.valid', type: 'node-pack', version: '1.0.0', abiVersion: '1.0.0',
      name: 'Valid', description: 'Valid', publisher: 'CHATR', license: 'MIT', permissions: [], dependencies: []
    };

    it('Dependency failure -> rejected', () => {
      const manifest = { ...validManifest, dependencies: [{ packageId: 'com.chatr.missing', version: '1.0.0' }] };
      expect(() => PlatformCertification.certify(manifest, undefined, new Set()))
        .toThrowError(new PlatformCertificationError('Missing required dependency: com.chatr.missing', 'MISSING_DEPENDENCY'));
    });
  });

  describe('E3: End-to-End Installation Pipeline & Rollback', () => {
    it('Positive: Installs real package from disk, registers, and activates', async () => {
      expect(registry.has('com.chatr.nodes.core')).toBe(false);
      expect(nodeRegistry.get('core.trigger')).toBeUndefined();

      // Real installation pipeline
      const pkg = await manager.install('core-nodes');

      expect(pkg.manifest.id).toBe('com.chatr.nodes.core');
      expect(registry.has('com.chatr.nodes.core')).toBe(true);
      expect(pkg.status).toBe('active');

      // Activator injected the nodes into the node registry
      expect(nodeRegistry.get('core.trigger')).toBeDefined();
    });

    it('Negative: Rollback occurs on activation failure', async () => {
      // We will monkeypatch the node registry to throw an error, simulating an activation failure
      const originalRegister = nodeRegistry.register.bind(nodeRegistry);
      nodeRegistry.register = () => { throw new Error('Simulated activation failure'); };

      await expect(manager.install('core-nodes')).rejects.toThrow(/Activation failed, package rolled back/);

      // Verify rollback
      expect(registry.has('com.chatr.nodes.core')).toBe(false);
      
      // Restore
      nodeRegistry.register = originalRegister;
    });

    it('Negative: Duplicate install -> rejected (via certification)', async () => {
      await manager.install('core-nodes');
      await expect(manager.install('core-nodes')).rejects.toThrow(/already installed/);
    });

    it('Persistence: Restart application -> Registry rebuilt -> Package still installed', async () => {
      // 1. Install
      await manager.install('core-nodes');
      expect(registry.has('com.chatr.nodes.core')).toBe(true);

      // 2. Simulate Application Restart (Create new registry instance reading from disk)
      const newRegistry = new PackageRegistry(testRegistryPath);
      
      // 3. Verify
      expect(newRegistry.has('com.chatr.nodes.core')).toBe(true);
      const pkg = newRegistry.get('com.chatr.nodes.core');
      expect(pkg?.status).toBe('active');
    });
  });
});
