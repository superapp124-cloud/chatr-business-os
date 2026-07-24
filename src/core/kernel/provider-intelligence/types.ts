import { IProvider } from '@/core/providers/ProviderRegistry';

export interface ProviderNode extends IProvider {
  reliabilityScore: number;
  trustScore: number;
  costScore: number;
  securityRating: string;
  regions: string[];
  capabilities: Record<string, any>;
  lastVerified: number;
  nextVerification: number;
}

export interface ProviderKnowledgeGraph {
  query(filters: {
    capabilityId?: string;
    region?: string;
    minReliability?: number;
    maxCost?: number;
    requiresMCP?: boolean;
    requiresOAuth?: boolean;
  }): Promise<ProviderNode[]>;

  resolveBestProvider(capabilityId: string, context: any): Promise<ProviderNode>;
}

export interface DiscoveryAgent {
  name: string;
  discover(): Promise<void>;
  status(): 'idle' | 'running' | 'error';
}
