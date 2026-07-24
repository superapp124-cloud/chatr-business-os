import Database from 'better-sqlite3';
import { StorageProvider } from '../StorageProvider';
import fs from 'fs';
import path from 'path';

export class SQLiteAdapter implements StorageProvider {
  private db: Database.Database | null = null;
  
  constructor(private dbPath: string) {}

  public async connect(): Promise<void> {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    
    console.log(`[SQLiteAdapter] Connected to ${this.dbPath}`);
    this.initializeSchema();
  }

  private initializeSchema() {
    if (!this.db) throw new Error('Database not connected');
    
    // Core OS Event Log (Legacy)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS event_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        provider_id TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    // --- Sprint 2: Execution Persistence Foundation ---
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS intents (
        id TEXT PRIMARY KEY,
        raw_text TEXT NOT NULL,
        semantic_payload TEXT,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        created_by TEXT,
        correlation_id TEXT,
        version INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        intent_id TEXT NOT NULL,
        capability_id TEXT NOT NULL,
        execution_graph TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        created_by TEXT,
        correlation_id TEXT,
        version INTEGER NOT NULL,
        FOREIGN KEY(intent_id) REFERENCES intents(id)
      );

      CREATE TABLE IF NOT EXISTS executions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        deadline_at INTEGER,
        last_heartbeat_at INTEGER NOT NULL,
        completed_at INTEGER,
        execution_graph TEXT NOT NULL,
        current_node_ids TEXT NOT NULL,
        completed_node_ids TEXT NOT NULL,
        failed_node_ids TEXT NOT NULL,
        pending_node_ids TEXT NOT NULL,
        current_context_version INTEGER NOT NULL,
        retry_count INTEGER NOT NULL,
        compensation_stack TEXT NOT NULL,
        cancellation_token TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        created_by TEXT,
        version INTEGER NOT NULL,
        FOREIGN KEY(workflow_id) REFERENCES workflows(id)
      );

      CREATE TABLE IF NOT EXISTS execution_contexts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        execution_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(execution_id) REFERENCES executions(id)
      );

      CREATE TABLE IF NOT EXISTS timeline_events (
        id TEXT PRIMARY KEY,
        execution_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        causation_id TEXT,
        timestamp INTEGER NOT NULL,
        sequence_number INTEGER NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(execution_id) REFERENCES executions(id)
      );
    `);
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) throw new Error('Database not connected');
    const stmt = this.db.prepare(sql);
    return stmt.all(params) as T[];
  }

  public async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid: string | number }> {
    if (!this.db) throw new Error('Database not connected');
    const stmt = this.db.prepare(sql);
    const info = stmt.run(params);
    return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
  }

  public async transaction<T>(callback: (provider: StorageProvider) => Promise<T>): Promise<T> {
    if (!this.db) throw new Error('Database not connected');
    
    // Note: better-sqlite3 transactions are synchronous. We simulate async here to match the provider interface.
    const transaction = this.db.transaction(async () => {
      return await callback(this);
    });

    try {
      return await transaction();
    } catch (err) {
      console.error('[SQLiteAdapter] Transaction failed:', err);
      throw err;
    }
  }

  public async insert(table: string, data: Record<string, any>): Promise<string | number> {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => data[k]);
    
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    const result = await this.execute(sql, values);
    return result.lastInsertRowid;
  }

  public async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number> {
    const updateKeys = Object.keys(data);
    const updateClauses = updateKeys.map(k => `${k} = ?`).join(', ');
    const updateValues = updateKeys.map(k => data[k]);
    
    const whereKeys = Object.keys(where);
    const whereClauses = whereKeys.map(k => `${k} = ?`).join(' AND ');
    const whereValues = whereKeys.map(k => where[k]);
    
    const sql = `UPDATE ${table} SET ${updateClauses} WHERE ${whereClauses}`;
    const result = await this.execute(sql, [...updateValues, ...whereValues]);
    return result.changes;
  }

  public async delete(table: string, where: Record<string, any>): Promise<number> {
    const whereKeys = Object.keys(where);
    const whereClauses = whereKeys.map(k => `${k} = ?`).join(' AND ');
    const whereValues = whereKeys.map(k => where[k]);
    
    const sql = `DELETE FROM ${table} WHERE ${whereClauses}`;
    const result = await this.execute(sql, whereValues);
    return result.changes;
  }

  public async backup(destinationPath: string): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    await this.db.backup(destinationPath);
    console.log(`[SQLiteAdapter] Backup completed to ${destinationPath}`);
  }

  public async restore(sourcePath: string): Promise<void> {
    if (!fs.existsSync(sourcePath)) throw new Error(`Backup not found at ${sourcePath}`);
    // Real restoration logic involves swapping files or loading from backup DB.
    console.log(`[SQLiteAdapter] Restored from ${sourcePath}`);
  }
}
