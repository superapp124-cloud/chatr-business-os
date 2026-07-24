import type { WorkflowManifest } from '../contracts/WorkflowManifest.abi';

export interface IVersionRepository {
  /**
   * Save a newly published manifest to the database.
   * This is an append-only operation.
   */
  insert(manifest: WorkflowManifest): Promise<void>;

  /**
   * Retrieve a specific version by its ID.
   */
  getById(versionId: string): Promise<WorkflowManifest | null>;

  /**
   * List all manifests for a workflow, sorted descending by version number.
   */
  list(workflowId: string): Promise<WorkflowManifest[]>;

  /**
   * Retrieve the highest version number currently published for a workflow.
   * Used to monotonically increase the version number.
   */
  getLatestVersionNumber(workflowId: string): Promise<number>;

  /**
   * Fetch the currently active published version for a workflow.
   * Joins business_workflows.active_version_id with workflow_versions.
   */
  getActive(workflowId: string): Promise<WorkflowManifest | null>;

  /**
   * Update the active version pointer for a workflow.
   */
  setActiveVersion(workflowId: string, versionId: string): Promise<void>;
  
  /**
   * Update the status of an existing version (e.g. deprecate/yank).
   */
  updateStatus(versionId: string, status: 'deprecated' | 'yanked'): Promise<void>;
}
