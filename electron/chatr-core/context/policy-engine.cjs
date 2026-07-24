'use strict';

/**
 * CHATR Kernel v2.0 — Policy Engine
 * 
 * Maps capabilities to risk-based permissions (Silent vs Confirm vs Block).
 * Avoids raw technical permissions (like 'allow file system').
 */

const fs = require('fs');
const path = require('path');
const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

const ApprovalRequirement = {
  SILENT: 'Silent',
  CONFIRM: 'Confirm',
  BLOCK: 'Block'
};

class PolicyEngine {
  constructor() {
    this._policies = new Map();
    this._persistPath = path.join(process.cwd(), '.chatr', 'policies.json');
    this._initDefaults();
    this._load();
  }

  _initDefaults() {
    // Default system policies based on capability IDs
    this.setPolicy('transport.search', ApprovalRequirement.SILENT);
    this.setPolicy('transport.book', ApprovalRequirement.CONFIRM, { limit: 50 }); // max $50 silently? No, require confirm by default
    
    this.setPolicy('food.search', ApprovalRequirement.SILENT);
    this.setPolicy('food.order', ApprovalRequirement.CONFIRM);

    this.setPolicy('jobs.search_candidates', ApprovalRequirement.SILENT);
    this.setPolicy('jobs.generate_jd', ApprovalRequirement.SILENT);
    this.setPolicy('jobs.post', ApprovalRequirement.CONFIRM);

    this.setPolicy('memory.search', ApprovalRequirement.SILENT);
    this.setPolicy('memory.delete', ApprovalRequirement.CONFIRM);

    this.setPolicy('communication.draft', ApprovalRequirement.SILENT);
    this.setPolicy('communication.email', ApprovalRequirement.CONFIRM);
    
    // Core OS level
    this.setPolicy('system.read_file', ApprovalRequirement.SILENT);
    this.setPolicy('system.delete_file', ApprovalRequirement.CONFIRM);
    this.setPolicy('system.spend_money', ApprovalRequirement.CONFIRM);
  }

  _load() {
    try {
      if (fs.existsSync(this._persistPath)) {
        const data = fs.readFileSync(this._persistPath, 'utf8');
        const parsed = JSON.parse(data);
        for (const [capability, config] of Object.entries(parsed)) {
          this._policies.set(capability, config);
        }
      }
    } catch (err) {
      log.warn('[PolicyEngine] Failed to load persisted policies', err);
    }
  }

  _persist() {
    try {
      if (!fs.existsSync(path.dirname(this._persistPath))) {
        fs.mkdirSync(path.dirname(this._persistPath), { recursive: true });
      }
      const obj = Object.fromEntries(this._policies);
      fs.writeFileSync(this._persistPath, JSON.stringify(obj, null, 2));
    } catch (err) {
      log.error('[PolicyEngine] Failed to persist policies', err);
    }
  }

  /**
   * Set a policy for a capability.
   */
  setPolicy(capability, requirement, metadata = {}) {
    this._policies.set(capability, { requirement, ...metadata });
    this._persist();
  }

  /**
   * Evaluate if a capability execution requires approval based on the user's risk tolerance.
   * 
   * @param {string} capability e.g., 'food.order'
   * @param {object} context execution context and constraints
   * @returns {object} { requiresApproval: boolean, requirement: string, reason: string }
   */
  evaluate(capability, context = {}) {
    const policy = this._policies.get(capability) || { requirement: ApprovalRequirement.CONFIRM }; // Default to secure
    
    // Example rule: Spend money limit
    if (policy.limit !== undefined && context.cost !== undefined) {
      if (context.cost > policy.limit) {
        return { requiresApproval: true, requirement: ApprovalRequirement.CONFIRM, reason: `Cost ${context.cost} exceeds auto-approve limit of ${policy.limit}` };
      } else {
        return { requiresApproval: false, requirement: ApprovalRequirement.SILENT, reason: 'Within auto-approve limit' };
      }
    }

    const requiresApproval = policy.requirement === ApprovalRequirement.CONFIRM || policy.requirement === ApprovalRequirement.BLOCK;
    return {
      requiresApproval,
      requirement: policy.requirement,
      reason: `Policy set to ${policy.requirement}`
    };
  }
}

const policyEngine = new PolicyEngine();
module.exports = { policyEngine, PolicyEngine, ApprovalRequirement };
