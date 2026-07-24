import { randomUUID } from '../utils/id';
import type { CapabilityToken, EntityId, CapabilityId, TokenScope, TokenId } from '../abi/v1';

export class CapabilityTokenService {
  private tokens = new Map<string, CapabilityToken>(); // Indexed by nonce

  public issue(entityId: EntityId, capabilityId: CapabilityId, scope: TokenScope): CapabilityToken {
    const nonce = `nonce_${randomUUID()}`;
    const token: CapabilityToken = {
      id: `tok_${randomUUID()}` as TokenId,
      entityId,
      capability: capabilityId,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60_000, // 60 second TTL
      signature: `sig_${nonce}`,      // Mock signature; use HMAC-SHA256 in prod
      nonce,
      scope,
    };

    this.tokens.set(nonce, token);
    return token;
  }

  public verify(token: CapabilityToken): boolean {
    const stored = this.tokens.get(token.nonce);
    
    if (!stored) return false;                         // Already used or unknown
    if (stored.expiresAt < Date.now()) return false;   // Expired
    if (stored.entityId !== token.entityId) return false;
    if (stored.capability !== token.capability) return false;

    // Single-use: invalidate after verification
    this.tokens.delete(token.nonce);
    return true;
  }
}
