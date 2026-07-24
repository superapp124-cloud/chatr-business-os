import { BaseRepository } from './BaseRepository';

export interface ContactRecord {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  avatarUrl?: string;
  company?: string;
  role?: string;
  lastContactedAt?: string;
  isFavorite: boolean;
}

export class ContactRepository extends BaseRepository<ContactRecord> {
  constructor() {
    super('contacts');
  }

  protected initializeTable(): void {
    this.execute(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phoneNumber TEXT,
        email TEXT,
        avatarUrl TEXT,
        company TEXT,
        role TEXT,
        lastContactedAt TEXT,
        isFavorite INTEGER DEFAULT 0
      )
    `);
  }

  private mapRowToRecord(row: any): ContactRecord {
    return {
      ...row,
      isFavorite: Boolean(row.isFavorite)
    };
  }

  public findById(id: string): ContactRecord | undefined {
    const row = this.queryOne(`SELECT * FROM contacts WHERE id = ?`, [id]);
    return row ? this.mapRowToRecord(row) : undefined;
  }

  public findAll(): ContactRecord[] {
    const rows = this.queryAll(`SELECT * FROM contacts ORDER BY name ASC`);
    return rows.map(this.mapRowToRecord);
  }

  public getFavorites(): ContactRecord[] {
    const rows = this.queryAll(`SELECT * FROM contacts WHERE isFavorite = 1 ORDER BY name ASC`);
    return rows.map(this.mapRowToRecord);
  }

  public save(item: ContactRecord): void {
    this.execute(`
      INSERT INTO contacts (id, name, phoneNumber, email, avatarUrl, company, role, lastContactedAt, isFavorite)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        phoneNumber=excluded.phoneNumber,
        email=excluded.email,
        avatarUrl=excluded.avatarUrl,
        company=excluded.company,
        role=excluded.role,
        lastContactedAt=excluded.lastContactedAt,
        isFavorite=excluded.isFavorite
    `, [
      item.id, item.name, item.phoneNumber, item.email, item.avatarUrl, 
      item.company, item.role, item.lastContactedAt, item.isFavorite ? 1 : 0
    ]);
  }

  public delete(id: string): void {
    this.execute(`DELETE FROM contacts WHERE id = ?`, [id]);
  }
}

export const contactRepository = new ContactRepository();
