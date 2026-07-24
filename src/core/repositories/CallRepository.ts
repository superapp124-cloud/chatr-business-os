import { BaseRepository } from './BaseRepository';

export interface CallRecord {
  id: string;
  contactId: string;
  name: string;
  phoneNumber: string;
  type: 'incoming' | 'outgoing' | 'missed';
  timestamp: string;
  durationSeconds?: number;
  status: 'completed' | 'failed' | 'rejected' | 'voicemail';
  aiSummary?: string;
  transcriptPath?: string;
}

export class CallRepository extends BaseRepository<CallRecord> {
  constructor() {
    super('calls');
  }

  protected initializeTable(): void {
    this.execute(`
      CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY,
        contactId TEXT,
        name TEXT,
        phoneNumber TEXT,
        type TEXT,
        timestamp TEXT,
        durationSeconds INTEGER,
        status TEXT,
        aiSummary TEXT,
        transcriptPath TEXT
      )
    `);
  }

  public findById(id: string): CallRecord | undefined {
    return this.queryOne<CallRecord>(`SELECT * FROM calls WHERE id = ?`, [id]);
  }

  public findAll(): CallRecord[] {
    return this.queryAll<CallRecord>(`SELECT * FROM calls ORDER BY timestamp DESC`);
  }

  public save(item: CallRecord): void {
    this.execute(`
      INSERT INTO calls (id, contactId, name, phoneNumber, type, timestamp, durationSeconds, status, aiSummary, transcriptPath)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        contactId=excluded.contactId,
        name=excluded.name,
        phoneNumber=excluded.phoneNumber,
        type=excluded.type,
        timestamp=excluded.timestamp,
        durationSeconds=excluded.durationSeconds,
        status=excluded.status,
        aiSummary=excluded.aiSummary,
        transcriptPath=excluded.transcriptPath
    `, [
      item.id, item.contactId, item.name, item.phoneNumber, item.type, item.timestamp, 
      item.durationSeconds, item.status, item.aiSummary, item.transcriptPath
    ]);
  }

  public delete(id: string): void {
    this.execute(`DELETE FROM calls WHERE id = ?`, [id]);
  }
}

export const callRepository = new CallRepository();
