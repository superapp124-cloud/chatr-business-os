import * as crypto from 'crypto';

export interface PublisherKey {
  publisherId: string;
  publicKeyPem: string;
  status: 'active' | 'revoked' | 'expired';
  revokedReason?: string;
  expiresAt?: string;
}

/**
 * KeyStore — Phase E.5
 * 
 * Manages trusted publisher Ed25519 public keys.
 * Supports offline verification, key rotation, and emergency revocation.
 */
export class KeyStore {
  private keys = new Map<string, PublisherKey[]>();

  constructor(initialKeys: PublisherKey[] = []) {
    for (const key of initialKeys) {
      this.addKey(key);
    }
  }

  addKey(key: PublisherKey): void {
    const existing = this.keys.get(key.publisherId) || [];
    existing.push(key);
    this.keys.set(key.publisherId, existing);
  }

  revokeKey(publisherId: string, publicKeyPem: string, reason: string): void {
    const publisherKeys = this.keys.get(publisherId);
    if (!publisherKeys) return;
    
    const key = publisherKeys.find(k => k.publicKeyPem === publicKeyPem);
    if (key) {
      key.status = 'revoked';
      key.revokedReason = reason;
    }
  }

  /**
   * Verifies an Ed25519 signature over the given data payload.
   */
  verifySignature(publisherId: string, data: Buffer, signatureHex: string): boolean {
    const publisherKeys = this.keys.get(publisherId);
    if (!publisherKeys || publisherKeys.length === 0) {
      throw new Error(`Trust Model Violation: No trusted keys found for publisher '${publisherId}'.`);
    }

    const activeKeys = publisherKeys.filter(k => {
      if (k.status === 'revoked') return false;
      if (k.status === 'expired') return false;
      if (k.expiresAt && new Date(k.expiresAt) < new Date()) {
        k.status = 'expired';
        return false;
      }
      return true;
    });

    if (activeKeys.length === 0) {
      throw new Error(`Trust Model Violation: All keys for publisher '${publisherId}' are revoked or expired.`);
    }

    // Try all active keys (supports rotation gracefully)
    for (const key of activeKeys) {
      try {
        const isValid = crypto.verify(
          undefined, // Ed25519 doesn't use a hash algorithm here, Node handles it
          data,
          key.publicKeyPem,
          Buffer.from(signatureHex, 'hex')
        );
        if (isValid) return true;
      } catch (e) {
        // Continue to next key
      }
    }

    return false;
  }
}
