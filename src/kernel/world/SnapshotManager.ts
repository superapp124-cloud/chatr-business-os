import { GraphNode, Relationship, WorldState } from './types';

export interface WorldSnapshot {
  version: 1;
  timestamp: number;
  worldVersion: number;
  checksum: string;
  nodes: GraphNode[];
  edges: Relationship[];
  indexes: Record<string, any>;
  metadata: Record<string, any>;
}

/**
 * SnapshotManager implements atomic persistence for the World Model.
 */
export class SnapshotManager {
  private readonly STORAGE_KEY = 'world_snapshot.json';
  private readonly TMP_KEY = 'world_snapshot.json.tmp';

  public async saveSnapshot(state: WorldState, indexes: Record<string, any>): Promise<void> {
    const snapshot: WorldSnapshot = {
      version: 1,
      timestamp: Date.now(),
      worldVersion: state.version,
      nodes: Array.from(state.nodes.values()),
      edges: Array.from(state.edges.values()),
      indexes,
      metadata: {},
      checksum: this._generateChecksum(state.version)
    };

    const serialized = JSON.stringify(snapshot);

    // Atomic write simulation (in a real Node environment, this would be fs.write -> fsync -> fs.rename)
    try {
      // 1. Write to tmp file
      localStorage.setItem(this.TMP_KEY, serialized);
      
      // 2. Fsync (simulation)
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // 3. Rename (atomic replace)
      localStorage.setItem(this.STORAGE_KEY, localStorage.getItem(this.TMP_KEY)!);
      localStorage.removeItem(this.TMP_KEY);
      
      console.log(`[SnapshotManager] Saved snapshot v${snapshot.worldVersion} atomically.`);
    } catch (err) {
      console.error('[SnapshotManager] Failed to save snapshot:', err);
      // Clean up tmp on failure
      localStorage.removeItem(this.TMP_KEY);
      throw err;
    }
  }

  public async loadSnapshot(): Promise<WorldSnapshot | null> {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) return null;

    try {
      const snapshot = JSON.parse(data) as WorldSnapshot;
      this.validateIntegrity(snapshot);
      console.log(`[SnapshotManager] Loaded snapshot v${snapshot.worldVersion}.`);
      return snapshot;
    } catch (err) {
      console.error('[SnapshotManager] Snapshot corruption detected:', err);
      return null; // Force cold boot on corruption
    }
  }

  public validateIntegrity(snapshot: WorldSnapshot): void {
    if (snapshot.version !== 1) {
      throw new Error(`Unsupported snapshot version: ${snapshot.version}`);
    }
    const expectedChecksum = this._generateChecksum(snapshot.worldVersion);
    if (snapshot.checksum !== expectedChecksum) {
      throw new Error(`Checksum mismatch. Expected ${expectedChecksum}, got ${snapshot.checksum}`);
    }
  }

  private _generateChecksum(worldVersion: number): string {
    // Simple checksum for demonstration. Real implementation would hash the entire object.
    return `chk_v1_${worldVersion}_${worldVersion * 17}`;
  }
}

export const snapshotManager = new SnapshotManager();
