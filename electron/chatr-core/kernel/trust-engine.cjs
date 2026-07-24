'use strict';

/**
 * CHATR Kernel — Trust Engine (Phase 5.2)
 *
 * Evaluates every execution request before the Workflow Engine builds a DAG.
 * Classifies actions into three risk tiers and applies the appropriate policy.
 *
 * Risk Tiers:
 *   SAFE     → search, read, compare, summarize, list
 *             → executes silently, no user interruption
 *   CONFIRM  → book, order, send, publish, post
 *             → pauses, presents action summary, requires explicit user approval
 *   RESTRICT → delete, transfer money, access private data, cancel subscriptions
 *             → pauses, explains risk, requires elevated confirmation
 *
 * Policy overrides: users can whitelist specific connector+capability pairs
 * as "trusted automation" so they never prompt again.
 */

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

// ── Risk Classification Table ─────────────────────────────────────────────────

const RISK_TABLE = {
  // Safe — read-only, reversible, no money involved
  'transport.search':           'SAFE',
  'food.search':                'SAFE',
  'shopping.search':            'SAFE',
  'healthcare.search_doctors':  'SAFE',
  'jobs.search':                'SAFE',
  'intelligence.summarize':     'SAFE',

  // Confirm — irreversible, involves commitments or money
  'transport.book':             'CONFIRM',
  'food.order':                 'CONFIRM',
  'shopping.purchase':          'CONFIRM',
  'healthcare.book_appointment':'CONFIRM',
  'jobs.post':                  'CONFIRM',
  'workflow.invoice_processing':'CONFIRM',

  // Restrict — financial transactions, deletions, private data access
  'payment.transfer':           'RESTRICT',
  'account.delete':             'RESTRICT',
  'email.send_bulk':            'RESTRICT',
  'data.export':                'RESTRICT',
};

const RISK_DESCRIPTIONS = {
  SAFE:     'This action is read-only and fully reversible.',
  CONFIRM:  'This action is irreversible and may involve a real-world commitment or payment.',
  RESTRICT: 'This action is high-risk. It may involve money, deletion, or sensitive data access.',
};

class TrustEngine {
  constructor() {
    /** @type {Set<string>} "capabilityId::connectorId" pairs trusted by the user */
    this._trustedAutomations = new Set();
  }

  /**
   * Evaluate the risk of an execution request.
   *
   * @param {string} capabilityId  e.g. 'transport.book'
   * @param {object} constraints   resolved constraints (for cost/value checks)
   * @param {string} [connectorId] optional — for trusted automation check
   * @returns {{ riskLevel, requiresApproval, requiresElevation, reason, description }}
   */
  evaluate(capabilityId, constraints = {}, connectorId = null) {
    const riskLevel = RISK_TABLE[capabilityId] || 'SAFE';

    // Check trusted automation whitelist
    if (connectorId && this._trustedAutomations.has(`${capabilityId}::${connectorId}`)) {
      log.info(`[TrustEngine] '${capabilityId}' via '${connectorId}' is trusted — executing silently.`);
      return {
        riskLevel,
        requiresApproval:   false,
        requiresElevation:  false,
        trusted:            true,
        reason:             'Trusted automation',
        description:        'You have previously authorised CHATR to execute this automatically.',
      };
    }

    // High-value spend detection
    const estimatedCost = Number(constraints.price || constraints.cost || constraints.total || 0);
    const isHighValue   = estimatedCost > 5000; // ₹5000 threshold

    const requiresApproval  = riskLevel === 'CONFIRM' || riskLevel === 'RESTRICT';
    const requiresElevation = riskLevel === 'RESTRICT' || isHighValue;

    const reason = isHighValue
      ? `High-value transaction (₹${estimatedCost})`
      : RISK_DESCRIPTIONS[riskLevel];

    log.info(`[TrustEngine] '${capabilityId}' → ${riskLevel}${isHighValue ? ' (HIGH_VALUE)' : ''} requiresApproval=${requiresApproval}`);

    return {
      riskLevel,
      requiresApproval,
      requiresElevation,
      trusted: false,
      estimatedCost,
      reason,
      description: RISK_DESCRIPTIONS[riskLevel],
    };
  }

  /**
   * Mark a capability+connector pair as trusted.
   * Once trusted, the user will never be asked to approve that combination again.
   *
   * @param {string} capabilityId
   * @param {string} connectorId
   */
  trust(capabilityId, connectorId) {
    const key = `${capabilityId}::${connectorId}`;
    this._trustedAutomations.add(key);
    log.info(`[TrustEngine] Trusted automation added: ${key}`);
  }

  /**
   * Remove trust for a capability+connector pair.
   */
  revoke(capabilityId, connectorId) {
    this._trustedAutomations.delete(`${capabilityId}::${connectorId}`);
  }

  /**
   * List all trusted automations.
   * @returns {string[]}
   */
  listTrusted() {
    return Array.from(this._trustedAutomations);
  }

  /**
   * Build a user-facing action summary for CONFIRM-level actions.
   * Used by the UI to render an approval card.
   *
   * @param {string} capabilityId
   * @param {object} constraints
   * @param {string} connectorId
   * @returns {object}
   */
  buildApprovalSummary(capabilityId, constraints, connectorId) {
    const lines = [];

    if (constraints.from && constraints.to) {
      lines.push(`Route: ${constraints.from} → ${constraints.to}`);
    }
    if (constraints.mode)  lines.push(`Mode: ${constraints.mode}`);
    if (constraints.date)  lines.push(`Date: ${constraints.date}`);
    if (constraints.price || constraints.total) {
      lines.push(`Estimated cost: ₹${constraints.price || constraints.total}`);
    }

    return {
      capabilityId,
      connectorId,
      description: `CHATR is about to execute: ${capabilityId.replace('.', ' → ')} via ${connectorId || 'best available connector'}`,
      details: lines,
      riskLevel: RISK_TABLE[capabilityId] || 'SAFE',
      reason: RISK_DESCRIPTIONS[RISK_TABLE[capabilityId]] || '',
    };
  }
}

const trustEngine = new TrustEngine();
module.exports = { trustEngine, TrustEngine };
