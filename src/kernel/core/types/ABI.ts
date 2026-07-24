/**
 * CHATR Kernel ABI (Application Binary Interface)
 * These types enforce strict communication contracts between Constitutional Services.
 */

export interface KernelEvent<T = unknown> {
  eventId: string;
  type: string;
  timestamp: number;
  sourceService: string;
  targetService?: string; 
  authority: string;      
  payload: T;
  version: string;
}

export interface IntentExecutionGraph {
  intent: {
    id: string;
    authority: string;    
    user: string;
    createdAt: number;
    rawInput: string;
  };
  
  graph: {
    nodes: ExecutionNode[];
    edges: ExecutionEdge[];
    dependencies: Record<string, string[]>;
  };
  
  state: 
    | 'Created'
    | 'Planned'
    | 'Executing'
    | 'Waiting'
    | 'PartiallyCompleted'
    | 'Verified'
    | 'Archived';
    
  evidence: {
    providersUsed: string[];
    latencyMs: number;
    confidenceScore: number;
    telemetry: Record<string, unknown>;
  };
  
  policy: {
    status: 'Approved' | 'Blocked' | 'PendingReview';
    violations: string[];
  };
}

export interface ExecutionNode {
  id: string;
  capabilityId: string;
  status: 'Pending' | 'Running' | 'Complete' | 'Failed';
  result?: unknown;
}

export interface ExecutionEdge {
  fromNodeId: string;
  toNodeId: string;
}

export interface CapabilityDefinition {
  id: string;             
  name: string;
  version: string;
  
  authority: {
    required: string[];   
    scope: 'User' | 'System';
  };
  
  inputs: unknown;     
  outputs: unknown;    
  
  plannerHints: {
    description: string;
    sideEffects: boolean;
    idempotent: boolean;
  };
  
  execution: {
    costEstimate: number; 
    timeoutMs: number;
    supportedProviders: string[]; 
  };
  
  verification: {
    requiresHumanApproval: boolean;
    validationRules: string[];
  };
  
  observability: {
    logLevel: 'Info' | 'Debug' | 'Trace';
    metrics: string[];
  };
}

export interface ExecutionPlan {
  providerId: string;
  transport: 'REST' | 'MCP' | 'Browser' | 'NativeSDK' | 'LocalApp';
  timeoutMs: number;
  retryCount: number;
  normalizer: string;
  verifier: string;
  authority: string;
  transportConfig: Record<string, any>;
}

export interface ProviderRecord {
  id: string;
  version: string;
  transport: string;
  endpoint: string;
  capabilities: string[];
  region: string;
  latencyMs: number;
  costEstimate: number;
  healthScore: number;
  reliability: number;
  permissions: string[];
  schema: string;
  normalizer: string;
  verifier: string;
  lastChecked: number;
}

export interface Evidence {
  provider: string;
  timestamp: number;
  latencyMs: number;
  confidence: number;
  payload: any;
  schemaVersion: string;
  verification: 'Pending' | 'Passed' | 'Failed';
  authority: string;
}
