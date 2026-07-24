/**
 * WorkflowPackage ABI — v1.0.0 — FROZEN
 *
 * The portable distribution unit for workflows.
 * A WorkflowPackage can be exported from one CHATR instance and imported into another.
 * It is also the canonical export format, import format, and backup/restore format.
 * It is the unit of distribution for the marketplace (Phase E.5).
 *
 * ADR: docs/ADR/ADR-017-workflow-package-abi.md
 */

import type { WorkflowGraph } from './WorkflowGraph.abi';
import type { WorkflowManifest } from './WorkflowManifest.abi';
import type { WorkflowPermission } from './WorkflowGraph.abi';
import type { PolicyContract } from './PolicyContract.abi';

// ─── A runnable test case bundled with the workflow ───────────────────────────

export interface WorkflowTestCase {
  /** Human-readable test name */
  name: string;
  /** What this test validates */
  description: string;
  /** Trigger payload to inject at run-start */
  triggerPayload: Record<string, unknown>;
  /** Input variables for the run */
  inputVariables: Record<string, unknown>;
  /** Expected outcome */
  expectedOutcome: 'success' | 'failure';
  /** Expected output assertions — partial match against ExecutionResult.nodeSummaries */
  assertions: Array<{
    nodeId: string;
    expectedStatus: 'success' | 'failed' | 'skipped';
    expectedOutputContains?: Record<string, unknown>;
  }>;
}

// ─── The workflow package ─────────────────────────────────────────────────────

export interface WorkflowPackage {
  /**
   * Semver of this package format.
   * Used by PackLoader to detect format changes across versions.
   */
  schemaVersion: '1.0.0';

  /** Stable workflow identifier */
  id: string;

  /** Human-readable workflow name */
  name: string;

  /** Short description of what this workflow does */
  description: string;

  /**
   * The canonical workflow graph.
   * Must be valid against WorkflowGraph.schemaVersion.
   */
  graph: WorkflowGraph;

  /**
   * The published manifest, if this package was created from a published version.
   * Optional: present for published exports, absent for draft exports.
   */
  manifest?: WorkflowManifest;

  /** Permissions to apply when this package is imported */
  permissions: WorkflowPermission[];

  /** Policies bundled with this package */
  policies: PolicyContract[];

  /** Runnable integration tests for this workflow */
  tests: WorkflowTestCase[];

  /** Human-readable documentation for this workflow */
  readme: string;

  /**
   * SHA-256 of the canonical JSON serialisation of this package
   * (computed with 'checksum' and 'signature' fields set to empty string).
   * Used to verify the package has not been tampered with.
   */
  checksum: string;

  /**
   * Optional: base64-encoded digital signature of the checksum.
   * Signed by the publisher's key, verified by PackVerifier.
   */
  signature?: string;

  /** ISO-8601 timestamp of when this package was exported */
  exportedAt: string;

  /** The CHATR version that exported this package */
  exportedBy: string;
}

// ─── PackManifest: the descriptor used by the marketplace ────────────────────

export interface PackManifest {
  /** Semver of this pack manifest format */
  schemaVersion: '1.0.0';

  /** Unique stable pack identifier. Example: 'chatr.recruitment-pack' */
  packId: string;

  /** Human-readable pack name */
  name: string;

  /** Short description */
  description: string;

  /** Semver of this pack version */
  version: string;

  /** Node types this pack registers */
  providesNodes: string[];

  /** Provider ids this pack registers */
  providesProviders: string[];

  /** Workflow template packages included in this pack */
  templates: WorkflowPackage[];

  /** Policies this pack installs */
  policies: PolicyContract[];

  /** Capability ids this pack requires to be present in the target instance */
  requiresCapabilities: string[];

  /** Permission scopes this pack requires */
  requiresPermissions: string[];

  /** AI prompts bundled with this pack */
  aiPrompts?: Array<{ name: string; template: string }>;

  /** Knowledge base references (document ids or URLs) */
  knowledgeRefs?: string[];

  /** Human-readable documentation */
  readme: string;

  /** SHA-256 of the canonical package JSON */
  checksum: string;

  /** Optional publisher signature */
  signature?: string;

  /** ISO-8601 publish timestamp */
  publishedAt: string;

  /** Publisher identifier */
  publishedBy: string;
}
