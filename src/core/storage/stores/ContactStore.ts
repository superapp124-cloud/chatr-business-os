import { BaseStore, BaseEntity } from './BaseStore';

export interface ContactEntity extends BaseEntity {
  providerId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  company?: string;
  title?: string;
}

export class ContactStore extends BaseStore<ContactEntity> {
  constructor() {
    super('contacts');
  }

  public async initializeSchema(): Promise<void> {
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        provider_version TEXT,
        sync_version TEXT,
        checksum TEXT,
        
        provider_id TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        avatar_url TEXT,
        company TEXT,
        title TEXT
      )
    `);
  }

  protected mapRowToEntity(row: any): ContactEntity {
    return {
      id: row.id,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      providerVersion: row.provider_version,
      syncVersion: row.sync_version,
      checksum: row.checksum,
      
      providerId: row.provider_id,
      name: row.name,
      email: row.email,
      avatarUrl: row.avatar_url,
      company: row.company,
      title: row.title
    };
  }

  protected mapEntityToRow(entity: ContactEntity): Record<string, any> {
    return {
      id: entity.id,
      version: entity.version,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      provider_version: entity.providerVersion,
      sync_version: entity.syncVersion,
      checksum: entity.checksum,
      
      provider_id: entity.providerId,
      name: entity.name,
      email: entity.email,
      avatar_url: entity.avatarUrl,
      company: entity.company,
      title: entity.title
    };
  }
}

export const contactStore = new ContactStore();
