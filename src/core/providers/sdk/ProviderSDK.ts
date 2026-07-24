export type IdempotencyMode = 
  | 'PROVIDER_NATIVE'         // The external API supports Idempotency-Key headers natively
  | 'DETERMINISTIC_LOOKUP'    // The SDK searches the provider to see if the artifact exists
  | 'TRANSACTION_RECORD'      // The local database guarantees the transaction
  | 'MANUAL_RECOVERY';        // No safe retry; requires human intervention

export type CapabilityVersion = `${number}.${number}.${number}`;

export interface ProviderAuth {
  type: 'PAT' | 'OAuth2' | 'JWT' | 'APIKey' | 'DeviceFlow';
  resolveSecret(): Promise<string>; // Lazily loaded, NEVER persisted in context
}

export interface HealthStatus {
  isHealthy: boolean;
  latencyMs: number;
  message?: string;
}

export interface RateLimitStatus {
  remaining: number;
  resetAt: number;
  backoffMs?: number;
}

export interface RawPayload {
  [key: string]: any;
}

export interface RawResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
}

export interface CanonicalModel {
  [key: string]: any;
}

export interface CanonicalRuntimeError extends Error {
  type: 
    | 'ValidationError' 
    | 'PolicyError' 
    | 'CapabilityError' 
    | 'PlannerError' 
    | 'ProviderTimeout' 
    | 'ProviderUnavailable' 
    | 'AuthenticationFailure' 
    | 'PermissionDenied' 
    | 'NetworkFailure' 
    | 'PersistenceFailure'
    | 'RateLimitExceeded';
  retryable: boolean;
  providerId: string;
  rawError?: any;
}

export interface ProviderAdapter {
  id: string; // e.g., 'provider.github'
  version: string;
  supportedCapabilities: string[]; // e.g., ['developer.createArtifact']
  idempotencyMode: IdempotencyMode;
  
  initialize(): Promise<void>;
  authenticate(auth: ProviderAuth): Promise<void>;
  health(): Promise<HealthStatus>;
  discoverCapabilities(): Promise<string[]>;
  
  execute(capabilityId: string, payload: RawPayload, idempotencyKey: string, cancellationToken?: string): Promise<RawResponse>;
  poll(transactionId: string): Promise<RawResponse>;
  cancel(transactionId: string): Promise<boolean>;
  
  normalize(rawResponse: RawResponse, capabilityId: string): CanonicalModel;
  evaluateRateLimit(response: RawResponse): RateLimitStatus;
  mapError(rawError: any): CanonicalRuntimeError;
  
  shutdown(): Promise<void>;
}
