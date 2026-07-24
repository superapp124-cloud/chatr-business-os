import { IStorageAdapter } from '../contracts/StorageContracts';

export class SnapshotManager {
  constructor(private db: IStorageAdapter) {}

  public async createSnapshot(collection: string, id: string): Promise<void> {
    const data = await this.db.get(collection, id);
    if (!data) throw new Error(`Cannot snapshot missing record ${id} in ${collection}`);
    
    await this.db.executeRaw(
      `INSERT INTO snapshots (snapshotId, collection, record_id, timestamp, snapshot_data) VALUES (?, ?, ?, ?, ?)`,
      [`snap_${Date.now()}_${id}`, collection, id, Date.now(), JSON.stringify(data)]
    );
  }

  public async rollback(collection: string, id: string, timestamp: number): Promise<void> {
    const historical = await this.db.getSnapshot(collection, id, timestamp);
    if (!historical) throw new Error(`No snapshot found for ${id} before ${timestamp}`);
    
    await this.db.update(collection, id, historical);
  }
}
