'use strict';

/**
 * CHATR Kernel — Strategy Resolver
 * Platform Milestone C — ABI v0.9 RC
 *
 * Input:  CapabilityRequest  (abi: chatr.capability_request.v0_9_rc)
 *         ContextFrame       (abi: chatr.context.v0_9_rc)
 *         constraints        (plain object — user or planner constraints)
 *         goal_id            (string)
 *
 * Output: StrategySelection  (abi: chatr.strategy_selection.v0_9_rc)
 *         Immutable. Persisted. Published on event bus.
 *
 * Events: strategy.resolving → strategy.selected
 *         strategy.resolving → strategy.failed
 *
 * Rules:
 *   - Strategy is selected from the capability_request.strategy_support list.
 *   - Context signals drive the selection (battery, network, preferences, policy).
 *   - No domain knowledge. No industry names. No provider names.
 *   - Simulation is never a strategy output. Dry-run is a separate flag.
 */

const crypto = require('crypto');
const { STRATEGY } = require('../events/events.cjs');

const ABI              = 'chatr.strategy_selection.v0_9_rc';
const REQUEST_ABI      = 'chatr.capability_request.v0_9_rc';
const COLLECTION       = 'kernel_strategy_selections_v0_9_rc';
const SELECTION_VERSION = 1;

/**
 * Canonical strategy labels — must match CapabilityContract.strategy_support vocabulary.
 * Ordered from most specific signal to least specific (priority for tie-breaking).
 */
const Strategy = Object.freeze({
  POLICY_REQUIRED:  'policy_required',
  OFFLINE_FIRST:    'offline_first',
  ENERGY_EFFICIENT: 'energy_efficient',
  PRIVACY_FIRST:    'privacy_first',
  LOCAL_FIRST:      'local_first',
  USER_PREFERRED:   'user_preferred',
  MOST_TRUSTED:     'most_trusted',
  HIGHEST_RATED:    'highest_rated',
  FASTEST:          'fastest',
  CHEAPEST:         'cheapest',
});

const VALID_STRATEGIES = new Set(Object.values(Strategy));

/**
 * Context signal → strategy evaluation rules.
 * Each rule is checked in priority order. First match wins.
 * All rules are data-driven from context — never from capability name.
 */
const SIGNAL_RULES = Object.freeze([
  {
    strategy: Strategy.POLICY_REQUIRED,
    test: (ctx) => !!ctx?.policy_refs?.length,
    reason: 'Policy references present — policy-required strategy enforced.',
  },
  {
    strategy: Strategy.OFFLINE_FIRST,
    test: (ctx) => ctx?.network?.available === false || ctx?.network?.quality === 'none',
    reason: 'Device is offline — offline-first strategy selected.',
  },
  {
    strategy: Strategy.ENERGY_EFFICIENT,
    test: (ctx) => Number(ctx?.device?.battery_level) < 0.2,
    reason: 'Battery below 20% — energy-efficient strategy selected.',
  },
  {
    strategy: Strategy.PRIVACY_FIRST,
    test: (ctx) => ctx?.preferences?.privacy === 'high' || ctx?.permissions?.privacy_mode === true,
    reason: 'Privacy mode active — privacy-first strategy selected.',
  },
  {
    strategy: Strategy.LOCAL_FIRST,
    test: (ctx) => ctx?.preferences?.local_first === true,
    reason: 'User prefers local providers.',
  },
  {
    strategy: Strategy.USER_PREFERRED,
    test: (ctx) => !!ctx?.preferences?.preferred_strategy,
    reason: 'User has explicit strategy preference.',
    extract: (ctx) => ctx.preferences.preferred_strategy,
  },
]);

class StrategyResolver {
  constructor(options = {}) {
    this._persistence = options.persistence || getDefaultPersistence();
    this._bus         = options.bus         || getDefaultBus();
    this._now         = normalizeNow(options.now);
    this._selections  = new Map();
    this._loadFromDisk();
  }

  /**
   * Resolve a strategy for a single CapabilityRequest.
   *
   * @param {object} input
   * @param {object} input.capability_request  - CapabilityRequest ABI object
   * @param {object} [input.context_frame]     - ContextFrame ABI object (optional)
   * @param {object} [input.constraints]       - Additional constraints
   * @param {string} [input.goal_id]           - Goal ID for correlation
   * @returns {object} StrategySelection — immutable, persisted
   */
  resolve(input = {}) {
    const capRequest    = input.capability_request || input.capabilityRequest;
    const contextFrame  = input.context_frame || input.contextFrame || {};
    const constraints   = clonePlainObject(input.constraints || {});
    const goalId        = input.goal_id || input.goalId || capRequest?.goal_id || null;
    const correlationId = input.correlation_id || input.correlationId || goalId;
    const resolvedAt    = this._now();

    this._publish(STRATEGY.RESOLVING, {
      goal_id:             goalId,
      capability:          capRequest?.capability || null,
      capability_ref:      capRequest?.request_id || null,
      correlation_id:      correlationId,
      source:              'StrategyResolver',
    });

    try {
      const validated = validateCapabilityRequest(capRequest);
      const strategy  = selectStrategy(validated, contextFrame, constraints);
      const selection = buildStrategySelection({
        capRequest: validated,
        strategy,
        contextFrame,
        constraints,
        goalId,
        resolvedAt,
      });

      validateStrategySelection(selection);
      const immutable = deepFreeze(selection);

      if (!input.dry_run) {
        this._selections.set(immutable.strategy_selection_id, immutable);
        this._persist();
      }

      this._publish(STRATEGY.SELECTED, {
        goal_id:               goalId,
        capability:            immutable.capability,
        strategy:              immutable.strategy,
        strategy_selection_id: immutable.strategy_selection_id,
        reason:                immutable.reason,
        correlation_id:        correlationId,
        source:                'StrategyResolver',
      });

      return immutable;
    } catch (error) {
      this._publish(STRATEGY.FAILED, {
        goal_id:        goalId,
        capability:     capRequest?.capability || null,
        error:          error.message,
        correlation_id: correlationId,
        source:         'StrategyResolver',
      });
      throw error;
    }
  }

  getSelection(id) {
    return this._selections.get(id) || null;
  }

  listSelections() {
    return Array.from(this._selections.values());
  }

  _loadFromDisk() {
    const stored = this._persistence.retrieve(COLLECTION);
    this._selections.clear();
    for (const s of stored?.selections || []) {
      try {
        validateStrategySelection(s);
        this._selections.set(s.strategy_selection_id, deepFreeze(s));
      } catch {
        // Corrupted persisted selections are silently skipped.
      }
    }
    return this.listSelections();
  }

  _persist() {
    return this._persistence.store(COLLECTION, {
      abi:        ABI,
      selections: this.listSelections(),
      updated_at: this._now(),
    });
  }

  _publish(eventName, payload) {
    if (this._bus && typeof this._bus.publish === 'function') {
      this._bus.publish(eventName, payload);
    }
  }
}

// ── Strategy selection logic ──────────────────────────────────────────────────

function selectStrategy(capRequest, contextFrame, constraints) {
  const supported = new Set(capRequest.strategy_support);

  // Walk signal rules in priority order. Use first matching strategy that
  // the capability contract also supports.
  for (const rule of SIGNAL_RULES) {
    if (!rule.test(contextFrame)) continue;

    const candidate = rule.extract ? rule.extract(contextFrame) : rule.strategy;
    const normalized = String(candidate || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');

    if (VALID_STRATEGIES.has(normalized) && supported.has(normalized)) {
      return { strategy: normalized, reason: rule.reason };
    }
  }

  // Constraint-driven overrides (from GoalPlan constraints)
  if (constraints.prefer_cheapest && supported.has(Strategy.CHEAPEST)) {
    return { strategy: Strategy.CHEAPEST, reason: 'User constraint: prefer cheapest option.' };
  }
  if (constraints.prefer_fastest && supported.has(Strategy.FASTEST)) {
    return { strategy: Strategy.FASTEST, reason: 'User constraint: prefer fastest option.' };
  }

  // Default: most_trusted, then highest_rated, then fastest, then first supported
  for (const fallback of [Strategy.MOST_TRUSTED, Strategy.HIGHEST_RATED, Strategy.FASTEST]) {
    if (supported.has(fallback)) {
      return { strategy: fallback, reason: `Default strategy: ${fallback}.` };
    }
  }

  // Last resort: first strategy declared in the contract
  const first = capRequest.strategy_support[0];
  return { strategy: first, reason: `Fallback: first declared strategy in capability contract.` };
}

// ── ABI object construction ───────────────────────────────────────────────────

function buildStrategySelection({ capRequest, strategy, contextFrame, constraints, goalId, resolvedAt }) {
  const selection = {
    abi:                    ABI,
    selection_version:      SELECTION_VERSION,
    strategy_selection_id:  null,
    strategy_hash:          null,
    goal_id:                goalId,
    capability:             capRequest.capability,
    capability_request_ref: capRequest.request_id,
    strategy:               strategy.strategy,
    reason:                 strategy.reason,
    constraints:            clonePlainObject(constraints),
    inputs: {
      context_ref:  contextFrame?.context_id  || contextFrame?.context_ref  || null,
      policy_refs:  clonePlainObject(contextFrame?.policy_refs || []),
      memory_refs:  clonePlainObject(contextFrame?.world_state_refs || []),
    },
    resolved_at: resolvedAt,
    provenance: {
      resolver:    'StrategyResolver',
      resolved_at: resolvedAt,
    },
  };

  selection.strategy_hash         = hashStable(buildHashPayload(selection));
  selection.strategy_selection_id = `strategy_sel_${selection.strategy_hash.slice(0, 32)}`;
  return selection;
}

function buildHashPayload(s) {
  return {
    goal_id:                s.goal_id,
    capability:             s.capability,
    capability_request_ref: s.capability_request_ref,
    strategy:               s.strategy,
    constraints:            s.constraints,
    inputs:                 s.inputs,
    resolved_at:            s.resolved_at,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateCapabilityRequest(req) {
  if (!req || typeof req !== 'object') {
    throw new Error('StrategyResolver requires a CapabilityRequest object');
  }
  if (req.abi !== REQUEST_ABI) {
    throw new Error(`StrategyResolver requires CapabilityRequest ABI ${REQUEST_ABI}, received: ${req.abi}`);
  }
  if (!req.request_id || typeof req.request_id !== 'string') {
    throw new Error('CapabilityRequest requires request_id');
  }
  if (!req.capability || typeof req.capability !== 'string') {
    throw new Error('CapabilityRequest requires capability');
  }
  if (req.capability.includes('.')) {
    throw new Error(`CapabilityRequest.capability must be universal, not namespaced: ${req.capability}`);
  }
  if (req.capability !== req.capability.toUpperCase()) {
    throw new Error(`CapabilityRequest.capability must be canonical uppercase: ${req.capability}`);
  }
  if (!Array.isArray(req.strategy_support) || req.strategy_support.length === 0) {
    throw new Error('CapabilityRequest requires strategy_support array');
  }
  for (const s of req.strategy_support) {
    if (!VALID_STRATEGIES.has(s)) {
      throw new Error(`Unknown strategy in strategy_support: ${s}`);
    }
  }
  return req;
}

function validateStrategySelection(s) {
  if (!s || typeof s !== 'object') {
    throw new Error('StrategySelection must be an object');
  }
  if (s.abi !== ABI) {
    throw new Error(`Invalid StrategySelection ABI: ${s.abi}`);
  }
  if (!s.strategy_selection_id || typeof s.strategy_selection_id !== 'string') {
    throw new Error('StrategySelection requires strategy_selection_id');
  }
  if (!s.strategy_hash || typeof s.strategy_hash !== 'string') {
    throw new Error('StrategySelection requires strategy_hash');
  }
  if (!s.capability || typeof s.capability !== 'string') {
    throw new Error('StrategySelection requires capability');
  }
  if (!VALID_STRATEGIES.has(s.strategy)) {
    throw new Error(`StrategySelection strategy is not a valid canonical strategy: ${s.strategy}`);
  }
  if (typeof s.reason !== 'string' || !s.reason) {
    throw new Error('StrategySelection requires reason');
  }
  if (Number.isNaN(Date.parse(s.resolved_at))) {
    throw new Error('StrategySelection requires resolved_at ISO timestamp');
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

function clonePlainObject(v) {
  return JSON.parse(JSON.stringify(v ?? (Array.isArray(v) ? [] : {})));
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

function getStrategyResolver() {
  if (!_default) _default = new StrategyResolver();
  return _default;
}

// ── Exports ───────────────────────────────────────────────────────────────────

const exported = {
  ABI,
  Strategy,
  VALID_STRATEGIES,
  StrategyResolver,
  COLLECTION,
  SELECTION_VERSION,
  validateCapabilityRequest,
  validateStrategySelection,
  deepFreeze,
  getStrategyResolver,
};

Object.defineProperty(exported, 'strategyResolver', {
  enumerable: true,
  get: getStrategyResolver,
});

module.exports = exported;
