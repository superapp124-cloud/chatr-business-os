const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

class ExecutionMemory {
  constructor() {
    const dataDir = process.env.CHATR_DATA_DIR || path.join(os.tmpdir(), '.chatr');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const dbPath = path.join(dataDir, 'execution-memory.sqlite');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    
    this._initSchema();
  }

  _initSchema() {
    const stmt = this.db.prepare(`
      CREATE TABLE IF NOT EXISTS execution_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        capability_id TEXT,
        provider_id TEXT,
        transport TEXT,
        latency_ms INTEGER,
        success INTEGER,
        confidence REAL,
        executed_at INTEGER
      )
    `);
    stmt.run();
  }

  recordExecution(capabilityId, providerId, transport, latencyMs, success, confidence) {
    const stmt = this.db.prepare(`
      INSERT INTO execution_memory (
        capability_id, provider_id, transport, latency_ms, 
        success, confidence, executed_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?
      )
    `);
    
    stmt.run(
      capabilityId, 
      providerId, 
      transport, 
      latencyMs, 
      success ? 1 : 0, 
      confidence, 
      Date.now()
    );
  }

  getOptimalRouting(capabilityId) {
    const stmt = this.db.prepare(`
      SELECT 
        provider_id,
        transport,
        AVG(success) as success_rate,
        AVG(latency_ms) as avg_latency
      FROM execution_memory
      WHERE capability_id = ?
      GROUP BY provider_id, transport
      ORDER BY success_rate DESC, avg_latency ASC
    `);
    
    return stmt.all(capabilityId);
  }
}

const executionMemory = new ExecutionMemory();

module.exports = {
  ExecutionMemory,
  executionMemory
};
