/**
 * Capability ABI — v1.0.0 — FROZEN
 *
 * Links a node type to one or more providers.
 * The workflow node references a capability ID.
 * ProviderResolver selects the active provider for that capability.
 *
 * ADR: docs/ADR/ADR-011-capability-abi.md
 */

import type { JSONSchema } from './NodeDefinition.abi';
import type { CapabilityPermission } from './NodeDefinition.abi';

// ─── Capability definition ────────────────────────────────────────────────────

export interface CapabilityDefinition {
  /**
   * Unique capability identifier. Uses dot-notation namespacing.
   * Examples: 'send.email', 'http.request', 'database.query', 'ai.generate'
   */
  capabilityId: string;

  /** Human-readable name */
  name: string;

  /** Short description */
  description: string;

  /** Category for grouping */
  category: string;

  /**
   * Input schema for this capability.
   * All registered providers for this capability must accept inputs conforming to this schema.
   */
  inputSchema: JSONSchema;

  /**
   * Output schema for this capability.
   * All registered providers for this capability must produce outputs conforming to this schema.
   */
  outputSchema: JSONSchema;

  /**
   * List of provider IDs that can handle this capability.
   * ProviderResolver selects among these based on tenant policy and credential availability.
   */
  supportedProviders: string[];

  /**
   * The default provider to use when no tenant policy specifies otherwise.
   * Must be one of the supportedProviders.
   */
  defaultProviderId: string;

  /** Permission requirements for nodes using this capability */
  permissions: CapabilityPermission[];

  /**
   * Security classification of this capability.
   * 'low': Read-only non-sensitive data
   * 'medium': Standard tenant operations
   * 'high': Sensitive PII, financial, or system-level actions
   * 'critical': Destructive actions
   */
  securityLevel: 'low' | 'medium' | 'high' | 'critical';

  /**
   * Expected cost category for executing this capability.
   * 'free': No marginal cost (e.g., local calculation)
   * 'low': Fractions of a cent (e.g., basic API call)
   * 'medium': Cents (e.g., standard LLM generation)
   * 'high': Dollars (e.g., complex LLM agent, heavy data processing)
   */
  costCategory: 'free' | 'low' | 'medium' | 'high';

  /**
   * If true, this capability's execution is considered sensitive and
   * always requires an audit log entry regardless of node policy hints.
   */
  alwaysAudit: boolean;

  /**
   * If true, the capability supports idempotency.
   * ExecutionScheduler will apply idempotency keys for retries.
   */
  supportsIdempotency: boolean;
}

// ─── CapabilityRegistry contract ─────────────────────────────────────────────

export interface ICapabilityRegistry {
  /**
   * Register a capability definition.
   * Throws if a capability with the same id is already registered.
   */
  register(capability: CapabilityDefinition): void;

  /**
   * Look up a capability by id.
   * Returns undefined if the capability is not registered.
   */
  get(capabilityId: string): CapabilityDefinition | undefined;

  /**
   * List all registered capabilities.
   */
  list(): CapabilityDefinition[];

  /**
   * Check if a capability is registered.
   */
  has(capabilityId: string): boolean;
}
