// CHATR Kernel ABI - Provider Abstraction Layer (ADR-001)

export type ProviderRole = 
  | 'SearchProvider' 
  | 'ExecutionProvider' 
  | 'VerificationProvider' 
  | 'NotificationProvider' 
  | 'StorageProvider' 
  | 'SchedulerProvider' 
  | 'PaymentProvider' 
  | 'AIProvider' 
  | 'EnterpriseMemoryProvider';

export type ExecutionStrategy =
  | 'API'
  | 'DEEP_LINK'
  | 'BROWSER'
  | 'AUTOMATION'
  | 'LOCAL'
  | 'AGENT';

export type ExecutionReceiptStatus = 
  | 'Started' 
  | 'Running' 
  | 'Waiting' 
  | 'Completed' 
  | 'Cancelled' 
  | 'Failed';

export interface ProviderScore {
  performance: number;
  reliability: number;
  cost: number;
  policyCompliance: number;
  dataResidencyScore: number;
  securityLevel: number;
  enterprisePreference: number;
  historicalSuccess: number;
  userPreference: number;
  availability: number;
  health: number;
}

export interface IntentContext {
  workspaceId: string;
  userId: string;
  policyLevel: string;
  budget?: number;
  industry: string;
  department: string;
  correlationId: string;
  locale: string;
  complianceConstraints: string[];
  memoryRefs: string[];
  businessGraphNodes: string[];
}

export interface ExecutionReceipt {
  intentId: string;
  capabilityId: string;
  providerId: string;
  status: ExecutionReceiptStatus;
  durationMs: number;
  costEstimate?: number;
  tokensUsed?: number;
  evidence: any[];
  warnings: string[];
  policyApplied: string;
  confidence: number;
  retryCount: number;
  correlationId: string;
  auditTrail: string[];
}

export interface ProviderHealth {
  isHealthy: boolean;
  latencyMs: number;
  errorRate: number;
  maintenanceWindow?: string;
  rateLimitRemaining: number;
  quotaRemaining: number;
  version: string;
  lastChecked: number;
}

export type ProviderMarketplaceState = 'Installed' | 'Enabled' | 'Experimental' | 'Deprecated' | 'Disabled';

export interface IProviderAdapter {
  id: string;
  name: string;
  type: string;
  role: ProviderRole;
  marketplaceState: ProviderMarketplaceState;
  
  // Real-time state
  health(): Promise<ProviderHealth>;
  score(context: IntentContext): Promise<ProviderScore>;
  authenticate(): Promise<boolean>;
  
  // Execution
  execute(context: IntentContext, payload: any): Promise<ExecutionReceipt>;
  verify(receiptId: string): Promise<any>;
}

export type ProviderTier = 'tier1_native' | 'tier2_limited' | 'tier3_deeplink';

export interface ProviderManifest {
  id: string;
  name: string;
  tier: ProviderTier;
  capabilities: string[];
  scopes: string[];
  rateLimits?: {
    requestsPerMinute: number;
  };
  features: {
    streaming: boolean;
    realtime: boolean;
    offlineSync: boolean;
    webhooks: boolean;
  };
}

