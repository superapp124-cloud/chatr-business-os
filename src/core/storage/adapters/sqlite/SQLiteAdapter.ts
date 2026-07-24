import { IStorageAdapter } from '../../contracts/StorageContracts';
import Database from 'better-sqlite3'; // This will be imported dynamically or provided by the runtime

export class SQLiteAdapter implements IStorageAdapter {
  private db: any;

  constructor(dbPath: string = ':memory:') {
    // Gracefully handle missing native bindings during UI development/mocking
    try {
      const sqlite = require('better-sqlite3');
      this.db = sqlite(dbPath);
      this.db.pragma('journal_mode = WAL');
    } catch (err) {
      console.warn('[SQLiteAdapter] Native better-sqlite3 not found. Operating in stub mode.');
      this.db = null;
    }
  }

  public async transaction<T>(action: () => Promise<T>): Promise<T> {
    if (!this.db) return action();
    const execute = this.db.transaction(action);
    return execute();
  }

  public async get(collection: string, id: string): Promise<any> {
    if (!this.db) return null;
    const stmt = this.db.prepare(`SELECT data FROM ${collection} WHERE id = ?`);
    const row = stmt.get(id);
    return row ? JSON.parse(row.data) : null;
  }

  public async query(collection: string, filter: any): Promise<any[]> {
    if (!this.db) return [];
    // Basic implementation: filtering logic is shifted to SQL
    // A robust version would translate filter objects to SQL WHERE clauses.
    const stmt = this.db.prepare(`SELECT data FROM ${collection}`);
    const rows = stmt.all();
    return rows.map((r: any) => JSON.parse(r.data));
  }

  public async search(collection: string, fullTextQuery: string): Promise<any[]> {
    if (!this.db) return [];
    const stmt = this.db.prepare(`
      SELECT data FROM ${collection} 
      JOIN ${collection}_fts ON ${collection}.rowid = ${collection}_fts.rowid
      WHERE ${collection}_fts MATCH ?
    `);
    const rows = stmt.all(fullTextQuery);
    return rows.map((r: any) => JSON.parse(r.data));
  }

  public async insert(collection: string, record: any): Promise<void> {
    if (!this.db) return;
    const stmt = this.db.prepare(`INSERT INTO ${collection} (id, data) VALUES (?, ?)`);
    stmt.run(record.id, JSON.stringify(record));
  }

  public async update(collection: string, id: string, delta: any): Promise<void> {
    if (!this.db) return;
    // For JSON support, we fetch, merge, and update.
    const current = await this.get(collection, id);
    if (!current) throw new Error(`Record ${id} not found in ${collection}`);
    const merged = { ...current, ...delta };
    const stmt = this.db.prepare(`UPDATE ${collection} SET data = ? WHERE id = ?`);
    stmt.run(JSON.stringify(merged), id);
  }

  public async softDelete(collection: string, id: string): Promise<void> {
    if (!this.db) return;
    const stmt = this.db.prepare(`UPDATE ${collection} SET deleted_at = ? WHERE id = ?`);
    stmt.run(Date.now(), id);
  }

  public async getSnapshot(collection: string, id: string, timestamp: number): Promise<any> {
    if (!this.db) return null;
    // Requires a snapshot history table to be maintained
    const stmt = this.db.prepare(`SELECT snapshot_data FROM snapshots WHERE collection = ? AND record_id = ? AND timestamp <= ? ORDER BY timestamp DESC LIMIT 1`);
    const row = stmt.get(collection, id, timestamp);
    return row ? JSON.parse(row.snapshot_data) : null;
  }

  public async executeRaw(sql: string, params: any[] = []): Promise<void> {
    if (!this.db) return;
    const stmt = this.db.prepare(sql);
    stmt.run(...params);
  }
}
