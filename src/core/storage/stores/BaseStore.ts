import { storageEngine } from '../StorageEngine';
import { eventStore } from '../EventStore';
import { StorageProvider } from '../StorageProvider';

export interface BaseEntity {
  id: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  providerVersion?: string;
  syncVersion?: string;
  checksum?: string;
}

export abstract class BaseStore<T extends BaseEntity> {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  protected get db(): StorageProvider {
    return storageEngine.getAdapter();
  }

  public async initializeSchema(): Promise<void> {
    // Override in subclasses to create specific tables
  }

  public async get(id: string): Promise<T | null> {
    const rows = await this.db.query(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);
    if (rows.length === 0) return null;
    return this.mapRowToEntity(rows[0]);
  }

  public async upsert(entity: T, providerId: string): Promise<void> {
    const existing = await this.get(entity.id);
    
    // Append to Event Log BEFORE updating state (Event Sourcing pattern)
    await eventStore.append(
      existing ? `${this.tableName}_updated` : `${this.tableName}_created`,
      entity,
      providerId
    );

    entity.updatedAt = Date.now();
    entity.version = (existing ? existing.version : 0) + 1;
    
    const row = this.mapEntityToRow(entity);

    if (existing) {
      await this.db.update(this.tableName, row, { id: entity.id });
    } else {
      await this.db.insert(this.tableName, row);
    }
  }

  public async delete(id: string, providerId: string): Promise<void> {
    await eventStore.append(`${this.tableName}_deleted`, { id }, providerId);
    await this.db.delete(this.tableName, { id });
  }

  protected abstract mapRowToEntity(row: any): T;
  protected abstract mapEntityToRow(entity: T): Record<string, any>;
}
