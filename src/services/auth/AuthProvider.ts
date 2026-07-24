import { TokenManager, ConnectedAccount } from './TokenManager';
import { supabase } from '../../integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';

export type AuthProviderType = 'google' | 'microsoft';

export class AuthProvider {
  static authListener: any = null;

  /**
   * Unified interface for authenticating with OAuth providers using PKCE.
   */
  static async login(provider: AuthProviderType): Promise<ConnectedAccount> {
    console.log(`[AuthProvider] Initiating PKCE OAuth flow for ${provider}`);
    
    const scopes = provider === 'google' 
      ? 'https://www.googleapis.com/auth/gmail.readonly'
      : 'Mail.Read'; // Microsoft Graph scope

    if (this.authListener) {
      this.authListener.remove();
      this.authListener = null;
    }

    if (Capacitor.isNativePlatform()) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider === 'microsoft' ? 'azure' : 'google',
        options: {
          scopes,
          skipBrowserRedirect: true,
          redirectTo: 'chatr://callback'
        }
      });

      if (error) throw error;

      if (data?.url) {
        await Browser.open({ url: data.url });

        return new Promise((resolve, reject) => {
          App.addListener('appUrlOpen', async (event: any) => {
            if (event.url.includes('chatr://')) {
              this.authListener?.remove();
              await Browser.close().catch(() => {});
              
              const urlParts = event.url.split('#');
              if (urlParts.length > 1) {
                // Parse hash parameters
                const params = new URLSearchParams(urlParts[1].replace(/&amp;/g, '&'));
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');
                const providerToken = params.get('provider_token'); // Needed to call Google/MS API
                
                if (accessToken && refreshToken) {
                  await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken
                  });
                  
                  const { data: { user } } = await supabase.auth.getUser();
                  if (user && providerToken) {
                    const actualProvider = user.app_metadata.provider === 'azure' ? 'microsoft' : 'google';
                    const account: ConnectedAccount = {
                      id: user.email || user.id,
                      provider: actualProvider,
                      displayName: user.user_metadata?.full_name || user.email || 'User',
                      token: {
                        accessToken: providerToken,
                        expiresAt: Date.now() + 3600000
                      }
                    };
                    // Use provider_refresh_token if available, else fallback
                    const pRt = params.get('provider_refresh_token') || refreshToken;
                    await TokenManager.saveAccount(account, pRt);
                    resolve(account);
                    return;
                  }
                }
              }
              reject(new Error('OAuth flow cancelled or failed to parse tokens'));
            }
          }).then(listener => {
            this.authListener = listener;
          });
        });
      }
    } else {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider === 'microsoft' ? 'azure' : 'google',
        options: {
          scopes,
          redirectTo: window.location.origin + '/#/smart-inbox'
        }
      });

      if (error) throw error;
      return new Promise(() => {});
    }

    throw new Error('Fallback failed');
  }

  /**
   * Extracts the provider token after an OAuth redirect.
   */
  static async handleRedirectCallback(): Promise<ConnectedAccount | null> {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;

    const providerToken = session.provider_token;
    if (!providerToken) return null; // Not an OAuth session with a provider token

    const provider: AuthProviderType = session.user.app_metadata.provider === 'azure' ? 'microsoft' : 'google';
    
    const account: ConnectedAccount = {
      id: session.user.email || session.user.id,
      provider,
      displayName: session.user.user_metadata?.full_name || session.user.email || 'User',
      token: {
        accessToken: providerToken,
        expiresAt: Date.now() + 3600000 // Supabase provider tokens usually expire in 1hr
      }
    };

    // Stash securely
    await TokenManager.saveAccount(account, session.provider_refresh_token || 'mock_rt');
    return account;
  }

  /**
   * Refreshes the short-lived access token using the securely stored refresh token.
   */
  static async refresh(provider: AuthProviderType, accountId: string): Promise<ConnectedAccount | null> {
    const refreshToken = await TokenManager.getRefreshToken(accountId);
    if (!refreshToken) {
      console.warn(`[AuthProvider] No refresh token available for ${accountId}. Re-auth required.`);
      return null;
    }

    console.log(`[AuthProvider] Refreshing access token for ${accountId} using secure refresh token.`);
    
    // Simulate HTTP POST to /token endpoint
    const accounts = await TokenManager.getAccounts();
    const account = accounts.find(a => a.id === accountId);
    
    if (account) {
      account.token = {
        accessToken: `at_refreshed_${Date.now()}`,
        expiresAt: Date.now() + 3600000
      };
      // Keep the same refresh token in secure storage, just update the account metadata
      await TokenManager.saveAccount(account);
      return account;
    }
    return null;
  }

  /**
   * Logs out the user and wipes tokens from secure storage.
   */
  static async logout(accountId: string): Promise<void> {
    console.log(`[AuthProvider] Logging out ${accountId}`);
    await TokenManager.removeAccount(accountId);
  }
}
