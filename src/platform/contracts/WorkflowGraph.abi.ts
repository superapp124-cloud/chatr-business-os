/**
 * WorkflowGraph ABI — v1.0.0 — FROZEN
 *
 * This is the canonical workflow graph contract.
 * All consumers (Studio, AI Builder, Runtime, Publish, Templates, Industry Packs)
 * must use this type. Do NOT extend or modify without a formal ADR revision.
 *
 * ADR: docs/ADR/ADR-006-workflow-graph-abi.md
 */

// ─── Node position on the visual canvas ───────────────────────────────────────

export interface NodePosition {
  x: number;
  y: number;
}

// ─── A single node in the workflow ────────────────────────────────────────────

export interface WorkflowNode {
  /** Stable unique identifier within this graph */
  id: string;
  /** Registered node type string (must exist in NodeRegistry) */
  type: string;
  /** Human-readable label */
  label: string;
  /** Node configuration. Shape is validated by NodeDefinition.inputSchema */
  config: Record<string, unknown>;
  /** Visual position on the canvas (stored, not synthesized) */
  position: NodePosition;
}

// ─── A directed edge connecting two nodes ─────────────────────────────────────

export interface WorkflowEdge {
  /** Stable unique identifier within this graph */
  id: string;
  /** Source node id */
  source: string;
  /** Target node id */
  target: string;
  /** Optional label shown on the edge (e.g. "true" / "false" for condition branches) */
  label?: string;
  /** Optional condition expression for conditional routing */
  condition?: string;
}

// ─── A workflow-scoped variable ────────────────────────────────────────────────

export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  defaultValue?: unknown;
  description?: string;
  /** If true, the variable is expected to be injected at run-start */
  isInput?: boolean;
  /** If true, the variable is exposed as a workflow output */
  isOutput?: boolean;
}

// ─── Per-workflow permission entry ────────────────────────────────────────────

export interface WorkflowPermission {
  /** Role or user id this permission applies to */
  principal: string;
  principalType: 'user' | 'role' | 'team';
  /** Allowed actions on this workflow */
  actions: Array<'read' | 'edit' | 'run' | 'publish' | 'approve' | 'audit'>;
}

// ─── Execution hints stored with the graph ────────────────────────────────────

export interface WorkflowExecutionHints {
  /** Default retry count applied to every node unless overridden */
  defaultRetry: number;
  /** Default per-node timeout in milliseconds */
  defaultTimeoutMs: number;
  /** Execution queue priority (higher = earlier) */
  defaultPriority: number;
}

// ─── Lifecycle status of a workflow definition ────────────────────────────────

export type WorkflowLifecycleStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'archived';

// ─── Metadata envelope ────────────────────────────────────────────────────────

export interface WorkflowMetadata {
  /** Supabase table: business_workflows.status */
  status: WorkflowLifecycleStatus;
  /** Multi-tenant scope. Maps to business_workflows.tenant_id */
  tenantId?: string;
  /** Supabase auth user id of the workflow owner */
  createdBy: string;
  /** ISO-8601 */
  createdAt: string;
  /** ISO-8601 */
  updatedAt: string;
  /** Foreign key to workflow_versions.id for the currently active published version */
  activeVersionId?: string;
  /** Optional description */
  description?: string;
  /** Arbitrary tags for filtering */
  tags?: string[];
}

// ─── The canonical workflow graph object ──────────────────────────────────────

export interface WorkflowGraph {
  /**
   * Semver of this ABI schema.
   * Used by GraphMigration to upgrade older saved graphs.
   */
  schemaVersion: '1.0.0';
  /** Stable workflow identifier (business_workflows.id) */
  id: string;
  /** Human-readable workflow name */
  name: string;
  /** All nodes in the graph */
  nodes: WorkflowNode[];
  /** All directed edges. MUST be persisted. Never synthesized at runtime. */
  edges: WorkflowEdge[];
  /** Workflow-scoped variables available to all nodes */
  variables: WorkflowVariable[];
  /**
   * Canvas layout: node id → position.
   * Authoritative source for visual positions.
   * Never regenerate positions from node order — always use this map.
   */
  layout: Record<string, NodePosition>;
  metadata: WorkflowMetadata;
  permissions: WorkflowPermission[];
  executionHints: WorkflowExecutionHints;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimum valid graph with defaults applied */
export function createEmptyWorkflowGraph(
  id: string,
  name: string,
  createdBy: string,
  tenantId?: string,
): WorkflowGraph {
  const now = new Date().toISOString();
  return {
    schemaVersion: '1.0.0',
    id,
    name,
    nodes: [],
    edges: [],
    variables: [],
    layout: {},
    metadata: {
      status: 'draft',
      tenantId,
      createdBy,
      createdAt: now,
      updatedAt: now,
    },
    permissions: [],
    executionHints: {
      defaultRetry: 3,
      defaultTimeoutMs: 30_000,
      defaultPriority: 5,
    },
  };
}
