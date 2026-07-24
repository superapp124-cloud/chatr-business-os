const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

class DocumentDatabase {
  constructor() {
    const dataDir = path.join(os.homedir(), '.chatr', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, 'document_index.db');
    this.db = new Database(dbPath);
    this.initSchema();
  }

  initSchema() {
    this.db.pragma('journal_mode = WAL');
    
    // Core document metadata table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        path TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        extension TEXT,
        size INTEGER,
        mime_type TEXT,
        created_at TEXT,
        modified_at TEXT,
        owner TEXT,
        language TEXT,
        hash TEXT,
        indexed_timestamp TEXT,
        parser_version TEXT,
        parsing_status TEXT,
        source TEXT,
        embedding_id TEXT,
        chunk_count INTEGER,
        vector_status TEXT
      );
    `);

    // Full-Text Search virtual table for fast queries
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
        name,
        path,
        content='documents',
        content_rowid='rowid'
      );
    `);

    // Triggers to keep FTS table in sync
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
        INSERT INTO documents_fts(rowid, name, path) VALUES (new.rowid, new.name, new.path);
      END;
      CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, name, path) VALUES('delete', old.rowid, old.name, old.path);
      END;
      CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, name, path) VALUES('delete', old.rowid, old.name, old.path);
        INSERT INTO documents_fts(rowid, name, path) VALUES (new.rowid, new.name, new.path);
      END;
    `);
  }

  upsertDocument(doc) {
    const stmt = this.db.prepare(`
      INSERT INTO documents (
        id, path, name, extension, size, mime_type, 
        created_at, modified_at, owner, language, hash, 
        indexed_timestamp, parser_version, parsing_status, 
        source, embedding_id, chunk_count, vector_status
      ) VALUES (
        @id, @path, @name, @extension, @size, @mime_type, 
        @created_at, @modified_at, @owner, @language, @hash, 
        @indexed_timestamp, @parser_version, @parsing_status, 
        @source, @embedding_id, @chunk_count, @vector_status
      )
      ON CONFLICT(path) DO UPDATE SET
        name = excluded.name,
        size = excluded.size,
        modified_at = excluded.modified_at,
        indexed_timestamp = excluded.indexed_timestamp,
        parsing_status = excluded.parsing_status
    `);
    stmt.run(doc);
  }

  search(query, limit = 20) {
    // If query is empty, just return recent documents
    if (!query || query.trim() === '') {
      return this.getAll(limit);
    }
    
    // SQLite FTS5 matching on prefix
    // E.g. "resume" -> "resume*"
    const safeQuery = query.replace(/"/g, '""');
    const matchStr = `"${safeQuery}"*`;
    
    try {
      const stmt = this.db.prepare(`
        SELECT d.* FROM documents d
        JOIN documents_fts fts ON d.rowid = fts.rowid
        WHERE documents_fts MATCH @query
        ORDER BY rank
        LIMIT @limit
      `);
      return stmt.all({ query: matchStr, limit });
    } catch (err) {
      console.warn('[Database] FTS search failed, falling back to LIKE:', err.message);
      const stmt = this.db.prepare(`
        SELECT * FROM documents
        WHERE name LIKE @query OR path LIKE @query
        LIMIT @limit
      `);
      return stmt.all({ query: `%${query}%`, limit });
    }
  }

  getAll(limit = 100) {
    const stmt = this.db.prepare(`SELECT * FROM documents ORDER BY modified_at DESC LIMIT ?`);
    return stmt.all(limit);
  }
}

module.exports = new DocumentDatabase();
