import { tokenVault } from './TokenVault';
import { ProviderToken } from './types';
import { eventBus } from '../runtime/EventBus';
import http from 'http';
import { IProvider } from '../providers/ProviderSDK';

export class OAuthManagerImpl {
  private server: http.Server | null = null;
  private pendingState: string | null = null;
  private activeProvider: IProvider | null = null;
  
  public async initiateFlow(provider: IProvider): Promise<void> {
    this.activeProvider = provider;
    this.pendingState = crypto.randomUUID();
    
    console.log(`[OAuthManager] Initiating real OAuth flow for ${provider.manifest.id}`);
    
    // Start local server to listen for callback
    await this.startCallbackServer();

    // Get auth URL from provider SDK
    const { authUrl, customFlow } = await provider.connect();

    if (customFlow) {
      console.log(`[OAuthManager] Provider ${provider.manifest.id} is handling custom auth flow.`);
      return;
    }

    if (!authUrl) {
      throw new Error(`[OAuthManager] Provider ${provider.manifest.id} did not return an auth URL.`);
    }

    // Append state for CSRF protection
    const urlWithState = new URL(authUrl);
    urlWithState.searchParams.set('state', this.pendingState);

    // Open System Browser (Electron shell in real app)
    console.log(`[OAuthManager] Opening system browser to: ${urlWithState.toString()}`);
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.shell.openExternal(urlWithState.toString());
    } else {
      console.log(`[OAuthManager] (Simulated) Please visit: ${urlWithState.toString()}`);
      // Fallback simulation for browser environment if needed
    }
  }

  private startCallbackServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close();
      }

      this.server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url || '', `http://${req.headers.host}`);
          
          if (url.pathname === '/oauth/callback') {
            const code = url.searchParams.get('code');
            const state = url.searchParams.get('state');

            if (state !== this.pendingState) {
              res.writeHead(400);
              res.end('Invalid state parameter (CSRF detected)');
              return;
            }

            if (!code) {
              res.writeHead(400);
              res.end('Missing authorization code');
              return;
            }

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0a0a0c; color: white;">
                  <div style="text-align: center;">
                    <h2>Authentication Successful</h2>
                    <p>You can close this tab and return to CHATR.</p>
                    <script>window.close();</script>
                  </div>
                </body>
              </html>
            `);

            await this.handleCallback(code);
          } else {
            res.writeHead(404);
            res.end('Not Found');
          }
        } catch (err) {
          console.error('[OAuthManager] Callback error:', err);
          res.writeHead(500);
          res.end('Internal Server Error');
        }
      });

      this.server.listen(3014, '127.0.0.1', () => {
        console.log('[OAuthManager] Listening for OAuth callbacks on http://127.0.0.1:3014');
        resolve();
      });
      
      this.server.on('error', (err) => {
        console.error('[OAuthManager] Server error:', err);
        reject(err);
      });
    });
  }

  private async handleCallback(code: string): Promise<void> {
    console.log(`[OAuthManager] Received callback code, exchanging with provider...`);
    
    if (this.server) {
      this.server.close();
      this.server = null;
    }

    if (!this.activeProvider) {
      throw new Error('[OAuthManager] No active provider during callback');
    }

    try {
      const result = await this.activeProvider.authenticate(code);
      
      const mockToken: ProviderToken = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
        scopes: this.activeProvider.manifest.defaultScopes
      };

      // Ensure account ID is unique to the user profile
      const accountId = `${this.activeProvider.manifest.id}-${result.profile.email}`;
      await tokenVault.storeToken(accountId, mockToken);
      
      eventBus.publish('chatr:oauth-success', { 
        providerId: this.activeProvider.manifest.id, 
        accountId,
        profile: result.profile 
      }, 'OAuthManager');
      
    } catch (err) {
      console.error('[OAuthManager] Failed to exchange code:', err);
      eventBus.publish('chatr:oauth-error', { error: String(err) }, 'OAuthManager');
    } finally {
      this.activeProvider = null;
      this.pendingState = null;
    }
  }

  public async getValidToken(accountId: string, provider: IProvider): Promise<string | null> {
    const token = await tokenVault.getToken(accountId);
    if (token) return token.accessToken;

    console.log(`[OAuthManager] Token expired or missing for ${accountId}. Attempting refresh...`);
    
    const expiredToken = await tokenVault.getRawToken(accountId);
    if (!expiredToken || !expiredToken.refreshToken) {
      console.warn(`[OAuthManager] No refresh token available for ${accountId}`);
      return null;
    }

    try {
      const result = await provider.refresh(expiredToken.refreshToken);
      const refreshedToken: ProviderToken = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken || expiredToken.refreshToken,
        expiresAt: result.expiresAt,
        scopes: expiredToken.scopes
      };
      await tokenVault.storeToken(accountId, refreshedToken);
      return refreshedToken.accessToken;
    } catch (err) {
      console.error(`[OAuthManager] Failed to refresh token for ${accountId}:`, err);
      return null;
    }
  }
}

export const oauthManager = new OAuthManagerImpl();
