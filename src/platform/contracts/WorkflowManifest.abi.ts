/**
 * WorkflowManifest ABI — v1.0.0 — FROZEN
 *
 * The publishable artifact produced when a workflow version is published.
 * A WorkflowManifest is immutable after creation.
 * It is stored in workflow_versions and referenced by workflow_runs.
 *
 * ADR: docs/ADR/ADR-012-workflow-manifest-abi.md
 */

import type { WorkflowGraph } from './WorkflowGraph.abi';

// ─── Immutable published version manifest ─────────────────────────────────────

export interface WorkflowManifest {
  /**
   * Semver of this manifest format.
   * Used by consumers to detect format changes.
   */
  schemaVersion: '1.0.0';

  /** Corresponds to workflow_versions.id */
  versionId: string;

  /** Corresponds to business_workflows.id */
  workflowId: string;

  /** Semver of this workflow version. Example: '1.3.0' */
  semver: string;

  /** Monotonically increasing integer version number */
  versionNumber: number;

  /** Human-readable summary of what changed in this version */
  changeSummary: string;

  /** Optional extended release notes */
  notes?: string;

  /** Supabase auth user id of the publisher */
  publishedBy: string;

  /** ISO-8601 publish timestamp */
  publishedAt: string;

  /** Tenant scope */
  tenantId?: string;

  /** The immutable snapshot of the workflow graph at publish time. */
  graph: WorkflowGraph;

  /** SHA-256 of the canonical JSON serialization of graph. */
  graphChecksum: string;
  
  /** Architecture compatibility snapshot for long-term auditability */
  runtimeVersion: string;
  abiVersion: string;
  plannerVersion: string;
  graphSchemaVersion: string;

  /**
   * Lifecycle status of this version.
   * Only 'published' versions can be executed in production.
   */
  status: 'draft' | 'published' | 'deprecated' | 'yanked';
}

// ─── VersionStore contract ────────────────────────────────────────────────────

export interface IVersionStore {
  /**
   * Publish a new version of a workflow.
   * Computes graphChecksum, assigns versionNumber, and writes to workflow_versions.
   * Returns the created WorkflowManifest.
   */
  publish(params: {
    workflowId: string;
    graph: WorkflowGraph;
    semver: string;
    changeSummary: string;
    publishedBy: string;
    notes?: string;
    tenantId?: string;
  }): Promise<WorkflowManifest>;

  /**
   * Retrieve a specific version manifest.
   */
  get(versionId: string): Promise<WorkflowManifest | null>;

  /**
   * List all version manifests for a workflow, newest first.
   */
  list(workflowId: string): Promise<WorkflowManifest[]>;

  /**
   * Get the currently active published version for a workflow.
   */
  getActive(workflowId: string): Promise<WorkflowManifest | null>;

  /**
   * Deprecate or yank a version. Never deletes — manifests are immutable records.
   */
  updateStatus(versionId: string, status: 'deprecated' | 'yanked'): Promise<void>;
}
