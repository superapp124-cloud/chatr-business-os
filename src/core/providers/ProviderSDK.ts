export interface ProviderManifest {
  id: string;
  name: string;
  type: 'oauth2' | 'saml' | 'apikey' | 'local';
  defaultScopes: string[];
}

export interface IProvider {
  manifest: ProviderManifest;

  /**
   * Called when the Kernel boots. Provider should perform offline initialization.
   */
  discover(): Promise<void>;

  /**
   * Start the OAuth or authorization flow. Returns the authorization URL or performs local auth.
   */
  connect(): Promise<{ authUrl?: string; customFlow?: boolean }>;

  /**
   * Handle the callback/code from the authorization flow and return the extracted tokens or identity info.
   */
  authenticate(code: string): Promise<{ accessToken: string, refreshToken?: string, expiresAt: number, profile: any }>;

  /**
   * Use the refresh token to get a new access token.
   */
  refresh(refreshToken: string): Promise<{ accessToken: string, refreshToken?: string, expiresAt: number }>;

  /**
   * Synchronize data in the background (e.g. downloading mail, indexing files).
   */
  sync(accountId: string): Promise<void>;

  /**
   * Disconnect the account from CHATR locally.
   */
  disconnect(accountId: string): Promise<void>;

  /**
   * Fully revoke the token at the provider level.
   */
  revoke(accountId: string): Promise<void>;
}
