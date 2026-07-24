/**
 * NodeDefinition ABI — v1.0.0 — FROZEN
 *
 * The contract every workflow node must implement.
 * NodeRegistry accepts only implementations conforming to this interface.
 * Adding a new node type requires ONLY implementing this interface and calling
 * NodeRegistry.register() — no other file changes are permitted.
 *
 * ADR: docs/ADR/ADR-009-node-definition-abi.md
 */

import type { ExecutionContext } from './ExecutionContext.abi';

// ─── JSON Schema (subset) used for input/output schemas ───────────────────────

export type JSONSchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';

export interface JSONSchema {
  type?: JSONSchemaType | JSONSchemaType[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: unknown[];
  description?: string;
  default?: unknown;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  additionalProperties?: boolean | JSONSchema;
}

// ─── Manifest: human-readable metadata about the node ────────────────────────

export interface NodeManifest {
  /** Unique node type string. Example: 'core.email', 'crm.create_contact' */
  type: string;
  /** Display name shown in the Studio add-node menu */
  label: string;
  /** Short description shown in the UI */
  description: string;
  /** Icon identifier (maps to icon component in the UI layer) */
  icon: string;
  /** Category for grouping in the add-node menu */
  category:
    | 'trigger'
    | 'action'
    | 'condition'
    | 'ai'
    | 'approval'
    | 'communication'
    | 'data'
    | 'integration'
    | 'utility'
    | 'logic'
    | 'custom';
  /**
   * Permissions required by this node to execute (e.g. ['provider.ai']).
   * Must be explicitly granted to the package containing this node.
   */
  requiredPermissions?: string[];
  /** Semver of this node definition */
  version: string;
  /** Whether this node is available in the add-node menu */
  isAddable: boolean;
  /** Tags for search and filtering */
  tags?: string[];
  /** Pack that provides this node, if any */
  packId?: string;
}

// ─── UI contract: what configuration fields to render ────────────────────────

export type NodeUIFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'secret_ref'
  | 'expression'
  | 'json'
  | 'url'
  | 'email';

export interface NodeUIField {
  key: string;
  label: string;
  type: NodeUIFieldType;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  helperText?: string;
  /** If type is 'secret_ref', the UI renders a secret picker */
  secretScope?: string;
}

export interface NodeUIContract {
  /** Ordered list of configuration fields to render in the node config panel */
  fields: NodeUIField[];
}

// ─── Validation result ────────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ─── Executor result ─────────────────────────────────────────────────────────

export interface NodeResult {
  /** Structured output data written to ExecutionContext.nodeOutputs */
  output: Record<string, unknown>;
  /** Optional: the capability and provider that handled this execution */
  capabilityId?: string;
  providerUsed?: string;
  /** Optional: AI-specific fields */
  tokensUsed?: number;
  costUsd?: number;
}

// ─── Policy hint: requirements the runtime evaluates before execution ─────────

export interface PolicyHint {
  /** The policy type to evaluate */
  policyType: 'rate_limit' | 'approval_required' | 'secret_required' | 'tenant_scope' | 'allowlist';
  /** Human-readable description of the requirement */
  description: string;
  /** Whether this hint is enforced (true) or advisory (false) */
  enforced: boolean;
}

// ─── Permission requirement ───────────────────────────────────────────────────

export interface CapabilityPermission {
  /** The capability this node requires */
  capabilityId: string;
  /** Required permission level */
  requiredLevel: 'read' | 'write' | 'admin';
}

// ─── Test case for the node ───────────────────────────────────────────────────

export interface NodeTestCase {
  name: string;
  description: string;
  inputConfig: Record<string, unknown>;
  mockContext: Partial<ExecutionContext>;
  expectedOutput: Partial<NodeResult>;
  expectFailure?: boolean;
}

// ─── The NodeDefinition contract ──────────────────────────────────────────────

export interface NodeDefinition {
  /** Must match manifest.type */
  type: string;

  /** Human-readable metadata */
  manifest: NodeManifest;

  /**
   * JSON Schema for the node's configuration fields.
   * GraphValidator uses this to check config before execution.
   * ExecutionPlanner uses this to verify inter-node compatibility.
   */
  inputSchema: JSONSchema;

  /**
   * JSON Schema for the node's output.
   * Downstream nodes can validate against this.
   */
  outputSchema: JSONSchema;

  /** Defines which configuration fields to render in the node config panel */
  uiContract: NodeUIContract;

  /**
   * Validates a node's configuration object.
   * Called by GraphValidator before run and before publish.
   * Must return errors for any missing required fields or invalid values.
   */
  validate(config: Record<string, unknown>): ValidationResult;

  /**
   * Pre-compiles expensive operations (e.g. parsing templates, validating SQL, AST parsing).
   * Called by ExecutionPlanner before runtime.
   */
  compile?(config: Record<string, unknown>): Promise<void>;

  /**
   * Capabilities this node requires to execute.
   * Example: ['chatr.ai.generate']
   * The ProviderResolver maps these capabilities to active providers at runtime.
   */
  capabilities: string[];

  /**
   * Executes the node.
   * Receives the full ExecutionContext. Must not mutate it directly —
   * the runtime writes the result to context.nodeOutputs after this resolves.
   * Secrets are already resolved in context.secrets before this is called.
   */
  execute(
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeResult>;

  /**
   * Serializes the node into a compiled task form used by ExecutionPlanner.
   * The default implementation is usually sufficient for most nodes.
   */
  serialize(nodeId: string, config: Record<string, unknown>): {
    type: string;
    data: Record<string, unknown>;
    retry: number;
    timeoutMs: number;
  };

  /** Capability permissions required to execute this node */
  permissions: CapabilityPermission[];

  /** Policy hints the runtime evaluates before executing this node */
  policies: PolicyHint[];

  /** Test cases for this node — run by the node SDK test harness */
  tests: NodeTestCase[];
}
