import { BaseStore, BaseEntity } from './BaseStore';

export interface ActivityEntity extends BaseEntity {
  providerId: string;
  type: string;       // 'email', 'message', 'event'
  title: string;
  preview: string;
  authorId?: string;
  timestamp: number;
  metadata: any;      // JSON string in DB
}

export class ActivityStore extends BaseStore<ActivityEntity> {
  constructor() {
    super('activities');
  }

  public async initializeSchema(): Promise<void> {
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        provider_version TEXT,
        sync_version TEXT,
        checksum TEXT,
        
        provider_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT,
        preview TEXT,
        author_id TEXT,
        timestamp INTEGER NOT NULL,
        metadata TEXT
      )
    `);
  }

  protected mapRowToEntity(row: any): ActivityEntity {
    return {
      id: row.id,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      providerVersion: row.provider_version,
      syncVersion: row.sync_version,
      checksum: row.checksum,
      
      providerId: row.provider_id,
      type: row.type,
      title: row.title,
      preview: row.preview,
      authorId: row.author_id,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    };
  }

  protected mapEntityToRow(entity: ActivityEntity): Record<string, any> {
    return {
      id: entity.id,
      version: entity.version,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      provider_version: entity.providerVersion,
      sync_version: entity.syncVersion,
      checksum: entity.checksum,
      
      provider_id: entity.providerId,
      type: entity.type,
      title: entity.title,
      preview: entity.preview,
      author_id: entity.authorId,
      timestamp: entity.timestamp,
      metadata: entity.metadata ? JSON.stringify(entity.metadata) : null
    };
  }
}

export const activityStore = new ActivityStore();
