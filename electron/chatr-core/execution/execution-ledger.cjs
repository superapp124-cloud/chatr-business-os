'use strict';

/**
 * CHATR Kernel — Execution Ledger (Phase 5.1.1)
 *
 * An immutable, append-only record of every execution.
 * Separate from the World Model, which learns patterns.
 * The Ledger remembers facts. The World Model learns habits.
 *
 * Schema per entry:
 *   intentId, workflowId, connectorId, strategy, adapterUsed,
 *   capabilityId, constraintsJson, durationMs, costEstimate,
 *   permissionsUsed, approvalRequired, approvalGranted,
 *   resultSummary, rollbackAvailable, status, logsJson, timestamp
 */

const path = require('path');
const fs   = require('fs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

let Database;
try { Database = require('better-sqlite3'); } catch { Database = null; }

// ── DB Setup ─────────────────────────────────────────────────────────────────

let _db = null;

function _getDb() {
  if (_db) return _db;
  if (!Database) { log.warn('[ExecutionLedger] better-sqlite3 not available — ledger disabled.'); return null; }

  let dbPath;
  try {
    const { app } = require('electron');
    dbPath = path.join(app.getPath('userData'), 'execution-ledger.sqlite');
  } catch {
    const dir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    dbPath = path.join(dir, 'execution-ledger.sqlite');
  }

  _db = new Database(dbPath);

  // Immutable ledger — rows are never updated, only inserted or soft-voided
  _db.exec(`
    CREATE TABLE IF NOT EXISTS execution_ledger (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      intent_id           TEXT NOT NULL,
      workflow_id         TEXT,
      capability_id       TEXT NOT NULL,
      connector_id        TEXT,
      strategy            TEXT,
      adapter_used        TEXT,
      constraints_json    TEXT,
      duration_ms         REAL,
      cost_estimate       REAL DEFAULT 0,
      permissions_used    TEXT,
      approval_required   INTEGER DEFAULT 0,
      approval_granted    INTEGER DEFAULT 0,
      result_summary      TEXT,
      rollback_available  INTEGER DEFAULT 0,
      rollback_payload    TEXT,
      status              TEXT DEFAULT 'completed',
      logs_json           TEXT,
      explanation_json    TEXT,
      recorded_at         DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_ledger_intent    ON execution_ledger(intent_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_capability ON execution_ledger(capability_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_connector  ON execution_ledger(connector_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_recorded   ON execution_ledger(recorded_at);
  `);

  log.info('[ExecutionLedger] Initialized at:', dbPath);
  return _db;
}

// ── Execution Ledger ──────────────────────────────────────────────────────────

class ExecutionLedger {

  /**
   * Append an execution record to the ledger.
   * This is the ONLY write operation — records are never modified.
   *
   * @param {object} entry
   * @returns {number} row id
   */
  record(entry) {
    const db = _getDb();
    if (!db) return null;

    try {
      const stmt = db.prepare(`
        INSERT INTO execution_ledger (
          intent_id, workflow_id, capability_id, connector_id, strategy,
          adapter_used, constraints_json, duration_ms, cost_estimate,
          permissions_used, approval_required, approval_granted,
          result_summary, rollback_available, rollback_payload,
          status, logs_json, explanation_json
        ) VALUES (
          @intentId, @workflowId, @capabilityId, @connectorId, @strategy,
          @adapterUsed, @constraintsJson, @durationMs, @costEstimate,
          @permissionsUsed, @approvalRequired, @approvalGranted,
          @resultSummary, @rollbackAvailable, @rollbackPayload,
          @status, @logsJson, @explanationJson
        )
      `);

      const result = stmt.run({
        intentId:          entry.intentId          || null,
        workflowId:        entry.workflowId        || null,
        capabilityId:      entry.capabilityId      || 'unknown',
        connectorId:       entry.connectorId       || null,
        strategy:          entry.strategy          || null,
        adapterUsed:       entry.adapterUsed       || null,
        constraintsJson:   JSON.stringify(entry.constraints    || {}),
        durationMs:        entry.durationMs        || null,
        costEstimate:      entry.costEstimate       || 0,
        permissionsUsed:   JSON.stringify(entry.permissionsUsed || []),
        approvalRequired:  entry.approvalRequired  ? 1 : 0,
        approvalGranted:   entry.approvalGranted   ? 1 : 0,
        resultSummary:     entry.resultSummary      || null,
        rollbackAvailable: entry.rollbackAvailable  ? 1 : 0,
        rollbackPayload:   entry.rollbackPayload    ? JSON.stringify(entry.rollbackPayload) : null,
        status:            entry.status             || 'completed',
        logsJson:          JSON.stringify(entry.logs || []),
        explanationJson:   entry.explanation        ? JSON.stringify(entry.explanation) : null,
      });

      log.info(`[ExecutionLedger] Recorded entry #${result.lastInsertRowid} for capability='${entry.capabilityId}' connector='${entry.connectorId}'`);
      return result.lastInsertRowid;

    } catch (err) {
      log.error('[ExecutionLedger] Failed to record entry:', err.message);
      return null;
    }
  }

  /**
   * Retrieve ledger entries for an intent.
   * @param {string} intentId
   * @returns {Array}
   */
  getByIntent(intentId) {
    const db = _getDb();
    if (!db) return [];
    return db.prepare('SELECT * FROM execution_ledger WHERE intent_id = ? ORDER BY recorded_at ASC').all(intentId);
  }

  /**
   * Retrieve recent ledger entries.
   * @param {number} limit
   * @returns {Array}
   */
  getRecent(limit = 50) {
    const db = _getDb();
    if (!db) return [];
    return db.prepare('SELECT * FROM execution_ledger ORDER BY recorded_at DESC LIMIT ?').all(limit);
  }

  /**
   * Retrieve all entries for a connector (for auditing/debugging).
   * @param {string} connectorId
   * @param {number} limit
   */
  getByConnector(connectorId, limit = 100) {
    const db = _getDb();
    if (!db) return [];
    return db.prepare('SELECT * FROM execution_ledger WHERE connector_id = ? ORDER BY recorded_at DESC LIMIT ?').all(connectorId, limit);
  }

  /**
   * Compute aggregate stats for a connector from the ledger.
   * Used by the Discovery Engine's ranking logic.
   */
  getConnectorStats(connectorId) {
    const db = _getDb();
    if (!db) return null;
    const row = db.prepare(`
      SELECT
        COUNT(*)                                    AS total,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS successes,
        AVG(duration_ms)                            AS avgLatencyMs,
        AVG(cost_estimate)                          AS avgCost,
        MAX(recorded_at)                            AS lastUsed
      FROM execution_ledger
      WHERE connector_id = ?
    `).get(connectorId);
    if (!row || row.total === 0) return null;
    return {
      successRate:    row.total > 0 ? Math.round((row.successes / row.total) * 100) : 50,
      avgLatency:     Math.round(row.avgLatencyMs || 5000),
      avgCost:        row.avgCost || 0,
      totalExecutions: row.total,
      lastUsed:       row.lastUsed,
    };
  }

  /**
   * Get the total spend recorded in the ledger.
   */
  getTotalSpend() {
    const db = _getDb();
    if (!db) return 0;
    const row = db.prepare('SELECT SUM(cost_estimate) AS total FROM execution_ledger').get();
    return row?.total || 0;
  }
}

const executionLedger = new ExecutionLedger();
module.exports = { executionLedger, ExecutionLedger };
