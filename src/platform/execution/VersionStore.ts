import { IVersionStore } from '../contracts/WorkflowManifest.abi';
import type { WorkflowManifest } from '../contracts/WorkflowManifest.abi';
import type { WorkflowGraph } from '../contracts/WorkflowGraph.abi';
import { IVersionRepository } from './IVersionRepository';

export class VersionStore implements IVersionStore {
  constructor(private readonly repository: IVersionRepository) {}

  async publish(params: {
    workflowId: string;
    graph: WorkflowGraph;
    semver: string;
    changeSummary: string;
    publishedBy: string;
    notes?: string;
    tenantId?: string;
  }): Promise<WorkflowManifest> {
    
    // 1. Determine next version number
    const latestNum = await this.repository.getLatestVersionNumber(params.workflowId);
    const nextNum = latestNum + 1;

    // 2. Canonical Checksum (mocked implementation for Phase C)
    // In a real crypto implementation, we would canonical-stringify the graph and hash it.
    const graphString = JSON.stringify(params.graph);
    const checksum = `sha256-${Buffer.from(graphString).toString('base64').substring(0, 32)}`;

    // 3. Construct the immutable manifest
    const manifest: WorkflowManifest = {
      schemaVersion: '1.0.0',
      versionId: crypto.randomUUID(),
      workflowId: params.workflowId,
      semver: params.semver,
      versionNumber: nextNum,
      changeSummary: params.changeSummary,
      notes: params.notes,
      publishedBy: params.publishedBy,
      publishedAt: new Date().toISOString(),
      tenantId: params.tenantId,
      graph: params.graph,
      graphChecksum: checksum,
      runtimeVersion: '1.0.0',
      abiVersion: '1.0.0',
      plannerVersion: '1.0.0',
      graphSchemaVersion: params.graph.schemaVersion,
      status: 'published'
    };

    // 4. Save to Repository (Append only)
    await this.repository.insert(manifest);

    // 5. Update the Active Version pointer
    await this.repository.setActiveVersion(params.workflowId, manifest.versionId);

    return manifest;
  }

  async get(versionId: string): Promise<WorkflowManifest | null> {
    return this.repository.getById(versionId);
  }

  async list(workflowId: string): Promise<WorkflowManifest[]> {
    return this.repository.list(workflowId);
  }

  async getActive(workflowId: string): Promise<WorkflowManifest | null> {
    return this.repository.getActive(workflowId);
  }

  async updateStatus(versionId: string, status: 'deprecated' | 'yanked'): Promise<void> {
    return this.repository.updateStatus(versionId, status);
  }
}
