import { describe, it, expect, vi } from 'vitest';
import { VersionStore } from '../../src/platform/execution/VersionStore';
import { IVersionRepository } from '../../src/platform/execution/IVersionRepository';
import { WorkflowManifest } from '../../src/platform/contracts/WorkflowManifest.abi';
import { WorkflowGraph } from '../../src/platform/contracts/WorkflowGraph.abi';

describe('Phase C: Enterprise Lifecycle', () => {
  describe('VersionStore', () => {
    it('publishes an immutable manifest through the pipeline', async () => {
      const mockGraph: WorkflowGraph = {
        schemaVersion: '1.0.0',
        id: 'wf-1',
        name: 'Test Flow',
        nodes: [],
        edges: [],
        variables: [],
        layout: {},
        metadata: {
          status: 'active',
          createdBy: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        permissions: [],
        executionHints: { defaultRetry: 0, defaultTimeoutMs: 1000, defaultPriority: 1 }
      };

      const mockRepo: IVersionRepository = {
        insert: vi.fn().mockResolvedValue(undefined),
        getById: vi.fn(),
        list: vi.fn(),
        getLatestVersionNumber: vi.fn().mockResolvedValue(4),
        getActive: vi.fn(),
        setActiveVersion: vi.fn().mockResolvedValue(undefined),
        updateStatus: vi.fn(),
      };

      const store = new VersionStore(mockRepo);

      const manifest = await store.publish({
        workflowId: 'wf-1',
        graph: mockGraph,
        semver: '1.2.0',
        changeSummary: 'Bug fixes',
        publishedBy: 'user-1'
      });

      // Assert monotonically increasing version
      expect(manifest.versionNumber).toBe(5);
      expect(manifest.semver).toBe('1.2.0');
      
      // Assert ABI version metadata
      expect(manifest.runtimeVersion).toBe('1.0.0');
      expect(manifest.abiVersion).toBe('1.0.0');
      expect(manifest.plannerVersion).toBe('1.0.0');
      
      // Assert graph and checksum isolation
      expect(manifest.graph).toEqual(mockGraph);
      expect(manifest.graphChecksum).toMatch(/^sha256-.+/);

      // Assert repository was called correctly
      expect(mockRepo.insert).toHaveBeenCalledWith(manifest);
      expect(mockRepo.setActiveVersion).toHaveBeenCalledWith('wf-1', manifest.versionId);
    });

    it('returns the active version correctly', async () => {
      const mockManifest = { versionId: 'v-999' } as WorkflowManifest;
      const mockRepo: IVersionRepository = {
        insert: vi.fn(),
        getById: vi.fn(),
        list: vi.fn(),
        getLatestVersionNumber: vi.fn(),
        getActive: vi.fn().mockResolvedValue(mockManifest),
        setActiveVersion: vi.fn(),
        updateStatus: vi.fn(),
      };

      const store = new VersionStore(mockRepo);
      const active = await store.getActive('wf-1');
      
      expect(active).toEqual(mockManifest);
      expect(mockRepo.getActive).toHaveBeenCalledWith('wf-1');
    });
  });
});
