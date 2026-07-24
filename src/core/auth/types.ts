export interface PermissionScope {
  id: string;
  name: string;
  description: string;
  granted: boolean;
}

export interface ProviderConnection {
  accountId: string;          // Unique internal ID (e.g. google-12345)
  providerId: string;         // 'google', 'microsoft'
  providerType: string;       // 'oauth2', 'saml'
  displayName: string;        // 'Google Workspace'
  email: string;              // 'ceo@company.com'
  avatarUrl?: string;
  tenantId?: string;          // Enterprise tenant/workspace ID
  workspaceId?: string;
  isPrimary: boolean;
  
  permissions: PermissionScope[];
  
  expiresAt: number;
  lastRefresh: number;
  
  syncState: 'idle' | 'syncing' | 'error' | 'offline';
  lastSync?: number;
  connectionHealth: 'healthy' | 'degraded' | 'broken';
  
  encryptionKeyId?: string;   // Pointer to KMS/DPAPI key wrapper
}

export interface AuthSession {
  userId: string;
  deviceId: string;
  connectedAccounts: ProviderConnection[];
  lastActive: number;
}

export interface ProviderToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scopes: string[];
}
