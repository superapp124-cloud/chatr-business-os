import { TokenStore, ConnectedAccount, OAuthToken } from './TokenStore';

/**
 * OAuthManager acts as the central coordinator for authenticating and 
 * refreshing tokens across different providers (Google/Microsoft).
 */
export class OAuthManager {
  /**
   * Initializes the OAuth environment (e.g. Capacitor plugin setup if needed).
   */
  static async initialize() {
    console.log('OAuthManager initialized.');
  }

  /**
   * Disconnects an account and clears its local token.
   */
  static async disconnectAccount(accountId: string) {
    await TokenStore.removeAccount(accountId);
  }

  /**
   * Checks if a token is expired.
   */
  static isTokenExpired(token: OAuthToken): boolean {
    const now = Date.now();
    // Buffer of 5 minutes (300,000 ms)
    return token.expiresAt - 300000 < now;
  }
}
