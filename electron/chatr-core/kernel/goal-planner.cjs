'use strict';

const crypto = require('crypto');
const { GOAL } = require('../events/events.cjs');

const ABI = 'chatr.goal_plan.v0_9_rc';
const PLAN_VERSION = 1;
const PLAN_COLLECTION = 'kernel_goal_plans_v0_9_rc';
const CAPABILITY_CONTRACT_VERSION = '1.0.0'; // canonical: matches chatr.capability_contract.v0_9_rc contract_version

/**
 * Canonical ABI capability names — chatr.goal_plan.v0_9_rc
 * These MUST match the universal capability catalog exactly.
 * ABI producers emit canonical values. The resolver validates, not repairs.
 * Architecture Lint rejects any lowercase or namespaced capability in kernel code.
 */
const Capability = Object.freeze({
  AUTHENTICATE: 'AUTHENTICATE',
  COLLECT_INPUT: 'COLLECT_INPUT',
  COMPARE:       'COMPARE',
  DISCOVER:      'DISCOVER',
  EXECUTE:       'EXECUTE',
  FETCH:         'FETCH',
  LEARN:         'LEARN',
  NOTIFY:        'NOTIFY',
  OBSERVE:       'OBSERVE',
  PAY:           'PAY',
  RECONCILE:     'RECONCILE',
  RECOVER:       'RECOVER',
  RESUME:        'RESUME',
  SCHEDULE:      'SCHEDULE',
  SELECT:        'SELECT',
  STORE:         'STORE',
  SUSPEND:       'SUSPEND',
  TRACK:         'TRACK',
  TRANSFER:      'TRANSFER',
  VERIFY:        'VERIFY',
});

/**
 * Frozen canonical capability set for O(1) validation.
 * Aligned with UNIVERSAL_CAPABILITY_CATALOG in capability-resolver.cjs.
 */
const CANONICAL_CAPABILITY_SET = new Set(Object.values(Capability));

const DISCOVERY_INTENTS = new Set([
  'DISCOVER',
  'FIND',
  'LOOKUP',
  'SEARCH',
]);

const EXECUTION_INTENTS = new Set([
  'BOOK',
  'BUY',
  'GET',
  'ORDER',
  'PAY',
  'PURCHASE',
  'RENEW',
  'RESERVE',
  'TRANSFER',
]);

class GoalPlanner {
  constructor(options = {}) {
    this.persistence = options.persistence || getDefaultPersistence();
    this.bus = options.bus || getDefaultBus();
    this.now = normalizeNow(options.now);
    this.plans = new Map();
    this.loadFromDisk();
  }

  plan(input = {}) {
    const contextFrame = input.context_frame || input.contextFrame || null;
    const entityGraph = input.entity_graph || input.entityGraph || null;
    const intentFrame = normalizeIntentFrame(input.intent_frame || input.intentFrame || input.intent || {}, entityGraph);
    const goalId = input.goal_id || input.goalId || contextFrame?.goal_id || entityGraph?.goal_id || crypto.randomUUID();
    const correlationId = input.correlation_id || input.correlationId || goalId;
    const plannedAt = this.now();

    this.publish(GOAL.PLANNING, {
      goal_id: goalId,
      request_id: contextFrame?.request_id || entityGraph?.request_id || intentFrame.request_id || null,
      context_ref: contextFrame?.context_id || entityGraph?.context_ref || null,
      entity_graph_ref: entityGraph?.graph_id || null,
      intent_ref: intentFrame.intent_id,
      correlation_id: correlationId,
      source: 'GoalPlanner',
    });

    const selectedEntities = selectGoalEntities(entityGraph);
    const capabilities = deriveCapabilities(intentFrame);
    const plan = {
      abi: ABI,
      plan_version: PLAN_VERSION,
      plan_id: null,
      plan_hash: null,
      goal_id: goalId,
      intent_ref: intentFrame.intent_id,
      context_ref: contextFrame?.context_id || entityGraph?.context_ref || null,
      context_hash: contextFrame?.context_hash || null,
      entity_graph_ref: entityGraph?.graph_id || null,
      planned_at: plannedAt,
      objective: {
        intent: intentFrame.intent,
        confidence: intentFrame.confidence,
        primary_entity_ref: selectedEntities.primary?.entity_id || null,
        primary_entity_name: selectedEntities.primary?.canonical_name || selectedEntities.primary?.text || null,
      },
      constraints: clonePlainObject(intentFrame.constraints || {}),
      selected_entities: selectedEntities.entities,
      stages: createStages(capabilities, selectedEntities, intentFrame),
      stopping_conditions: {
        verification_required: true,
        requires_user_approval: requiresUserApproval(intentFrame),
      },
      provenance: {
        planner: 'GoalPlanner',
        capability_contract_version: CAPABILITY_CONTRACT_VERSION,
        planned_at: plannedAt,
      },
    };

    plan.plan_hash = createPlanHash(plan);
    plan.plan_id = createPlanId(plan);
    validateGoalPlan(plan);

    const immutablePlan = deepFreeze(plan);
    this.plans.set(immutablePlan.plan_id, immutablePlan);
    this.persist();

    this.publish(GOAL.PLANNED, {
      goal_id: goalId,
      request_id: contextFrame?.request_id || entityGraph?.request_id || intentFrame.request_id || null,
      context_ref: immutablePlan.context_ref,
      context_hash: immutablePlan.context_hash,
      entity_graph_ref: immutablePlan.entity_graph_ref,
      goal_plan_ref: immutablePlan.plan_id,
      plan: immutablePlan,
      correlation_id: correlationId,
      source: 'GoalPlanner',
    });

    return immutablePlan;
  }

  getPlan(planId) {
    return this.plans.get(planId) || null;
  }

  listPlans() {
    return Array.from(this.plans.values());
  }

  loadFromDisk() {
    const stored = this.persistence.retrieve(PLAN_COLLECTION);
    this.plans.clear();

    for (const plan of stored?.plans || []) {
      try {
        validateGoalPlan(plan);
        this.plans.set(plan.plan_id, deepFreeze(plan));
      } catch {
        // Invalid persisted goal plans are ignored during recovery.
      }
    }

    return this.listPlans();
  }

  persist() {
    return this.persistence.store(PLAN_COLLECTION, {
      abi: ABI,
      plans: this.listPlans(),
      updated_at: this.now(),
    });
  }

  publish(eventName, payload) {
    if (this.bus && typeof this.bus.publish === 'function') {
      this.bus.publish(eventName, payload);
    }
  }
}

let defaultGoalPlanner = null;

function getGoalPlanner() {
  if (!defaultGoalPlanner) {
    defaultGoalPlanner = new GoalPlanner();
  }
  return defaultGoalPlanner;
}

function normalizeNow(now) {
  if (typeof now === 'function') {
    return now;
  }
  return () => new Date().toISOString();
}

function normalizeIntentFrame(value, entityGraph) {
  const raw = typeof value === 'string' ? { intent: value } : clonePlainObject(value);
  const intent = normalizeIntent(raw.intent || raw.action || raw.type || 'GET');
  const confidence = clampConfidence(raw.confidence ?? 0.5);
  const requestId = raw.request_id || raw.requestId || entityGraph?.request_id || null;
  const intentId = raw.intent_id || raw.intentId || `intent_${hashStable({
    intent,
    confidence,
    request_id: requestId,
    constraints: raw.constraints || {},
  }).slice(0, 32)}`;

  return {
    intent_id: intentId,
    request_id: requestId,
    intent,
    confidence,
    constraints: clonePlainObject(raw.constraints || {}),
    metadata: clonePlainObject(raw.metadata || {}),
  };
}

function normalizeIntent(value) {
  return String(value || 'GET')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase() || 'GET';
}

function selectGoalEntities(entityGraph) {
  const entities = Array.isArray(entityGraph?.entities) ? entityGraph.entities : [];
  const primary = entities.find((entity) => entity.role === 'target')
    || entities.find((entity) => entity.role === 'destination')
    || entities[0]
    || null;

  return {
    primary,
    entities: entities.map((entity) => ({
      entity_ref: entity.entity_id,
      role: entity.role,
      canonical_name: entity.canonical_name,
      ontology_type: entity.ontology?.type || null,
      confidence: Math.min(entity.confidence, entity.ontology?.confidence ?? entity.confidence),
    })),
  };
}

function deriveCapabilities(intentFrame) {
  const intent = intentFrame.intent;

  // Discovery: find information, no commitment
  if (DISCOVERY_INTENTS.has(intent)) {
    return [
      Capability.DISCOVER,
      Capability.COMPARE,
      Capability.VERIFY,
    ];
  }

  // Financial transfer: authenticate → move value → execute → observe → verify
  if (intent === 'TRANSFER') {
    return [
      Capability.AUTHENTICATE,
      Capability.TRANSFER,
      Capability.EXECUTE,
      Capability.OBSERVE,
      Capability.VERIFY,
    ];
  }

  // Payment: authenticate → pay → execute → observe → verify
  if (intent === 'PAY') {
    return [
      Capability.AUTHENTICATE,
      Capability.PAY,
      Capability.EXECUTE,
      Capability.OBSERVE,
      Capability.VERIFY,
    ];
  }

  // Full execution intents: discover → compare → select → authenticate → pay → execute → observe → track → verify
  if (EXECUTION_INTENTS.has(intent)) {
    return [
      Capability.DISCOVER,
      Capability.COMPARE,
      Capability.SELECT,
      Capability.AUTHENTICATE,
      Capability.PAY,
      Capability.EXECUTE,
      Capability.OBSERVE,
      Capability.TRACK,
      Capability.VERIFY,
    ];
  }

  // Default: fetch a known object, execute, verify
  return [
    Capability.FETCH,
    Capability.EXECUTE,
    Capability.VERIFY,
  ];
}

function createStages(capabilities, selectedEntities, intentFrame) {
  return capabilities.map((capability, index) => ({
    stage_id: `stage_${index + 1}_${capability}`,
    sequence: index + 1,
    capability,
    capability_contract_version: CAPABILITY_CONTRACT_VERSION,
    entity_refs: selectedEntities.entities.map((entity) => entity.entity_ref),
    required_inputs: requiredInputsForCapability(capability, intentFrame),
    expected_observations: expectedObservationsForCapability(capability),
    verification_rule: verificationRuleForCapability(capability),
  }));
}

function requiredInputsForCapability(capability, intentFrame) {
  const base = ['context_ref', 'entity_graph_ref'];
  if (capability === Capability.PAY) {
    return [...base, 'amount_or_payment_authorization'];
  }
  if (capability === Capability.AUTHENTICATE) {
    return [...base, 'identity_ref'];
  }
  if (capability === Capability.SELECT) {
    return [...base, 'selection_criteria'];
  }
  if (Object.keys(intentFrame.constraints || {}).length > 0) {
    return [...base, 'constraints'];
  }
  return base;
}

function expectedObservationsForCapability(capability) {
  return [
    `${capability}.started`,
    `${capability}.completed`,
  ];
}

function verificationRuleForCapability(capability) {
  if (capability === Capability.VERIFY) {
    return 'final_state_verified';
  }
  return 'capability_completed';
}

function requiresUserApproval(intentFrame) {
  return EXECUTION_INTENTS.has(intentFrame.intent);
}

function validateGoalPlan(plan) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('GoalPlan must be an object');
  }
  if (plan.abi !== ABI) {
    throw new Error(`Invalid GoalPlan ABI: ${plan.abi}`);
  }
  if (plan.plan_version !== PLAN_VERSION) {
    throw new Error(`Invalid GoalPlan version: ${plan.plan_version}`);
  }
  if (!plan.plan_id || typeof plan.plan_id !== 'string') {
    throw new Error('GoalPlan requires plan_id');
  }
  if (!plan.plan_hash || typeof plan.plan_hash !== 'string') {
    throw new Error('GoalPlan requires plan_hash');
  }
  if (!plan.goal_id || typeof plan.goal_id !== 'string') {
    throw new Error('GoalPlan requires goal_id');
  }
  if (!plan.objective || typeof plan.objective !== 'object') {
    throw new Error('GoalPlan requires objective');
  }
  if (!Array.isArray(plan.stages) || plan.stages.length === 0) {
    throw new Error('GoalPlan requires stages');
  }

  for (const stage of plan.stages) {
    if (typeof stage.capability !== 'string' || !stage.capability) {
      throw new Error('GoalPlan stage requires capability');
    }
    // Reject namespaced (domain-specific) capabilities — ABI violation
    if (stage.capability.includes('.')) {
      throw new Error(`Capability must be universal, not namespaced: ${stage.capability}`);
    }
    // Reject non-canonical casing — ABI producers emit canonical values
    if (stage.capability !== stage.capability.toUpperCase()) {
      throw new Error(`Capability must be canonical uppercase ABI name: ${stage.capability}`);
    }
    // Reject unknown capabilities — must be in the universal catalog
    if (!CANONICAL_CAPABILITY_SET.has(stage.capability)) {
      throw new Error(`Unknown universal capability in GoalPlan: ${stage.capability}`);
    }
  }

  return true;
}

function createPlanId(plan) {
  return `goal_plan_${createPlanHash(plan).slice(0, 32)}`;
}

function createPlanHash(plan) {
  const payload = clonePlainObject(plan);
  delete payload.plan_id;
  delete payload.plan_hash;
  return hashStable(payload);
}

function clampConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  if (number > 1) return Math.max(0, Math.min(1, number / 100));
  return Math.max(0, Math.min(1, number));
}

function hashStable(value) {
  return crypto
    .createHash('sha256')
    .update(stableStringify(value))
    .digest('hex');
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function clonePlainObject(value) {
  return JSON.parse(JSON.stringify(value || (Array.isArray(value) ? [] : {})));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }

  return value;
}

function getDefaultPersistence() {
  return require('../db/persistence.cjs');
}

function getDefaultBus() {
  return require('../events/bus.cjs').bus;
}

const exported = {
  ABI,
  CANONICAL_CAPABILITY_SET,
  CAPABILITY_CONTRACT_VERSION,
  Capability,
  GoalPlanner,
  PLAN_COLLECTION,
  PLAN_VERSION,
  createPlanHash,
  createPlanId,
  deepFreeze,
  deriveCapabilities,
  getGoalPlanner,
  normalizeIntentFrame,
  validateGoalPlan,
};

Object.defineProperty(exported, 'goalPlanner', {
  enumerable: true,
  get: getGoalPlanner,
});

module.exports = exported;
