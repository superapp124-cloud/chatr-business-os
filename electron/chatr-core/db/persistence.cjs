'use strict';

/**
 * Persistence Interface (Wave 2 - SQLite Edition)
 * 
 * Defines the strict boundary between CHATR Core and storage.
 * All modules use this generic interface without knowing SQLite is underneath.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

class PersistenceInterface {
  constructor() {
    // 1. Determine safe directory for SQLite
    const isTest = process.env.NODE_ENV === 'test';
    this.baseDir = process.env.CHATR_DATA_DIR || 
      (isTest ? require('os').tmpdir() : path.join(process.env.APPDATA || process.env.HOME || '', '.chatr'));
      
    if (!fs.existsSync(this.baseDir)) {
      try {
        fs.mkdirSync(this.baseDir, { recursive: true });
      } catch (err) {
        console.warn(`[Persistence] Failed to create data dir ${this.baseDir}, falling back to temp`, err.message);
        this.baseDir = require('os').tmpdir();
      }
    }

    this.dbPath = path.join(this.baseDir, 'chatr.db');
    
    try {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this._initializeSchema();
    } catch (err) {
      console.warn('[Persistence] Database init failed, attempting recovery:', err.message);
      
      // Close corrupted connection if open
      if (this.db) {
        try { this.db.close(); } catch (e) {}
      }
      
      // Try to physically delete corrupted DB, but fallback if sandboxed
      try {
        if (fs.existsSync(this.dbPath)) {
          fs.unlinkSync(this.dbPath);
        }
        if (fs.existsSync(this.dbPath + '-wal')) {
          fs.unlinkSync(this.dbPath + '-wal');
        }
        if (fs.existsSync(this.dbPath + '-shm')) {
          fs.unlinkSync(this.dbPath + '-shm');
        }
        this.db = new Database(this.dbPath);
      } catch (unlinkErr) {
        console.error('[Persistence] Failed to delete corrupted db or create new one. Sandboxed? Falling back to in-memory.', unlinkErr.message);
        try {
            this.db = new Database(':memory:');
        } catch (memErr) {
            console.error('[Persistence] CRITICAL: Failed to load sqlite3 binary (ABI mismatch?). Using mock DB.', memErr.message);
            this.db = {
                pragma: () => {},
                exec: () => {},
                prepare: () => ({ get: () => ({}), all: () => [], run: () => {} })
            };
        }
      }
      
      this.db.pragma('journal_mode = WAL');
      this._initializeSchema();
    }
  }

  _initializeSchema() {
    this.db.exec(`
      -- Generic Key-Value store for context & core state
      CREATE TABLE IF NOT EXISTS kv_store (
        collection TEXT PRIMARY KEY,
        data JSON NOT NULL
      );

      -- Immutable Intent Journal
      CREATE TABLE IF NOT EXISTS policy_evaluations (
        id TEXT PRIMARY KEY,
        intent_id TEXT NOT NULL,
        policy_id TEXT NOT NULL,
        policy_version TEXT NOT NULL,
        matched BOOLEAN NOT NULL,
        constraints_satisfied BOOLEAN NOT NULL,
        authorization_state TEXT NOT NULL,
        confidence REAL,
        reasons JSON,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS lifecycle_checkpoints (
        id TEXT PRIMARY KEY,
        intent_id TEXT NOT NULL,
        before_phase TEXT NOT NULL,
        before_condition TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        after_phase TEXT NOT NULL,
        after_condition TEXT NOT NULL,
        transition_reason TEXT NOT NULL,
        decision_id TEXT,
        kernel_version TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS kernel_decisions (
        id TEXT PRIMARY KEY,
        intent_id TEXT NOT NULL,
        trigger TEXT NOT NULL,
        inputs JSON,
        chosen_outcome TEXT NOT NULL,
        kernel_version TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS execution_outcomes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt INTEGER DEFAULT 1,
        started_at DATETIME,
        completed_at DATETIME,
        duration INTEGER,
        correlation_id TEXT NOT NULL,
        causation_id TEXT NOT NULL,
        cost REAL,
        confidence REAL,
        artifacts JSON,
        metadata JSON,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS execution_plans (
        id TEXT PRIMARY KEY,
        graph_version TEXT NOT NULL,
        planner_version TEXT NOT NULL,
        capabilities JSON NOT NULL,
        dependencies JSON NOT NULL,
        parallel_groups JSON,
        estimated_cost REAL,
        estimated_duration INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS planner_reports (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        resolved_capabilities JSON,
        warnings JSON,
        optimization_decisions JSON,
        unresolved_references JSON,
        estimated_complexity INTEGER,
        compilation_time_ms INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS compilation_certificates (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        graph_hash TEXT NOT NULL,
        ir_hash TEXT NOT NULL,
        execution_plan_hash TEXT NOT NULL,
        planner_version TEXT NOT NULL,
        validation_status TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS governance_decisions (
        id TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL,
        resource_version TEXT NOT NULL,
        policy TEXT NOT NULL,
        decision TEXT NOT NULL,
        approver_id TEXT NOT NULL,
        approver_type TEXT NOT NULL,
        reason TEXT,
        signature TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        principal_id TEXT NOT NULL,
        principal_type TEXT NOT NULL,
        action TEXT NOT NULL,
        resource_id TEXT,
        resource_type TEXT,
        details JSON,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS journal (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_name TEXT NOT NULL,
        document JSON NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Universal Schema Pattern for all Capabilities
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        source_conversation_id TEXT NOT NULL,
        source_message_id TEXT,
        created_by TEXT DEFAULT 'system',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending',
        metadata JSON
      );

      CREATE TABLE IF NOT EXISTS meetings (
        id TEXT PRIMARY KEY,
        source_conversation_id TEXT NOT NULL,
        source_message_id TEXT,
        created_by TEXT DEFAULT 'system',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending',
        metadata JSON
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        source_conversation_id TEXT NOT NULL,
        source_message_id TEXT,
        created_by TEXT DEFAULT 'system',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active',
        metadata JSON
      );

      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        source_conversation_id TEXT NOT NULL,
        source_message_id TEXT,
        created_by TEXT DEFAULT 'system',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active',
        metadata JSON
      );

      -- Intent OS Architecture (Stage 2)
      CREATE TABLE IF NOT EXISTS stewarded_intents (
        id TEXT PRIMARY KEY,
        intent_type TEXT NOT NULL,
        phase TEXT NOT NULL,
        condition TEXT NOT NULL,
        data JSON NOT NULL,
        next_wake DATETIME,
        sleep_until DATETIME,
        expires DATETIME,
        renews DATETIME,
        last_activity DATETIME,
        idle_duration INTEGER,
        sla TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS intent_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        intent_id TEXT NOT NULL,
        phase TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload JSON,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(intent_id) REFERENCES stewarded_intents(id)
      );

      CREATE TABLE IF NOT EXISTS verification_obligations (
        id TEXT PRIMARY KEY,
        intent_id TEXT NOT NULL,
        execution_id TEXT NOT NULL,
        strategy TEXT NOT NULL,
        strategy_version TEXT NOT NULL,
        required_evidence JSON NOT NULL,
        timeout TEXT,
        retry_policy JSON,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS verification_evidence (
        id TEXT PRIMARY KEY,
        obligation_id TEXT NOT NULL,
        source TEXT NOT NULL,
        type TEXT NOT NULL,
        confidence REAL,
        correlation_id TEXT NOT NULL,
        payload JSON NOT NULL,
        checksum TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(obligation_id) REFERENCES verification_obligations(id)
      );

      CREATE TABLE IF NOT EXISTS policy_configs (
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        applies_to TEXT NOT NULL,
        config_data JSON NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  /**
   * Save a full JSON object (Overwrite)
   */
  store(collection, data) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO kv_store (collection, data) 
        VALUES (@collection, @data) 
        ON CONFLICT(collection) DO UPDATE SET data = @data
      `);
      stmt.run({ collection, data: JSON.stringify(data) });
      return true;
    } catch (e) {
      console.error(`[Persistence] store failed for ${collection}:`, e.message);
      return false;
    }
  }

  /**
   * Retrieve a full JSON object
   */
  retrieve(collection) {
    try {
      const stmt = this.db.prepare(`SELECT data FROM kv_store WHERE collection = ?`);
      const row = stmt.get(collection);
      if (!row) return null;
      return JSON.parse(row.data);
    } catch (e) {
      console.error(`[Persistence] retrieve failed for ${collection}:`, e.message);
      return null;
    }
  }

  /**
   * Append to a collection (Journal)
   */
  append(collection, entry) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO journal (collection, data) 
        VALUES (@collection, @data)
      `);
      stmt.run({ collection, data: JSON.stringify(entry) });
      return true;
    } catch (e) {
      console.error(`[Persistence] append failed for ${collection}:`, e.message);
      return false;
    }
  }

  /**
   * Flush/truncate a collection
   */
  flush(collection) {
    try {
      const deleteKv = this.db.prepare(`DELETE FROM kv_store WHERE collection = ?`);
      deleteKv.run(collection);
      
      const deleteJournal = this.db.prepare(`DELETE FROM journal WHERE collection = ?`);
      deleteJournal.run(collection);
      return true;
    } catch (e) {
      console.error(`[Persistence] flush failed for ${collection}:`, e.message);
      return false;
    }
  }

  // --- Relational APIs for specific Modules (Wave 2) ---
  
  insertRecord(tableName, record) {
    try {
      const keys = Object.keys(record);
      const placeholders = keys.map(k => `@${k}`).join(', ');
      const cols = keys.join(', ');
      
      const stmt = this.db.prepare(`INSERT INTO ${tableName} (${cols}) VALUES (${placeholders})`);
      stmt.run(record);
      return true;
    } catch (e) {
      console.error(`[Persistence] insertRecord failed for ${tableName}:`, e.message);
      return false;
    }
  }
}

module.exports = new PersistenceInterface();
