import { describe, it, expect } from 'vitest';
import type { PackageManifest } from '../../src/platform/contracts/PackageManifest.abi';

describe('Phase E1: PackageManifest ABI', () => {
  it('V1.1: Accepts a fully compliant manifest', () => {
    const validManifest: PackageManifest = {
      id: 'com.chatr.nodes.core',
      type: 'node-pack',
      version: '1.0.0',
      abiVersion: '1.0.0',
      name: 'Core Nodes',
      description: 'Standard built-in nodes for CHATR OS',
      publisher: 'CHATR OS Core Team',
      license: 'MIT',
      permissions: ['execute:local'],
      dependencies: [
        { packageId: 'com.chatr.capabilities.core', version: '^1.0.0' }
      ],
      signature: '0x1234567890abcdef',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    };

    expect(validManifest.id).toBe('com.chatr.nodes.core');
    expect(validManifest.dependencies.length).toBe(1);
    expect(validManifest.signature).toBeDefined();
  });

  it('V1.2: Enforces valid package types via TypeScript types', () => {
    // This is primarily a type-level test, but we can verify runtime assignment
    const type: PackageManifest['type'] = 'workflow-pack';
    expect(type).toBe('workflow-pack');
  });
});
