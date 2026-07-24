import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Initialize the local SQLite database for the CHATR Workspace
const dbDir = path.join(os.homedir(), 'Documents', 'CHATR Workspace', 'Database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'chatr-local.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency and performance
db.pragma('journal_mode = WAL');

/**
 * BaseRepository defines the generic interface and shared database 
 * connection for all CHATR local structured data repositories.
 */
export abstract class BaseRepository<T extends { id: string }> {
  protected tableName: string;
  protected db: Database.Database;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.db = db;
    this.initializeTable();
  }

  /**
   * Implementations must define their schema and run CREATE TABLE IF NOT EXISTS here.
   */
  protected abstract initializeTable(): void;

  /**
   * Run a query that returns multiple rows.
   */
  protected queryAll<R = T>(sql: string, params: any[] = []): R[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as R[];
  }

  /**
   * Run a query that returns a single row.
   */
  protected queryOne<R = T>(sql: string, params: any[] = []): R | undefined {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params) as R | undefined;
  }

  /**
   * Execute an insert, update, or delete.
   */
  protected execute(sql: string, params: any[] = []): Database.RunResult {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  // --- Common CRUD Interface ---

  public abstract findById(id: string): T | undefined;
  public abstract findAll(): T[];
  public abstract save(item: T): void;
  public abstract delete(id: string): void;
}
