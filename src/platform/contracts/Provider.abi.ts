/**
 * Provider ABI — v1.0.0 — FROZEN
 *
 * The contract every capability provider must implement.
 * A Provider handles how a capability executes against a specific external service.
 * The workflow never knows which provider runs a capability — ProviderResolver decides.
 *
 * Example: capability 'send.email' → providers: smtp, ses, sendgrid, gmail, outlook
 *
 * ADR: docs/ADR/ADR-010-provider-abi.md
 */

import type { ExecutionContext } from './ExecutionContext.abi';

// ─── Auth strategies ──────────────────────────────────────────────────────────

export type ProviderAuthStrategy =
  | 'api_key'
  | 'oauth2'
  | 'basic'
  | 'bearer_token'
  | 'service_account'
  | 'session_cookie'
  | 'none';

// ─── Error taxonomy ───────────────────────────────────────────────────────────

export type ProviderErrorCode =
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'PROVIDER_UNAVAILABLE'
  | 'TIMEOUT'
  | 'UNKNOWN';

export interface ProviderError {
  code: ProviderErrorCode;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
}

// ─── Provider execution result ────────────────────────────────────────────────

export interface ProviderResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: ProviderError;
  /** Wall-clock latency for this provider call */
  latencyMs: number;
  /** Name of the provider that handled the call */
  providerName: string;
  /** Whether idempotency was applied */
  idempotent?: boolean;
}

// ─── Rate limit metadata ──────────────────────────────────────────────────────

export interface ProviderRateLimit {
  /** Requests allowed per window */
  requestsPerWindow: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Whether the provider supports burst */
  burstAllowed: boolean;
}

// ─── Audit metadata the provider contributes ─────────────────────────────────

export interface ProviderAuditMetadata {
  /** Whether this provider call must be logged in audit_logs */
  mustAudit: boolean;
  /** Whether the request payload should be included in the audit log */
  includePayload: boolean;
  /** Whether the response should be included in the audit log */
  includeResponse: boolean;
}

// ─── Test connection result ───────────────────────────────────────────────────

export interface ProviderConnectionTest {
  connected: boolean;
  latencyMs: number;
  errorMessage?: string;
}

// ─── The Provider Manifest ────────────────────────────────────────────────────

export interface ProviderManifest {
  /** Unique provider identifier. Example: 'sendgrid', 'ses', 'smtp' */
  providerId: string;

  /** Human-readable display name */
  name: string;
  
  /** Semver */
  version: string;
  
  /** Organization that maintains the provider */
  vendor: string;

  /** Which capabilities this provider can handle */
  capabilities: string[];

  /** How this provider authenticates */
  authStrategy: ProviderAuthStrategy;

  /** JSON Schema of the configuration required for this provider */
  configurationSchema: Record<string, any>;

  /** Rate limit metadata — used by ExecutionScheduler */
  rateLimit?: ProviderRateLimit;
}

// ─── The Provider contract ────────────────────────────────────────────────────

export interface IProvider {
  /** The manifest describing this provider */
  manifest: ProviderManifest;

  /** Audit metadata — used by AuditStore */
  auditMetadata: ProviderAuditMetadata;

  /** Whether this provider supports idempotency keys */
  supportsIdempotency: boolean;

  /** Whether this provider supports webhook-based result delivery */
  supportsWebhook: boolean;

  /**
   * Execute the capability.
   * Receives the node config and the full ExecutionContext (including resolved secrets).
   * Must not read secrets from any source other than context.secrets.
   */
  execute(
    capabilityId: string,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<ProviderResult>;

  /**
   * Test connectivity and auth without performing a real action.
   * Used by the Studio "Test Connection" button and health checks.
   */
  healthCheck(context: ExecutionContext): Promise<ProviderConnectionTest>;

  /**
   * Returns the error taxonomy for this provider.
   * Used by ExecutionScheduler to decide retry behaviour.
   */
  classifyError(rawError: unknown): ProviderError;
}
