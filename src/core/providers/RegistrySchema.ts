// Registry schema definitions for Provider Intelligence Platform v1

export type TransportProtocol = 'MCP' | 'REST' | 'GraphQL' | 'SDK' | 'CLI' | 'BrowserAutomation';

export interface ProviderCapability {
  capabilityId: string; // e.g., "travel.flight.search"
  priority: number;
}

export interface ProviderRecord {
  id: string; // Canonical ID, e.g., "amadeus-gds"
  name: string; // Human-readable name
  industry: string;
  subIndustry: string;
  status: 'ACTIVE' | 'REJECTED' | 'EXPERIMENTAL' | 'DEPRECATED';
  transport: TransportProtocol;
  capabilities: ProviderCapability[];
  
  authentication: {
    type: 'OAuth2' | 'API_KEY' | 'SESSION_TOKEN' | 'NONE';
    vaultKey?: string; // Key in the Credential Vault
  };
  
  health: {
    uptime: number; // percentage
    latencyMs: number;
    successRate: number; // percentage
    lastVerified: number; // timestamp
  };
  
  trustScore: number;
  
  metadata: {
    description: string;
    documentationUrl?: string;
    repositoryUrl?: string;
    version: string;
    isEnterpriseReady: boolean;
  };
}
