import { IProvider, ProviderManifest } from './ProviderSDK';

export class Microsoft365Provider implements IProvider {
  public manifest: ProviderManifest = {
    id: 'microsoft',
    name: 'Microsoft 365',
    type: 'oauth2',
    defaultScopes: ['Mail.Read', 'Calendars.Read', 'User.Read', 'offline_access']
  };

  public async discover(): Promise<void> {
    console.log('[MicrosoftProvider] Discovered and ready.');
  }

  public async connect(): Promise<{ authUrl?: string; customFlow?: boolean }> {
    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID || 'mock-client-id';
    const redirectUri = 'http://127.0.0.1:3014/oauth/callback';
    const tenant = 'common';
    
    const url = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
    url.searchParams.append('client_id', clientId);
    url.searchParams.append('redirect_uri', redirectUri);
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('scope', this.manifest.defaultScopes.join(' '));
    url.searchParams.append('response_mode', 'query');
    
    return { authUrl: url.toString() };
  }

  public async authenticate(code: string): Promise<{ accessToken: string; refreshToken?: string; expiresAt: number; profile: any }> {
    console.log(`[MicrosoftProvider] Exchanging code: ${code.substring(0, 5)}...`);
    // Simulated token exchange
    return {
      accessToken: `ms-access-${Date.now()}`,
      refreshToken: `ms-refresh-${Date.now()}`,
      expiresAt: Date.now() + 3600 * 1000,
      profile: {
        email: `ceo.${Math.floor(Math.random() * 1000)}@company.com`,
        name: 'Microsoft User',
        avatarUrl: 'https://via.placeholder.com/150'
      }
    };
  }

  public async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresAt: number }> {
    console.log(`[MicrosoftProvider] Refreshing token using ${refreshToken.substring(0, 5)}...`);
    return {
      accessToken: `ms-access-refreshed-${Date.now()}`,
      expiresAt: Date.now() + 3600 * 1000
    };
  }

  public async sync(accountId: string): Promise<void> {
    console.log(`[MicrosoftProvider] Syncing data for ${accountId}...`);
  }

  public async disconnect(accountId: string): Promise<void> {
    console.log(`[MicrosoftProvider] Disconnecting account ${accountId}`);
  }

  public async revoke(accountId: string): Promise<void> {
    console.log(`[MicrosoftProvider] Revoking token for ${accountId}`);
  }
}
