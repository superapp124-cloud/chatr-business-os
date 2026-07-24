'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const Database = require('better-sqlite3');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class KnowledgeGraph {
  constructor() {
    this.initialized = false;
    this.db = null;
  }

  initialize() {
    if (this.initialized) return;

    try {
      const dataDir = path.join(os.homedir(), '.chatr', 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      const dbPath = path.join(dataDir, 'knowledge_graph.db');
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');

      // Initialize Graph Schema
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS knowledge_nodes (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          label TEXT NOT NULL,
          properties TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS knowledge_edges (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL,
          target_id TEXT NOT NULL,
          relation TEXT NOT NULL,
          properties TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(source_id) REFERENCES knowledge_nodes(id),
          FOREIGN KEY(target_id) REFERENCES knowledge_nodes(id)
        );
      `);

      log.info('[KnowledgeGraph] Initialized Workspace Knowledge Graph Database.');
      this.initialized = true;
    } catch (err) {
      log.error('[KnowledgeGraph] Failed to initialize DB:', err);
    }
  }

  upsertNode(id, type, label, properties = {}) {
    if (!this.initialized) return;
    const stmt = this.db.prepare(`
      INSERT INTO knowledge_nodes (id, type, label, properties, updated_at) 
      VALUES (@id, @type, @label, @properties, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET 
        type = excluded.type,
        label = excluded.label,
        properties = excluded.properties,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run({ id, type, label, properties: JSON.stringify(properties) });
  }

  upsertEdge(id, source_id, target_id, relation, properties = {}) {
    if (!this.initialized) return;
    const stmt = this.db.prepare(`
      INSERT INTO knowledge_edges (id, source_id, target_id, relation, properties) 
      VALUES (@id, @source_id, @target_id, @relation, @properties)
      ON CONFLICT(id) DO UPDATE SET 
        relation = excluded.relation,
        properties = excluded.properties
    `);
    stmt.run({ id, source_id, target_id, relation, properties: JSON.stringify(properties) });
  }
}

module.exports = new KnowledgeGraph();
