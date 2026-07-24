'use strict';

/**
 * CHATR Kernel — Append-Only Event Ledger
 *
 * This is the foundational source of truth for the operating system.
 * All state is built by projecting events stored in this ledger.
 *
 * Characteristics:
 * - Append-only (no updates, no deletes)
 * - Deterministic ordering via global sequence
 * - Replayable per stream or globally
 * - Backed by SQLite for local synchronous durability
 */

const path = require('path');
const fs = require('fs');

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  // Graceful degradation or error if not available, though package.json has better-sqlite3
  Database = null;
  console.error('[Ledger] CRITICAL: better-sqlite3 not found. Event sourcing cannot persist.');
}

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class EventLedger {
  constructor() {
    this._db = null;
    this._initDb();
  }

  _initDb() {
    if (!Database) return;
    
    let dbPath;
    try {
      const { app } = require('electron');
      // If we are in the main process and app is ready
      dbPath = path.join(app.getPath('userData'), 'kernel-ledger.sqlite');
    } catch (e) {
      // Fallback for tests or disconnected scripts
      const dir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      dbPath = path.join(dir, 'kernel-ledger.sqlite');
    }

    try {
      this._db = new Database(dbPath);
      
      // Optimize SQLite for append-heavy write operations
      this._db.pragma('journal_mode = WAL');
      this._db.pragma('synchronous = NORMAL');
      this._db.pragma('temp_store = MEMORY');

      this._db.exec(`
        CREATE TABLE IF NOT EXISTS events (
          global_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id TEXT UNIQUE NOT NULL,
          stream_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          event_version TEXT NOT NULL,
          payload TEXT NOT NULL,
          metadata TEXT NOT NULL,
          correlation_id TEXT,
          causation_id TEXT,
          timestamp_ms INTEGER NOT NULL,
          timestamp DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Index for rebuilding specific streams (e.g., a specific intent or transaction)
        CREATE INDEX IF NOT EXISTS idx_stream_id ON events (stream_id, global_sequence);
        
        -- Index for filtering by event type globally
        CREATE INDEX IF NOT EXISTS idx_event_type ON events (event_type, global_sequence);
        
        -- Snapshots table to optimize projection rebuilds
        CREATE TABLE IF NOT EXISTS snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          projection_name TEXT NOT NULL,
          stream_id TEXT NOT NULL,
          state_json TEXT NOT NULL,
          last_global_sequence INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Index to quickly find the latest snapshot for a given projection + stream
        CREATE INDEX IF NOT EXISTS idx_snapshots_latest ON snapshots (projection_name, stream_id, last_global_sequence DESC);
      `);

      this._insertStmt = this._db.prepare(`
        INSERT INTO events (
          event_id, stream_id, event_type, event_version, 
          payload, metadata, correlation_id, causation_id, 
          timestamp_ms, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      this._readStreamStmt = this._db.prepare(`
        SELECT * FROM events 
        WHERE stream_id = ? 
        ORDER BY global_sequence ASC
      `);
      
      this._readStreamSinceStmt = this._db.prepare(`
        SELECT * FROM events 
        WHERE stream_id = ? AND global_sequence > ?
        ORDER BY global_sequence ASC
      `);
      
      this._readAllStmt = this._db.prepare(`
        SELECT * FROM events 
        ORDER BY global_sequence ASC
      `);
      
      this._readAllSinceStmt = this._db.prepare(`
        SELECT * FROM events 
        WHERE global_sequence > ?
        ORDER BY global_sequence ASC
      `);

      this._insertSnapshotStmt = this._db.prepare(`
        INSERT INTO snapshots (projection_name, stream_id, state_json, last_global_sequence)
        VALUES (?, ?, ?, ?)
      `);

      this._getLatestSnapshotStmt = this._db.prepare(`
        SELECT * FROM snapshots
        WHERE projection_name = ? AND stream_id = ?
        ORDER BY last_global_sequence DESC
        LIMIT 1
      `);

    } catch (err) {
      log.error('[Ledger] Failed to initialize database:', err);
    }
  }

  /**
   * Appends a new event to the ledger.
   * @param {string} streamId - The aggregate ID (e.g. transactionId, intentId)
   * @param {object} envelope - The standardized event envelope from schema.cjs
   */
  append(streamId, envelope) {
    if (!this._db) return;
    
    // Idempotency / Duplicate protection via event_id UNIQUE constraint
    try {
      this._insertStmt.run(
        envelope.event_id,
        streamId,
        envelope.event_type,
        envelope.version || '1.0',
        JSON.stringify(envelope.payload || {}),
        JSON.stringify(envelope.metadata || {}),
        envelope.correlation_id || null,
        envelope.causation_id || null,
        envelope.timestamp_ms,
        envelope.timestamp
      );
    } catch (err) {
      // UNIQUE constraint failed means event is already in ledger (idempotent)
      if (err.code !== 'SQLITE_CONSTRAINT_UNIQUE') {
        log.error(`[Ledger] Failed to append event ${envelope.event_id}:`, err);
        throw err;
      }
    }
  }

  /**
   * Read all events for a specific stream (aggregate).
   * @param {string} streamId 
   * @returns {Array<object>} Array of parsed event envelopes
   */
  readStream(streamId) {
    if (!this._db) return [];
    const rows = this._readStreamStmt.all(streamId);
    return rows.map(this._parseRow);
  }

  /**
   * Read events for a specific stream strictly after a given global sequence.
   */
  readStreamSince(streamId, sequence) {
    if (!this._db) return [];
    const rows = this._readStreamSinceStmt.all(streamId, sequence);
    return rows.map(r => this._parseRow(r));
  }

  /**
   * Replays the entire event ledger from the beginning.
   * Useful for full world-model rebuilds or crash recovery.
   * @returns {Array<object>} Array of parsed event envelopes
   */
  readAll() {
    if (!this._db) return [];
    const rows = this._readAllStmt.all();
    return rows.map(r => this._parseRow(r));
  }

  /**
   * Read all events strictly after a given global sequence.
   */
  readAllSince(sequence) {
    if (!this._db) return [];
    const rows = this._readAllSinceStmt.all(sequence);
    return rows.map(r => this._parseRow(r));
  }

  // --- SNAPSHOTS ---

  /**
   * Save a snapshot of a projection to optimize future rebuilds.
   * @param {string} projectionName - Logical name of the projection (e.g. 'TransactionEngine')
   * @param {string} streamId - Aggregate ID, or '*' for global projections
   * @param {object} state - The current serialized state of the projection
   * @param {number} lastGlobalSequence - The sequence number of the last event applied
   */
  saveSnapshot(projectionName, streamId, state, lastGlobalSequence) {
    if (!this._db) return;
    try {
      this._insertSnapshotStmt.run(projectionName, streamId, JSON.stringify(state), lastGlobalSequence);
    } catch (err) {
      log.error(`[Ledger] Failed to save snapshot for ${projectionName}:${streamId}`, err);
    }
  }

  /**
   * Get the latest snapshot for a given projection.
   * @returns {{ state: object, lastGlobalSequence: number } | null}
   */
  getLatestSnapshot(projectionName, streamId) {
    if (!this._db) return null;
    const row = this._getLatestSnapshotStmt.get(projectionName, streamId);
    if (!row) return null;
    return {
      state: JSON.parse(row.state_json),
      lastGlobalSequence: row.last_global_sequence
    };
  }

  _parseRow(row) {
    return {
      abi: 'chatr.event.v0_9_rc', // Hardcoded fallback for now, align with schema.cjs
      version: row.event_version,
      global_sequence: row.global_sequence,
      event_id: row.event_id,
      event_type: row.event_type,
      timestamp: row.timestamp,
      timestamp_ms: row.timestamp_ms,
      correlation_id: row.correlation_id,
      causation_id: row.causation_id,
      payload: JSON.parse(row.payload),
      metadata: JSON.parse(row.metadata),
      
      // Compatibility fields
      id: row.event_id,
      stage: row.event_type.split('.')[1] || 'unknown',
      correlationId: row.correlation_id,
    };
  }
  
  /**
   * Used strictly for tests
   */
  _clear() {
    if (this._db) {
      this._db.exec('DELETE FROM events; DELETE FROM snapshots;');
    }
  }
}

// Singleton instance
const ledger = new EventLedger();

module.exports = { EventLedger, ledger };
