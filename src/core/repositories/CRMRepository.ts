import { BaseRepository } from './BaseRepository';

export interface ActivityRecord {
  id: string;
  type: string; // 'email', 'call', 'meeting', 'note'
  title: string;
  description: string;
  timestamp: string;
  contactId?: string;
  relatedEntityId?: string; // e.g. an invoice ID
}

export class CRMRepository extends BaseRepository<ActivityRecord> {
  constructor() {
    super('crm_activities');
  }

  protected initializeTable(): void {
    this.execute(`
      CREATE TABLE IF NOT EXISTS crm_activities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        timestamp TEXT NOT NULL,
        contactId TEXT,
        relatedEntityId TEXT
      )
    `);
  }

  public findById(id: string): ActivityRecord | undefined {
    return this.queryOne<ActivityRecord>(`SELECT * FROM crm_activities WHERE id = ?`, [id]);
  }

  public findAll(): ActivityRecord[] {
    return this.queryAll<ActivityRecord>(`SELECT * FROM crm_activities ORDER BY timestamp DESC`);
  }

  public findByContactId(contactId: string): ActivityRecord[] {
    return this.queryAll<ActivityRecord>(`SELECT * FROM crm_activities WHERE contactId = ? ORDER BY timestamp DESC`, [contactId]);
  }

  public save(item: ActivityRecord): void {
    this.execute(`
      INSERT INTO crm_activities (id, type, title, description, timestamp, contactId, relatedEntityId)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type=excluded.type,
        title=excluded.title,
        description=excluded.description,
        timestamp=excluded.timestamp,
        contactId=excluded.contactId,
        relatedEntityId=excluded.relatedEntityId
    `, [
      item.id, item.type, item.title, item.description, item.timestamp, item.contactId, item.relatedEntityId
    ]);
  }

  public delete(id: string): void {
    this.execute(`DELETE FROM crm_activities WHERE id = ?`, [id]);
  }
}

export const crmRepository = new CRMRepository();
