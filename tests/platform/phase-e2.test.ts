import { describe, it, expect } from 'vitest';
import { PlatformCertification, PlatformCertificationError } from '../../src/platform/marketplace/PlatformCertification';
import type { PackageManifest } from '../../src/platform/contracts/PackageManifest.abi';
import * as crypto from 'crypto';

describe('Phase E2: Platform Certification Gate', () => {
  const getValidManifest = (): PackageManifest => ({
    id: 'com.chatr.nodes.valid',
    type: 'node-pack',
    version: '1.0.0',
    abiVersion: '1.0.0',
    name: 'Valid Nodes',
    description: 'Test pack',
    publisher: 'CHATR',
    license: 'MIT',
    permissions: ['execute:local'],
    dependencies: [],
    signature: 'valid-sig-123',
    checksum: crypto.createHash('sha256').update(Buffer.from('payload-data')).digest('hex')
  });

  const payload = Buffer.from('payload-data');
  const existingIds = new Set<string>();

  it('Valid package -> accepted', () => {
    expect(() => PlatformCertification.certify(getValidManifest(), payload, existingIds)).not.toThrow();
  });

  it('Missing required manifest field -> rejected', () => {
    const manifest = getValidManifest();
    delete (manifest as any).publisher;
    
    expect(() => PlatformCertification.certify(manifest, payload, existingIds))
      .toThrowError(new PlatformCertificationError('Missing required manifest fields.', 'MISSING_FIELDS'));
  });

  it('Duplicate package ID -> rejected', () => {
    const manifest = getValidManifest();
    const ids = new Set(['com.chatr.nodes.valid']);
    
    expect(() => PlatformCertification.certify(manifest, payload, ids))
      .toThrowError(new PlatformCertificationError('Package com.chatr.nodes.valid is already installed.', 'DUPLICATE_ID'));
  });

  it('Invalid ABI version -> rejected', () => {
    const manifest = getValidManifest();
    manifest.abiVersion = '0.9.0';
    
    expect(() => PlatformCertification.certify(manifest, payload, existingIds))
      .toThrowError(new PlatformCertificationError('Unsupported ABI version: 0.9.0. Expected 1.0.0.', 'UNSUPPORTED_ABI'));
  });

  it('Unauthorized permission -> rejected', () => {
    const manifest = getValidManifest();
    manifest.permissions = ['fs:root_access'];
    
    expect(() => PlatformCertification.certify(manifest, payload, existingIds))
      .toThrowError(new PlatformCertificationError('Unauthorized permission requested: fs:root_access', 'UNAUTHORIZED_PERMISSION'));
  });

  it('Invalid checksum -> rejected', () => {
    const manifest = getValidManifest();
    manifest.checksum = 'bad-checksum';
    
    expect(() => PlatformCertification.certify(manifest, payload, existingIds))
      .toThrowError(new PlatformCertificationError('Payload checksum does not match manifest.', 'INVALID_CHECKSUM'));
  });

  it('Invalid signature -> rejected', () => {
    const manifest = getValidManifest();
    manifest.signature = 'INVALID_SIG'; // The magic string causing signature failure in our Phase E stub
    
    expect(() => PlatformCertification.certify(manifest, payload, existingIds))
      .toThrowError(new PlatformCertificationError('Cryptographic signature verification failed.', 'INVALID_SIGNATURE'));
  });
});
