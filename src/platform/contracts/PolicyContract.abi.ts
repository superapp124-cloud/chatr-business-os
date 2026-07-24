/**
 * PolicyContract ABI — v1.0.0 — FROZEN
 *
 * The contract the runtime queries before executing a node.
 * Maps to the org_policies Supabase table.
 * Used by: LifecycleService, ExecutionRuntime, NodeExecutor.
 *
 * ADR: docs/ADR/ADR-016-policy-contract-abi.md
 */

// ─── Policy scope ─────────────────────────────────────────────────────────────

export type PolicyScope =
  | 'tenant'      // Applies to all workflows in the tenant
  | 'workspace'   // Applies to a specific workspace
  | 'workflow'    // Applies to a specific workflow
  | 'node'        // Applies to a specific node type
  | 'capability'; // Applies to a specific capability

// ─── Rule types ───────────────────────────────────────────────────────────────

export type PolicyRuleType =
  | 'rate_limit'          // Limit execution frequency
  | 'approval_required'   // Require human approval before execution
  | 'allowlist'           // Only allow listed values (domains, tables, etc.)
  | 'denylist'            // Block listed values
  | 'cost_budget'         // Limit AI cost per run
  | 'token_budget'        // Limit AI tokens per run
  | 'data_classification' // Enforce data handling rules
  | 'time_restriction'    // Only allow execution in certain time windows
  | 'tenant_isolation';   // Enforce strict tenant data boundaries

// ─── Enforcement modes ────────────────────────────────────────────────────────

export type PolicyEnforcementMode =
  | 'enforce'  // Block the action if policy is violated
  | 'warn'     // Log a warning but allow the action
  | 'audit';   // Log only — no blocking

// ─── The policy condition ─────────────────────────────────────────────────────

export interface PolicyCondition {
  /** The field path to evaluate. Example: 'node.config.url', 'run.triggeredBy' */
  field: string;
  /** Operator */
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'regex' | 'greater_than' | 'less_than';
  /** The value to compare against */
  value: unknown;
}

// ─── The policy contract ──────────────────────────────────────────────────────

export interface PolicyContract {
  /** Unique policy identifier. Corresponds to org_policies.id */
  policyId: string;

  /** Human-readable name */
  name: string;

  /** Optional description */
  description?: string;

  /** Tenant this policy belongs to */
  tenantId: string;

  /** The scope at which this policy applies */
  scope: PolicyScope;

  /**
   * Optional: the specific resource id this policy scopes to.
   * For scope 'workflow', this is the workflow id.
   * For scope 'capability', this is the capability id.
   */
  scopeResourceId?: string;

  /** The rule type */
  ruleType: PolicyRuleType;

  /** Conditions that must all be true for this policy to apply */
  conditions: PolicyCondition[];

  /** What to do when the policy applies */
  enforcementMode: PolicyEnforcementMode;

  /**
   * For 'approval_required' rule type: the approval group to route to.
   * Must correspond to an entry in workflow_approvals.assigned_roles.
   */
  approvalGroup?: string;

  /** Rate limit parameters for 'rate_limit' rule type */
  rateLimit?: {
    maxExecutions: number;
    windowSeconds: number;
  };

  /** Budget parameters for 'cost_budget' and 'token_budget' rule types */
  budget?: {
    maxValue: number;
    currency?: 'USD';
  };

  /** Allowlist / denylist values for the relevant rule types */
  listValues?: string[];

  /** Priority — higher number = evaluated first */
  priority: number;

  /** Whether this policy is currently active */
  enabled: boolean;
}

// ─── Policy evaluation result ─────────────────────────────────────────────────

export interface PolicyEvaluationResult {
  policyId: string;
  applied: boolean;
  outcome: 'allow' | 'deny' | 'require_approval' | 'warn';
  reason?: string;
}

// ─── PolicyEngine contract ────────────────────────────────────────────────────

export interface IPolicyEngine {
  /**
   * Evaluate all applicable policies for a given execution context.
   * Called by ExecutionRuntime before each node is executed.
   * Returns the list of policy evaluation results.
   * If any result has outcome 'deny', execution must be blocked.
   */
  evaluate(params: {
    tenantId?: string;
    workflowId: string;
    nodeType: string;
    capabilityId?: string;
    context: Record<string, unknown>;
  }): Promise<PolicyEvaluationResult[]>;
}
