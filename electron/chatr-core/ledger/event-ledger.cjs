'use strict';

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');

class EventLedger {
  constructor() {
    const dataDir = process.env.CHATR_DATA_DIR || path.join(process.env.APPDATA || process.env.HOME || os.tmpdir(), '.chatr');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'event-ledger.sqlite');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    this._initializeTable();

    this.statements = {
      insert: this.db.prepare(`
        INSERT INTO event_ledger (event_id, event_type, payload, correlation_id, causation_id, recorded_at, checksum)
        VALUES (@event_id, @event_type, @payload, @correlation_id, @causation_id, @recorded_at, @checksum)
      `),
      replayAll: this.db.prepare(`SELECT * FROM event_ledger WHERE sequence_no >= ? ORDER BY sequence_no ASC`),
      replayCorrelation: this.db.prepare(`SELECT * FROM event_ledger WHERE correlation_id = ? ORDER BY sequence_no ASC`),
      getLatestSeq: this.db.prepare(`SELECT MAX(sequence_no) as max_seq FROM event_ledger`),
      getEntryById: this.db.prepare(`SELECT * FROM event_ledger WHERE event_id = ?`),
      countTotal: this.db.prepare(`SELECT COUNT(*) as total FROM event_ledger`),
      countByType: this.db.prepare(`SELECT event_type, COUNT(*) as count FROM event_ledger GROUP BY event_type`)
    };
  }

  _initializeTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS event_ledger (
        sequence_no INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        correlation_id TEXT,
        causation_id TEXT,
        recorded_at INTEGER NOT NULL,
        checksum TEXT NOT NULL
      ) STRICT;
    `);
  }

  _generateId() {
    return crypto.randomUUID();
  }

  _computeChecksum(event_id, event_type, payload, recorded_at) {
    const hash = crypto.createHash('sha256');
    hash.update(`${event_id}${event_type}${payload}${recorded_at}`);
    return hash.digest('hex');
  }

  append(eventType, payload, options = {}) {
    const event_id = this._generateId();
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const recorded_at = Date.now();
    const correlation_id = options.correlation_id || null;
    const causation_id = options.causation_id || null;

    const checksum = this._computeChecksum(event_id, eventType, payloadStr, recorded_at);

    const info = this.statements.insert.run({
      event_id,
      event_type: eventType,
      payload: payloadStr,
      correlation_id,
      causation_id,
      recorded_at,
      checksum
    });

    return {
      sequence_no: info.lastInsertRowid,
      event_id,
      event_type: eventType,
      payload: payloadStr,
      correlation_id,
      causation_id,
      recorded_at,
      checksum
    };
  }

  replay(fromSequence = 0) {
    return this.statements.replayAll.all(fromSequence);
  }

  replayForCorrelation(correlationId) {
    return this.statements.replayCorrelation.all(correlationId);
  }

  getLatestSequence() {
    const row = this.statements.getLatestSeq.get();
    return row && row.max_seq ? row.max_seq : 0;
  }

  getEntry(eventId) {
    return this.statements.getEntryById.get(eventId) || null;
  }

  verifyChecksum(entry) {
    if (!entry) return false;
    const recomputed = this._computeChecksum(entry.event_id, entry.event_type, entry.payload, entry.recorded_at);
    return recomputed === entry.checksum;
  }

  getMetrics() {
    const totalRow = this.statements.countTotal.get();
    const typeRows = this.statements.countByType.all();
    
    const byEventType = {};
    for (const row of typeRows) {
      byEventType[row.event_type] = row.count;
    }

    return {
      totalEvents: totalRow ? totalRow.total : 0,
      byEventType,
      latestSequence: this.getLatestSequence()
    };
  }
}

const ledger = new EventLedger();

module.exports = { EventLedger, ledger };
