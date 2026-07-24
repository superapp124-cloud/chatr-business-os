const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

class CapabilityCatalog {
  constructor() {
    const dataDir = process.env.CHATR_DATA_DIR || path.join(os.tmpdir(), '.chatr');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const dbPath = path.join(dataDir, 'capability-catalog.sqlite');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    
    this._initSchema();
  }

  _initSchema() {
    const stmt = this.db.prepare(`
      CREATE TABLE IF NOT EXISTS catalog (
        id TEXT PRIMARY KEY,
        provider_id TEXT,
        registry TEXT,
        version TEXT,
        signature_status TEXT,
        certification_status TEXT,
        risk_score INTEGER,
        transports TEXT,
        permissions TEXT,
        health_status TEXT,
        created_at INTEGER
      ) STRICT
    `);
    stmt.run();
  }

  registerCapability(cap) {
    const stmt = this.db.prepare(`
      INSERT INTO catalog (
        id, provider_id, registry, version, signature_status, 
        certification_status, risk_score, transports, permissions, 
        health_status, created_at
      ) VALUES (
        @id, @provider_id, @registry, @version, @signature_status,
        @certification_status, @risk_score, @transports, @permissions,
        @health_status, @created_at
      )
      ON CONFLICT(id) DO UPDATE SET
        provider_id = excluded.provider_id,
        registry = excluded.registry,
        version = excluded.version,
        signature_status = excluded.signature_status,
        certification_status = excluded.certification_status,
        risk_score = excluded.risk_score,
        transports = excluded.transports,
        permissions = excluded.permissions,
        health_status = excluded.health_status
    `);
    
    stmt.run({
      id: cap.id,
      provider_id: cap.providerId,
      registry: cap.registry || null,
      version: cap.version || null,
      signature_status: cap.signatureStatus || null,
      certification_status: cap.certificationStatus || null,
      risk_score: cap.riskScore || 0,
      transports: cap.transports ? JSON.stringify(cap.transports) : '[]',
      permissions: cap.permissions ? JSON.stringify(cap.permissions) : '{}',
      health_status: cap.healthStatus || 'unknown',
      created_at: cap.createdAt || Date.now()
    });
  }

  getProvidersForCapability(capId) {
    const stmt = this.db.prepare(`SELECT provider_id FROM catalog WHERE id = ?`);
    const results = stmt.all(capId);
    return results.map(row => row.provider_id);
  }

  updateCertification(providerId, status) {
    const stmt = this.db.prepare(`
      UPDATE catalog 
      SET certification_status = ? 
      WHERE provider_id = ?
    `);
    stmt.run(status, providerId);
  }

  getProvider(providerId) {
    const stmt = this.db.prepare(`
      SELECT * FROM catalog WHERE provider_id = ?
    `);
    const results = stmt.all(providerId);
    return results.map(row => ({
      ...row,
      transports: JSON.parse(row.transports),
      permissions: JSON.parse(row.permissions)
    }));
  }
}

const capabilityCatalog = new CapabilityCatalog();

module.exports = {
  CapabilityCatalog,
  capabilityCatalog
};
