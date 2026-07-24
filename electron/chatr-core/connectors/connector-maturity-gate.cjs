'use strict';

const fs   = require('fs');
const path = require('path');
const { ManifestValidator } = require('../browser-runtime/manifest-validator.cjs');
const { ManifestLoader }    = require('../browser-runtime/manifest-loader.cjs');

/**
 * CHATR Connector Maturity Gate
 * Sprint 1.3
 *
 * Automated gate runner for connector promotion.
 * Code review alone is insufficient. Every promotion must pass objective criteria.
 *
 * Gates:
 *   Gate 1: Prototype → Experimental
 *   Gate 2: Experimental → Beta         (requires live test runs)
 *   Gate 3: Beta → Production           (requires SLA + incident runbook)
 *   Gate 4: Production → Certified      (requires 30-day record + security audit)
 */

const GATES = {
  1: {
    name: 'Prototype → Experimental',
    description: 'Manifest declared, all 5 connector methods present, manifest validates cleanly.',
    checks: ['manifest_exists', 'manifest_valid', 'all_methods_present', 'realistic_sla_declared'],
  },
  2: {
    name: 'Experimental → Beta',
    description: 'Live discovery returns real results. Session auth works. 90%+ success on 50 runs.',
    checks: ['live_discovery_succeeds', 'session_auth_works', 'success_rate_above_90'],
    requiresLiveRuns: true,
  },
  3: {
    name: 'Beta → Production',
    description: '99%+ success on 500 runs. P99 < SLA. Incident runbook written. On-call defined.',
    checks: ['success_rate_above_99', 'p99_within_sla', 'runbook_exists', 'oncall_defined'],
    requiresLiveRuns: true,
  },
  4: {
    name: 'Production → Certified',
    description: '30-day reliability record. Security audit passed. Rate-limit handling proven.',
    checks: ['thirty_day_record', 'security_audit_passed', 'rate_limit_handling_proven'],
    requiresLiveRuns: true,
  },
};

class ConnectorMaturityGate {
  constructor(options = {}) {
    this._manifestDir = options.manifestDir || path.join(__dirname, '..', 'manifests');
    this._validator   = new ManifestValidator();
    this._loader      = new ManifestLoader({ manifestDir: this._manifestDir });
  }

  /**
   * Run gate checks for a connector.
   * @param {BaseConnector} connector
   * @param {number} gate  1 | 2 | 3 | 4
   * @param {object} liveRunStats  Required for gates 2+: { successRate, p99Ms, runCount }
   * @returns {{ passed: boolean, gate: number, results: object[], blockers: string[] }}
   */
  async runGate(connector, gate, liveRunStats = {}) {
    const gateDef = GATES[gate];
    if (!gateDef) throw new Error(`Unknown gate: ${gate}. Valid gates are 1-4.`);

    const results = [];
    const blockers = [];

    for (const check of gateDef.checks) {
      const result = await this._runCheck(check, connector, liveRunStats);
      results.push(result);
      if (!result.passed) blockers.push(`[${check}] ${result.reason}`);
    }

    const passed = blockers.length === 0;
    return { passed, gate, gateName: gateDef.name, results, blockers };
  }

  // ─── Individual Checks ────────────────────────────────────────────────────

  async _runCheck(checkName, connector, stats) {
    switch (checkName) {
      case 'manifest_exists': {
        const manifestPath = path.join(this._manifestDir, `${connector.id}.manifest.json`);
        const exists = fs.existsSync(manifestPath);
        return { check: checkName, passed: exists, reason: exists ? 'Manifest file found' : `No manifest at ${manifestPath}` };
      }

      case 'manifest_valid': {
        try {
          const manifestPath = path.join(this._manifestDir, `${connector.id}.manifest.json`);
          if (!fs.existsSync(manifestPath)) {
            return { check: checkName, passed: false, reason: 'Manifest file not found' };
          }
          const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          const validation = this._validator.validate(raw, { allowLocalhost: false });
          return {
            check: checkName,
            passed: validation.valid,
            reason: validation.valid ? 'Manifest validates cleanly' : validation.errors.join('; '),
            warnings: validation.warnings,
          };
        } catch (e) {
          return { check: checkName, passed: false, reason: e.message };
        }
      }

      case 'all_methods_present': {
        const required = ['discover', 'fetch', 'authenticate', 'checkout', 'track', 'health', 'capabilities', 'sla'];
        const missing = required.filter(m => typeof connector[m] !== 'function');
        return {
          check: checkName,
          passed: missing.length === 0,
          reason: missing.length === 0 ? 'All 8 required methods present' : `Missing: ${missing.join(', ')}`,
        };
      }

      case 'realistic_sla_declared': {
        const sla = connector.sla();
        const reasonable = typeof sla === 'number' && sla > 0 && sla <= 5000;
        return {
          check: checkName,
          passed: reasonable,
          reason: reasonable ? `SLA declared: ${sla}ms` : `SLA value ${sla} is not realistic`,
        };
      }

      case 'live_discovery_succeeds': {
        const rate = stats.successRate ?? 0;
        return { check: checkName, passed: rate >= 90, reason: `Success rate: ${rate}% (required: ≥90%)` };
      }

      case 'session_auth_works': {
        return { check: checkName, passed: !!stats.authWorks, reason: stats.authWorks ? 'Auth confirmed' : 'Auth not confirmed' };
      }

      case 'success_rate_above_90': {
        const rate = stats.successRate ?? 0;
        const runs = stats.runCount ?? 0;
        const passed = rate >= 90 && runs >= 50;
        return { check: checkName, passed, reason: `${rate}% over ${runs} runs (required: ≥90% over ≥50 runs)` };
      }

      case 'success_rate_above_99': {
        const rate = stats.successRate ?? 0;
        const runs = stats.runCount ?? 0;
        const passed = rate >= 99 && runs >= 500;
        return { check: checkName, passed, reason: `${rate}% over ${runs} runs (required: ≥99% over ≥500 runs)` };
      }

      case 'p99_within_sla': {
        const p99 = stats.p99Ms ?? Infinity;
        const sla = connector.sla();
        const passed = p99 <= sla;
        return { check: checkName, passed, reason: `P99 ${p99}ms vs SLA ${sla}ms` };
      }

      case 'runbook_exists': {
        return { check: checkName, passed: !!stats.runbookPath, reason: stats.runbookPath ? 'Runbook found' : 'No incident runbook defined' };
      }

      case 'oncall_defined': {
        return { check: checkName, passed: !!stats.oncall, reason: stats.oncall ? 'On-call defined' : 'No on-call rotation defined' };
      }

      case 'thirty_day_record': {
        return { check: checkName, passed: !!stats.thirtyDayRecord, reason: stats.thirtyDayRecord ? '30-day record available' : '30-day reliability record not yet available' };
      }

      case 'security_audit_passed': {
        return { check: checkName, passed: !!stats.securityAuditPassed, reason: stats.securityAuditPassed ? 'Security audit passed' : 'Security audit not yet completed' };
      }

      case 'rate_limit_handling_proven': {
        return { check: checkName, passed: !!stats.rateLimitHandlingProven, reason: stats.rateLimitHandlingProven ? 'Rate limit handling verified' : 'Rate limit handling not yet proven' };
      }

      default:
        return { check: checkName, passed: false, reason: `Unknown check: ${checkName}` };
    }
  }
}

module.exports = { ConnectorMaturityGate, GATES };
