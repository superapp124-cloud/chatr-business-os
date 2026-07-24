import { eventBus } from '../runtime/EventBus';
import { ProviderConnection, AuthSession } from './types';
import { sessionManager } from './SessionManager';
import { oauthManager } from './OAuthManager';
import { IProvider } from '../providers/ProviderSDK';

export class IdentityManagerImpl {
  private providers = new Map<string, IProvider>();

  public async initialize(): Promise<void> {
    console.log('[IdentityManager] Booting Identity Layer...');
    await sessionManager.initialize();
    
    eventBus.subscribe('chatr:oauth-success', async (payload: any) => {
      await this.addConnectedAccount(payload.profile, payload.providerId, payload.accountId);
    });
  }

  public registerProvider(provider: IProvider) {
    this.providers.set(provider.manifest.id, provider);
  }

  public async login(userId: string): Promise<AuthSession> {
    console.log(`[IdentityManager] Logging in user ${userId}`);
    const session: AuthSession = {
      userId,
      deviceId: crypto.randomUUID(),
      connectedAccounts: [],
      lastActive: Date.now()
    };
    await sessionManager.setSession(session);
    return session;
  }

  public async logout(): Promise<void> {
    console.log('[IdentityManager] Logging out current user');
    await sessionManager.clearSession();
  }

  public async connectProvider(providerId: string): Promise<void> {
    const session = sessionManager.getSession();
    if (!session) throw new Error('Must be logged in to connect a provider');

    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Provider ${providerId} not found in IdentityManager`);

    console.log(`[IdentityManager] Connecting provider ${providerId}...`);
    await oauthManager.initiateFlow(provider);
  }

  public async disconnectAccount(accountId: string): Promise<void> {
    const session = sessionManager.getSession();
    if (!session) return;

    const account = session.connectedAccounts.find(a => a.accountId === accountId);
    if (!account) return;

    const provider = this.providers.get(account.providerId);
    if (provider) {
      await provider.disconnect(accountId);
    }

    // Remove from session
    session.connectedAccounts = session.connectedAccounts.filter(a => a.accountId !== accountId);
    await sessionManager.setSession(session);
    console.log(`[IdentityManager] Disconnected account ${accountId}`);
  }

  public async getConnectedAccounts(): Promise<ProviderConnection[]> {
    const session = sessionManager.getSession();
    return session ? session.connectedAccounts : [];
  }

  public async getProviderToken(accountId: string): Promise<string | null> {
    const session = sessionManager.getSession();
    if (!session) return null;

    const account = session.connectedAccounts.find(a => a.accountId === accountId);
    if (!account) return null;

    const provider = this.providers.get(account.providerId);
    if (!provider) return null;

    return oauthManager.getValidToken(accountId, provider);
  }

  // Internal: Called by OAuthManager upon success
  public async addConnectedAccount(profile: any, providerId: string, accountId: string) {
    const session = sessionManager.getSession();
    if (!session) return;

    const existingAccountsForProvider = session.connectedAccounts.filter(a => a.providerId === providerId);
    
    // Check if account is already connected
    if (existingAccountsForProvider.find(a => a.email === profile.email)) {
      console.log(`[IdentityManager] Account ${profile.email} is already connected to ${providerId}`);
      return;
    }

    const provider = this.providers.get(providerId);

    const newConnection: ProviderConnection = {
      accountId,
      providerId,
      providerType: provider?.manifest.type || 'oauth2',
      displayName: provider?.manifest.name || providerId,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      isPrimary: existingAccountsForProvider.length === 0, // First account is primary
      permissions: (provider?.manifest.defaultScopes || []).map(scope => ({
        id: scope,
        name: scope,
        description: `Access to ${scope}`,
        granted: true
      })),
      expiresAt: 0,
      lastRefresh: Date.now(),
      syncState: 'idle',
      connectionHealth: 'healthy'
    };

    session.connectedAccounts.push(newConnection);
    await sessionManager.setSession(session);
    console.log(`[IdentityManager] Added new connected account ${profile.email}`);
  }
}

export const identityManager = new IdentityManagerImpl();
