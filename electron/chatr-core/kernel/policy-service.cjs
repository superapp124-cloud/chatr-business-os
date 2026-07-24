'use strict';

/**
 * CHATR Kernel — Policy Service
 * Platform Milestone C — ABI v0.9 RC
 *
 * Input:  CapabilityRequest  (abi: chatr.capability_request.v0_9_rc)
 *         ContextFrame       (abi: chatr.context.v0_9_rc)
 *         goal_id            (string)
 *
 * Output: PolicyDecision     (abi: chatr.policy_decision.v0_9_rc)
 *         Immutable. Persisted. Published on event bus.
 *
 * Events: policy.evaluating → policy.decided / policy.blocked
 *         policy.evaluating → policy.failed
 *
 * Rules:
 *   - Evaluates the policy stack (system → enterprise → workspace → user → request).
 *   - Decisions are allow, allow_with_approval, or block.
 *   - Runs *before* Trust and Provider selection (per TSC implementation order adjustment).
 *   - Must not contain AI model evaluation (moved to model layer).
 *   - No domain or industry specific knowledge.
 */

const crypto = require('crypto');
const { POLICY } = require('../events/events.cjs');

const ABI               = 'chatr.policy_decision.v0_9_rc';
const REQUEST_ABI       = 'chatr.capability_request.v0_9_rc';
const COLLECTION        = 'kernel_policy_decisions_v0_9_rc';
const DECISION_VERSION  = 1;

/**
 * Basic policy stack simulation for Milestone C.
 * In a full implementation, these would be loaded from policy configuration objects.
 */
const SYSTEM_POLICY = {
  blocked_capabilities: ['DELETE_DATABASE', 'FORMAT_DRIVE'],
  max_transaction_value: 100000,
};

class PolicyService {
  constructor(options = {}) {
    this._persistence = options.persistence || getDefaultPersistence();
    this._bus         = options.bus         || getDefaultBus();
    this._now         = normalizeNow(options.now);
    this._decisions   = new Map();
    this._loadFromDisk();
  }

  /**
   * Evaluate policy for a given capability request.
   *
   * @param {object} input
   * @param {object} input.capability_request  - CapabilityRequest ABI object
   * @param {object} [input.context_frame]     - ContextFrame ABI object (optional)
   * @param {string} [input.goal_id]           - Goal ID
   * @returns {object} PolicyDecision — immutable, persisted
   */
  evaluate(input = {}) {
    const capRequest    = input.capability_request || input.capabilityRequest;
    const contextFrame  = input.context_frame || input.contextFrame || {};
    const goalId        = input.goal_id || input.goalId || capRequest?.goal_id || null;
    const correlationId = input.correlation_id || input.correlationId || goalId;
    const evaluatedAt   = this._now();

    this._publish(POLICY.EVALUATING, {
      goal_id:             goalId,
      capability:          capRequest?.capability || null,
      capability_ref:      capRequest?.request_id || null,
      correlation_id:      correlationId,
      source:              'PolicyService',
    });

    try {
      const validated = validateCapabilityRequest(capRequest);
      const decisionData = computePolicyDecision(validated, contextFrame);
      const decision = buildPolicyDecision({
        capRequest: validated,
        decisionData,
        goalId,
        evaluatedAt,
      });

      validatePolicyDecision(decision);
      const immutable = deepFreeze(decision);

      if (!input.dry_run) {
        this._decisions.set(immutable.policy_decision_id, immutable);
        this._persist();
      }

      if (immutable.decision === 'block') {
        this._publish(POLICY.BLOCKED, {
          goal_id:            goalId,
          action:             immutable.action,
          policy_decision_id: immutable.policy_decision_id,
          reasons:            immutable.reasons,
          correlation_id:     correlationId,
          source:             'PolicyService',
        });
      } else {
        this._publish(POLICY.DECIDED, {
          goal_id:            goalId,
          action:             immutable.action,
          policy_decision_id: immutable.policy_decision_id,
          decision:           immutable.decision,
          correlation_id:     correlationId,
          source:             'PolicyService',
        });
      }

      return immutable;
    } catch (error) {
      this._publish(POLICY.FAILED, {
        goal_id:        goalId,
        capability:     capRequest?.capability || null,
        error:          error.message,
        correlation_id: correlationId,
        source:         'PolicyService',
      });
      throw error;
    }
  }

  getDecision(id) {
    return this._decisions.get(id) || null;
  }

  listDecisions() {
    return Array.from(this._decisions.values());
  }

  _loadFromDisk() {
    const stored = this._persistence.retrieve(COLLECTION);
    this._decisions.clear();
    for (const d of stored?.decisions || []) {
      try {
        validatePolicyDecision(d);
        this._decisions.set(d.policy_decision_id, deepFreeze(d));
      } catch {
        // Skip corrupted records
      }
    }
  }

  _persist() {
    return this._persistence.store(COLLECTION, {
      abi:        ABI,
      decisions:  this.listDecisions(),
      updated_at: this._now(),
    });
  }

  _publish(eventName, payload) {
    if (this._bus && typeof this._bus.publish === 'function') {
      this._bus.publish(eventName, payload);
    }
  }
}

// ── Policy evaluation logic ───────────────────────────────────────────────────

function computePolicyDecision(capRequest, contextFrame) {
  const capability = capRequest.capability;
  const constraints = capRequest.constraints || {};
  const cost = Number(constraints.price || constraints.cost || constraints.amount || 0);

  let decision = 'allow';
  let risk = capRequest.risk || 'low';
  let requiredApprovals = [];
  let reasons = [];

  // System blocks
  if (SYSTEM_POLICY.blocked_capabilities.includes(capability)) {
    return {
      decision: 'block',
      risk: 'high',
      requiredApprovals: [],
      reasons: ['System policy blocks this capability globally'],
    };
  }

  // Cost/Value checks
  if (cost > SYSTEM_POLICY.max_transaction_value) {
    return {
      decision: 'block',
      risk: 'high',
      requiredApprovals: [],
      reasons: [`Transaction value (${cost}) exceeds maximum allowed by system policy (${SYSTEM_POLICY.max_transaction_value})`],
    };
  }

  if (cost > 5000) {
    decision = 'allow_with_approval';
    risk = 'high';
    requiredApprovals.push('user.confirmation');
    reasons.push('High value transaction requires explicit approval');
  }

  // Certain capabilities generally require approval (e.g. EXECUTE, TRANSFER, PAY)
  if (['EXECUTE', 'TRANSFER', 'PAY', 'BOOK', 'ORDER'].includes(capability)) {
    decision = 'allow_with_approval';
    if (risk === 'low') risk = 'medium';
    if (!requiredApprovals.includes('user.confirmation')) {
      requiredApprovals.push('user.confirmation');
    }
    reasons.push('Action involves commitment or payment and requires explicit approval');
  }

  // Context-based privacy checks
  if (contextFrame?.preferences?.privacy === 'high' && ['COMMUNICATE', 'SEND'].includes(capability)) {
    decision = 'allow_with_approval';
    if (risk === 'low') risk = 'medium';
    if (!requiredApprovals.includes('user.confirmation')) {
      requiredApprovals.push('user.confirmation');
    }
    reasons.push('Strict privacy mode requires confirmation before external communication');
  }

  if (reasons.length === 0) {
    reasons.push('Action allowed by default policy');
  }

  return { decision, risk, requiredApprovals, reasons };
}

// ── ABI object construction ───────────────────────────────────────────────────

function buildPolicyDecision({ capRequest, decisionData, goalId, evaluatedAt }) {
  const decision = {
    abi:                    ABI,
    decision_version:       DECISION_VERSION,
    policy_decision_id:     null,
    decision_hash:          null,
    goal_id:                goalId,
    capability_request_ref: capRequest.request_id,
    action:                 capRequest.capability,
    risk:                   decisionData.risk,
    decision:               decisionData.decision,
    required_approvals:     clonePlainArray(decisionData.requiredApprovals),
    reasons:                clonePlainArray(decisionData.reasons),
    evaluated_at:           evaluatedAt,
  };

  decision.decision_hash      = hashStable(buildHashPayload(decision));
  decision.policy_decision_id = `policy_dec_${decision.decision_hash.slice(0, 32)}`;
  return decision;
}

function buildHashPayload(d) {
  return {
    goal_id:                d.goal_id,
    capability_request_ref: d.capability_request_ref,
    action:                 d.action,
    risk:                   d.risk,
    decision:               d.decision,
    required_approvals:     d.required_approvals,
    reasons:                d.reasons,
    evaluated_at:           d.evaluated_at,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateCapabilityRequest(req) {
  if (!req || typeof req !== 'object') {
    throw new Error('PolicyService requires a CapabilityRequest object');
  }
  if (req.abi !== REQUEST_ABI) {
    throw new Error(`PolicyService requires CapabilityRequest ABI ${REQUEST_ABI}`);
  }
  if (!req.request_id || typeof req.request_id !== 'string') {
    throw new Error('CapabilityRequest requires request_id');
  }
  if (!req.capability || typeof req.capability !== 'string') {
    throw new Error('CapabilityRequest requires capability');
  }
  return req;
}

function validatePolicyDecision(d) {
  if (!d || typeof d !== 'object') {
    throw new Error('PolicyDecision must be an object');
  }
  if (d.abi !== ABI) {
    throw new Error(`Invalid PolicyDecision ABI: ${d.abi}`);
  }
  if (!d.policy_decision_id || typeof d.policy_decision_id !== 'string') {
    throw new Error('PolicyDecision requires policy_decision_id');
  }
  if (!d.decision_hash || typeof d.decision_hash !== 'string') {
    throw new Error('PolicyDecision requires decision_hash');
  }
  if (!d.action || typeof d.action !== 'string') {
    throw new Error('PolicyDecision requires action');
  }
  if (!['allow', 'allow_with_approval', 'block'].includes(d.decision)) {
    throw new Error(`Invalid decision in PolicyDecision: ${d.decision}`);
  }
  if (!Array.isArray(d.required_approvals)) {
    throw new Error('PolicyDecision requires required_approvals array');
  }
  if (!Array.isArray(d.reasons) || d.reasons.length === 0) {
    throw new Error('PolicyDecision requires reasons array');
  }
  if (Number.isNaN(Date.parse(d.evaluated_at))) {
    throw new Error('PolicyDecision requires evaluated_at ISO timestamp');
  }
  return true;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function hashStable(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function clonePlainArray(arr) {
  return JSON.parse(JSON.stringify(Array.isArray(arr) ? arr : []));
}

function deepFreeze(v) {
  if (!v || typeof v !== 'object' || Object.isFrozen(v)) return v;
  Object.freeze(v);
  for (const nested of Object.values(v)) deepFreeze(nested);
  return v;
}

function normalizeNow(now) {
  return typeof now === 'function' ? now : () => new Date().toISOString();
}

function getDefaultPersistence() {
  return require('../db/persistence.cjs');
}

function getDefaultBus() {
  return require('../events/bus.cjs').bus;
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _default = null;

function getPolicyService() {
  if (!_default) _default = new PolicyService();
  return _default;
}

// ── Exports ───────────────────────────────────────────────────────────────────

const exported = {
  ABI,
  PolicyService,
  COLLECTION,
  DECISION_VERSION,
  validateCapabilityRequest,
  validatePolicyDecision,
  deepFreeze,
  getPolicyService,
};

Object.defineProperty(exported, 'policyService', {
  enumerable: true,
  get: getPolicyService,
});

module.exports = exported;
