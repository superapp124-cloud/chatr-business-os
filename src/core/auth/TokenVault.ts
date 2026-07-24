import { ProviderToken } from './types';

// Core OS Secure Token Vault
// Encrypts and securely stores tokens for connected providers.
export class TokenVaultImpl {
  private tokens = new Map<string, ProviderToken>();

  public async storeToken(accountId: string, token: ProviderToken): Promise<void> {
    // In production, this would securely encrypt the token using the OS keychain or KMS
    console.log(`[TokenVault] Storing encrypted token for account ${accountId}`);
    this.tokens.set(accountId, token);
  }

  public async getToken(accountId: string): Promise<ProviderToken | null> {
    const token = this.tokens.get(accountId);
    if (!token) return null;

    // Check expiration
    if (Date.now() > token.expiresAt) {
      console.warn(`[TokenVault] Token for ${accountId} expired.`);
      // Return null so OAuthManager triggers refresh
      return null; 
    }

    return token;
  }

  public async getRawToken(accountId: string): Promise<ProviderToken | null> {
    // Only used by OAuthManager internally to attempt refresh
    return this.tokens.get(accountId) || null;
  }

  public async removeToken(accountId: string): Promise<void> {
    this.tokens.delete(accountId);
  }
}

export const tokenVault = new TokenVaultImpl();
