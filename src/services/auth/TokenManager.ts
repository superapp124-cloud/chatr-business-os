import { Preferences } from '@capacitor/preferences';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

export interface OAuthToken {
  accessToken: string;
  expiresAt: number;
}

export interface ConnectedAccount {
  id: string; // e.g. email address
  provider: 'google' | 'microsoft';
  displayName: string;
  avatarUrl?: string;
  token: OAuthToken; // Refresh token is not stored in plain text here
}

const ACCOUNTS_KEY = 'chatr_connected_accounts';

export class TokenManager {
  /**
   * Retrieves all connected accounts from Preferences.
   * Note: This does NOT return the highly sensitive refresh tokens.
   */
  static async getAccounts(): Promise<ConnectedAccount[]> {
    const { value } = await Preferences.get({ key: ACCOUNTS_KEY });
    if (!value) return [];
    try {
      return JSON.parse(value) as ConnectedAccount[];
    } catch (e) {
      console.error('Failed to parse accounts from storage', e);
      return [];
    }
  }

  /**
   * Saves account metadata and the short-lived access token to Preferences,
   * while securely stashing the refresh token in the hardware-backed keystore.
   */
  static async saveAccount(account: ConnectedAccount, refreshToken?: string): Promise<void> {
    const accounts = await this.getAccounts();
    const existingIndex = accounts.findIndex(a => a.id === account.id);
    
    if (existingIndex >= 0) {
      accounts[existingIndex] = account;
    } else {
      accounts.push(account);
    }

    await Preferences.set({
      key: ACCOUNTS_KEY,
      value: JSON.stringify(accounts)
    });

    if (refreshToken) {
      try {
        await SecureStoragePlugin.set({
          key: `rt_${account.id}`,
          value: refreshToken
        });
      } catch (e) {
        // Fallback for browser testing where secure storage might not be fully native
        console.warn('SecureStoragePlugin failed, falling back to Preferences for dev', e);
        await Preferences.set({
          key: `rt_fallback_${account.id}`,
          value: refreshToken
        });
      }
    }
  }

  /**
   * Retrieves the secure refresh token from the hardware keystore.
   */
  static async getRefreshToken(accountId: string): Promise<string | null> {
    try {
      const result = await SecureStoragePlugin.get({ key: `rt_${accountId}` });
      return result.value;
    } catch (e) {
      const fallback = await Preferences.get({ key: `rt_fallback_${accountId}` });
      return fallback.value;
    }
  }

  /**
   * Removes a connected account and wipes its secure refresh token.
   */
  static async removeAccount(accountId: string): Promise<void> {
    const accounts = await this.getAccounts();
    const filtered = accounts.filter(a => a.id !== accountId);
    
    await Preferences.set({
      key: ACCOUNTS_KEY,
      value: JSON.stringify(filtered)
    });

    try {
      await SecureStoragePlugin.remove({ key: `rt_${accountId}` });
    } catch (e) {
      await Preferences.remove({ key: `rt_fallback_${accountId}` });
    }
  }
}
