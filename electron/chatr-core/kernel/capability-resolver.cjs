'use strict';

const crypto = require('crypto');
const { CAPABILITY } = require('../events/events.cjs');

const ABI = 'chatr.capability_graph.v0_9_rc';
const REQUEST_ABI = 'chatr.capability_request.v0_9_rc';
const GRAPH_VERSION = 1;
const CAPABILITY_CONTRACT_VERSION = '1.0.0';
const GRAPH_COLLECTION = 'kernel_capability_graphs_v0_9_rc';

const Capability = Object.freeze({
  DISCOVER: 'DISCOVER',
  FETCH: 'FETCH',
  COMPARE: 'COMPARE',
  SELECT: 'SELECT',
  COLLECT_INPUT: 'COLLECT_INPUT',
  AUTHENTICATE: 'AUTHENTICATE',
  AUTHORIZE: 'AUTHORIZE',
  PAY: 'PAY',
  TRANSFER: 'TRANSFER',
  EXECUTE: 'EXECUTE',
  OBSERVE: 'OBSERVE',
  RECONCILE: 'RECONCILE',
  RECOVER: 'RECOVER',
  TRACK: 'TRACK',
  VERIFY: 'VERIFY',
  SUSPEND: 'SUSPEND',
  RESUME: 'RESUME',
  CANCEL: 'CANCEL',
  COMMUNICATE: 'COMMUNICATE',
  SCHEDULE: 'SCHEDULE',
  STORE: 'STORE',
  NOTIFY: 'NOTIFY',
  LEARN: 'LEARN',
});

const DEFAULT_STRATEGY_SUPPORT = Object.freeze([
  'fastest',
  'cheapest',
  'highest_rated',
  'most_trusted',
  'local_first',
  'privacy_first',
  'energy_efficient',
  'offline_first',
  'user_preferred',
  'policy_required',
]);

/**
 * @deprecated — B-01 Migration
 * LEGACY_CAPABILITY_ALIASES normalizes non-canonical inputs to canonical ABI names.
 * This map exists only as a migration bridge for any external caller that has not
 * yet been updated to emit canonical uppercase capability names.
 *
 * Removal condition: all ABI producers (GoalPlanner and any external planners)
 * emit canonical uppercase names. Architecture Lint will then enforce canonical
 * spelling and this map becomes dead code.
 *
 * TSC decision (2026-07-15): resolver must validate, not repair.
 * Do NOT add new entries to this map.
 */
const LEGACY_CAPABILITY_ALIASES = Object.freeze({
  authenticate: Capability.AUTHENTICATE,
  authorize: Capability.AUTHORIZE,
  cancel: Capability.CANCEL,
  collect: Capability.COLLECT_INPUT,
  collect_input: Capability.COLLECT_INPUT,
  compare: Capability.COMPARE,
  communicate: Capability.COMMUNICATE,
  discover: Capability.DISCOVER,
  execute: Capability.EXECUTE,
  fetch: Capability.FETCH,
  find: Capability.DISCOVER,
  learn: Capability.LEARN,
  lookup: Capability.DISCOVER,
  notify: Capability.NOTIFY,
  observe: Capability.OBSERVE,
  pay: Capability.PAY,
  reconcile: Capability.RECONCILE,
  recover: Capability.RECOVER,
  resume: Capability.RESUME,
  schedule: Capability.SCHEDULE,
  search: Capability.DISCOVER,
  select: Capability.SELECT,
  store: Capability.STORE,
  suspend: Capability.SUSPEND,
  track: Capability.TRACK,
  transfer: Capability.TRANSFER,
  verify: Capability.VERIFY,
});

const UNIVERSAL_CAPABILITY_CATALOG = Object.freeze({
  [Capability.DISCOVER]: createCapabilityContract({
    capability: Capability.DISCOVER,
    requiredInputs: ['context_ref', 'entity_graph_ref'],
    outputs: ['candidate_options'],
    risk: 'low',
    approval: 'none',
    contextRequirements: ['context_ref', 'entity_graph_ref', 'permissions'],
    expectedObservations: ['candidate_options.available'],
  }),
  [Capability.FETCH]: createCapabilityContract({
    capability: Capability.FETCH,
    requiredInputs: ['context_ref', 'entity_ref'],
    outputs: ['object_state'],
    risk: 'low',
    approval: 'none',
    contextRequirements: ['context_ref'],
    expectedObservations: ['object_state.loaded'],
  }),
  [Capability.COMPARE]: createCapabilityContract({
    capability: Capability.COMPARE,
    requiredInputs: ['candidate_options', 'constraints'],
    outputs: ['ranked_options'],
    risk: 'low',
    approval: 'none',
    contextRequirements: ['preferences', 'policy_refs'],
    expectedObservations: ['ranked_options.ready'],
  }),
  [Capability.SELECT]: createCapabilityContract({
    capability: Capability.SELECT,
    requiredInputs: ['ranked_options', 'selection_criteria'],
    outputs: ['selected_option'],
    risk: 'medium',
    approval: 'user_when_ambiguous',
    contextRequirements: ['preferences', 'policy_refs'],
    expectedObservations: ['selection.recorded'],
  }),
  [Capability.COLLECT_INPUT]: createCapabilityContract({
    capability: Capability.COLLECT_INPUT,
    requiredInputs: ['input_schema', 'current_context'],
    outputs: ['structured_fields'],
    risk: 'medium',
    approval: 'user',
    contextRequirements: ['context_ref'],
    expectedObservations: ['input.completed'],
  }),
  [Capability.AUTHENTICATE]: createCapabilityContract({
    capability: Capability.AUTHENTICATE,
    requiredInputs: ['identity_ref', 'auth_requirement'],
    outputs: ['session_ref'],
    risk: 'high',
    approval: 'user',
    contextRequirements: ['identity', 'permissions'],
    expectedObservations: ['identity.verified'],
  }),
  [Capability.AUTHORIZE]: createCapabilityContract({
    capability: Capability.AUTHORIZE,
    requiredInputs: ['action_summary', 'risk', 'policy_refs'],
    outputs: ['approval_receipt'],
    risk: 'high',
    approval: 'explicit_authorization',
    contextRequirements: ['identity', 'policy_refs'],
    expectedObservations: ['authorization.granted'],
    verificationRequired: true,
  }),
  [Capability.PAY]: createCapabilityContract({
    capability: Capability.PAY,
    requiredInputs: ['amount_or_payment_authorization', 'payment_instrument_ref', 'policy_refs'],
    outputs: ['payment_receipt'],
    risk: 'high',
    approval: 'explicit_authorization',
    contextRequirements: ['identity', 'wallet', 'policy_refs'],
    expectedObservations: ['payment.receipt.created'],
    verificationRequired: true,
  }),
  [Capability.TRANSFER]: createCapabilityContract({
    capability: Capability.TRANSFER,
    requiredInputs: ['value_ref', 'source_ref', 'target_ref', 'policy_refs'],
    outputs: ['transfer_receipt'],
    risk: 'high',
    approval: 'explicit_authorization',
    contextRequirements: ['identity', 'wallet', 'policy_refs'],
    expectedObservations: ['transfer.receipt.created'],
    verificationRequired: true,
  }),
  [Capability.EXECUTE]: createCapabilityContract({
    capability: Capability.EXECUTE,
    requiredInputs: ['selected_option', 'provider_ref', 'policy_decision_ref'],
    outputs: ['execution_receipt'],
    risk: 'medium',
    approval: 'depends_on_policy',
    contextRequirements: ['permissions', 'policy_refs'],
    expectedObservations: ['execution.committed'],
    verificationRequired: true,
  }),
  [Capability.OBSERVE]: createCapabilityContract({
    capability: Capability.OBSERVE,
    requiredInputs: ['goal_state_ref', 'execution_receipt'],
    outputs: ['observation_event'],
    risk: 'low',
    approval: 'none',
    contextRequirements: ['world_state_refs'],
    expectedObservations: ['world_state.observed'],
  }),
  [Capability.RECONCILE]: createCapabilityContract({
    capability: Capability.RECONCILE,
    requiredInputs: ['goal_plan_ref', 'world_state_ref', 'policy_refs'],
    outputs: ['reconciliation_decision'],
    risk: 'low',
    approval: 'none',
    contextRequirements: ['world_state_refs', 'policy_refs'],
    expectedObservations: ['reconciliation.decided'],
  }),
  [Capability.RECOVER]: createCapabilityContract({
    capability: Capability.RECOVER,
    requiredInputs: ['failure_state_ref', 'recovery_policy_ref'],
    outputs: ['recovery_receipt'],
    risk: 'medium',
    approval: 'depends_on_policy',
    contextRequirements: ['policy_refs', 'execution_memory'],
    expectedObservations: ['recovery.attempted'],
  }),
  [Capability.TRACK]: createCapabilityContract({
    capability: Capability.TRACK,
    requiredInputs: ['execution_receipt'],
    outputs: ['status_snapshot'],
    risk: 'low',
    approval: 'none',
    contextRequirements: ['world_state_refs'],
    expectedObservations: ['status.updated'],
  }),
  [Capability.VERIFY]: createCapabilityContract({
    capability: Capability.VERIFY,
    requiredInputs: ['expected_outcome', 'evidence_refs'],
    outputs: ['verification_report'],
    risk: 'low',
    approval: 'none',
    contextRequirements: ['world_state_refs'],
    expectedObservations: ['verification.completed'],
    verificationRequired: true,
  }),
  [Capability.SUSPEND]: createCapabilityContract({
    capability: Capability.SUSPEND,
    requiredInputs: ['goal_state_ref', 'wake_condition'],
    outputs: ['suspension_receipt'],
    risk: 'low',
    approval: 'none',
    contextRequirements: ['goal_state_ref'],
    expectedObservations: ['goal.suspended'],
  }),
  [Capability.RESUME]: createCapabilityContract({
    capability: Capability.RESUME,
    requiredInputs: ['suspended_goal_ref', 'wake_event'],
    outputs: ['resumed_goal_state'],
    risk: 'low',
    approval: 'none',
    contextRequirements: ['goal_state_ref'],
    expectedObservations: ['goal.resumed'],
  }),
  [Capability.CANCEL]: createCapabilityContract({
    capability: Capability.CANCEL,
    requiredInputs: ['execution_receipt', 'cancellation_policy_ref'],
    outputs: ['cancellation_receipt'],
    risk: 'high',
    approval: 'user',
    contextRequirements: ['identity', 'policy_refs'],
    expectedObservations: ['cancellation.completed'],
    verificationRequired: true,
  }),
  [Capability.COMMUNICATE]: createCapabilityContract({
    capability: Capability.COMMUNICATE,
    requiredInputs: ['message_schema', 'recipient_refs', 'channel_ref'],
    outputs: ['communication_receipt'],
    risk: 'medium',
    approval: 'depends_on_policy',
    contextRequirements: ['identity', 'permissions', 'policy_refs'],
    expectedObservations: ['communication.sent_or_received'],
  }),
  [Capability.SCHEDULE]: createCapabilityContract({
    capability: Capability.SCHEDULE,
    requiredInputs: ['time_ref', 'participant_refs', 'resource_refs'],
    outputs: ['schedule_receipt'],
    risk: 'medium',
    approval: 'user_when_external',
    contextRequirements: ['permissions', 'policy_refs'],
    expectedObservations: ['schedule.updated'],
  }),
  [Capability.STORE]: createCapabilityContract({
    capability: Capability.STORE,
    requiredInputs: ['artifact_ref', 'destination_ref', 'retention_policy_ref'],
    outputs: ['storage_receipt'],
    risk: 'low',
    approval: 'none',
    contextRequirements: ['permissions', 'policy_refs'],
    expectedObservations: ['artifact.stored'],
  }),
  [Capability.NOTIFY]: createCapabilityContract({
    capability: Capability.NOTIFY,
    requiredInputs: ['recipient_ref', 'message_schema', 'channel_ref'],
    outputs: ['notification_receipt'],
    risk: 'low',
    approval: 'none',
    contextRequirements: ['permissions'],
    expectedObservations: ['notification.delivered'],
  }),
  [Capability.LEARN]: createCapabilityContract({
    capability: Capability.LEARN,
    requiredInputs: ['correction_ref', 'evidence_refs', 'validation_target_ref'],
    outputs: ['learning_event'],
    risk: 'low',
    approval: 'none',
    contextRequirements: ['execution_memory'],
    expectedObservations: ['learning.recorded'],
  }),
});

class CapabilityResolver {
  constructor(options = {}) {
    this.persistence = options.persistence || getDefaultPersistence();
    this.bus = options.bus || getDefaultBus();
    this.now = normalizeNow(options.now);
    this.graphs = new Map();
    this.loadFromDisk();
  }

  resolve(input = {}) {
    const goalPlan = normalizeGoalPlan(input.goal_plan || input.goalPlan || input.plan);
    const goalId = input.goal_id || input.goalId || goalPlan.goal_id;
    const correlationId = input.correlation_id || input.correlationId || goalId || goalPlan.plan_id;
    const resolvedAt = this.now();

    this.publish(CAPABILITY.RESOLVING, {
      goal_id: goalId,
      goal_plan_ref: goalPlan.plan_id,
      context_ref: goalPlan.context_ref || null,
      entity_graph_ref: goalPlan.entity_graph_ref || null,
      correlation_id: correlationId,
      source: 'CapabilityResolver',
    });

    try {
      const graph = createCapabilityGraph(goalPlan, {
        graph_id: input.capability_graph_id || input.capabilityGraphId || null,
        resolved_at: resolvedAt,
      });
      validateCapabilityGraph(graph);

      const immutableGraph = deepFreeze(graph);

      // capability.graph.created: graph allocated, validated, immutable.
      // Not yet persisted or published to subscribers.
      this.publish(CAPABILITY.GRAPH_CREATED, {
        goal_id: goalId,
        goal_plan_ref: immutableGraph.goal_plan_ref,
        capability_graph_ref: immutableGraph.graph_id,
        graph_hash: immutableGraph.graph_hash,
        node_count: immutableGraph.nodes.length,
        correlation_id: correlationId,
        source: 'CapabilityResolver',
      });

      // dry_run: skip persistence and the RESOLVED event.
      // Used only for performance measurement — isolates graph computation from I/O.
      if (input.dry_run) {
        return immutableGraph;
      }

      this.graphs.set(immutableGraph.graph_id, immutableGraph);
      this.persist();

      this.publish(CAPABILITY.RESOLVED, {
        goal_id: goalId,
        goal_plan_ref: immutableGraph.goal_plan_ref,
        capability_graph_ref: immutableGraph.graph_id,
        context_ref: immutableGraph.context_ref,
        entity_graph_ref: immutableGraph.entity_graph_ref,
        graph: immutableGraph,
        correlation_id: correlationId,
        source: 'CapabilityResolver',
      });

      return immutableGraph;
    } catch (error) {
      this.publish(CAPABILITY.FAILED, {
        goal_id: goalId,
        goal_plan_ref: goalPlan.plan_id,
        error: error.message,
        correlation_id: correlationId,
        source: 'CapabilityResolver',
      });
      throw error;
    }
  }

  getGraph(graphId) {
    return this.graphs.get(graphId) || null;
  }

  listGraphs() {
    return Array.from(this.graphs.values());
  }

  loadFromDisk() {
    const stored = this.persistence.retrieve(GRAPH_COLLECTION);
    this.graphs.clear();

    for (const graph of stored?.graphs || []) {
      try {
        validateCapabilityGraph(graph);
        this.graphs.set(graph.graph_id, deepFreeze(graph));
      } catch {
        // Invalid persisted capability graphs are ignored during recovery.
      }
    }

    return this.listGraphs();
  }

  persist() {
    return this.persistence.store(GRAPH_COLLECTION, {
      abi: ABI,
      graphs: this.listGraphs(),
      updated_at: this.now(),
    });
  }

  publish(eventName, payload) {
    if (this.bus && typeof this.bus.publish === 'function') {
      this.bus.publish(eventName, payload);
    }
  }
}

let defaultCapabilityResolver = null;

function getCapabilityResolver() {
  if (!defaultCapabilityResolver) {
    defaultCapabilityResolver = new CapabilityResolver();
  }
  return defaultCapabilityResolver;
}

function createCapabilityGraph(goalPlan, options = {}) {
  const plan = normalizeGoalPlan(goalPlan);
  const resolvedAt = options.resolved_at || options.resolvedAt || new Date().toISOString();
  const stages = normalizeGoalStages(plan);
  const nodes = [];
  const edges = [];

  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index];
    const capability = normalizeCapability(stage.capability, plan);
    const contract = getCapabilityContract(capability);
    const entityRefs = normalizeEntityRefs(stage, plan);
    const nodeId = createNodeId(plan, stage, capability, index);
    const request = createCapabilityRequest({
      capability,
      contract,
      entityRefs,
      goalPlan: plan,
      stage,
      sequence: index + 1,
    });
    const dependsOn = index > 0 ? [nodes[index - 1].node_id] : [];

    nodes.push({
      node_id: nodeId,
      sequence: index + 1,
      capability,
      capability_contract_version: contract.contract_version,
      depends_on: dependsOn,
      entity_refs: entityRefs,
      risk: contract.policy_requirements.default_risk,
      approval: contract.policy_requirements.approval,
      source_stage_ref: stage.stage_id || stage.id || null,
      capability_request: request,
      source_stage: {
        required_inputs: clonePlainObject(stage.required_inputs || []),
        expected_observations: clonePlainObject(stage.expected_observations || []),
        verification_rule: stage.verification_rule || null,
      },
    });

    if (index > 0) {
      edges.push({
        edge_id: createEdgeId(nodes[index - 1].node_id, nodeId),
        from: nodes[index - 1].node_id,
        to: nodeId,
        type: 'sequential_dependency',
      });
    }
  }

  const graph = {
    abi: ABI,
    graph_version: GRAPH_VERSION,
    graph_id: options.graph_id || null,
    graph_hash: null,
    goal_id: plan.goal_id,
    goal_plan_ref: plan.plan_id,
    goal_plan_hash: plan.plan_hash || null,
    intent_ref: plan.intent_ref || null,
    context_ref: plan.context_ref || null,
    context_hash: plan.context_hash || null,
    entity_graph_ref: plan.entity_graph_ref || null,
    resolved_at: resolvedAt,
    capability_contract_version: CAPABILITY_CONTRACT_VERSION,
    objective: clonePlainObject(plan.objective || {}),
    constraints: clonePlainObject(plan.constraints || {}),
    selected_entities: clonePlainObject(plan.selected_entities || []),
    nodes,
    edges,
    stopping_conditions: clonePlainObject(plan.stopping_conditions || {}),
    provenance: {
      resolver: 'CapabilityResolver',
      goal_plan_ref: plan.plan_id,
      goal_plan_hash: plan.plan_hash || null,
      resolved_at: resolvedAt,
    },
  };

  graph.graph_hash = createCapabilityGraphHash(graph);
  graph.graph_id = graph.graph_id || createCapabilityGraphId(graph);
  return graph;
}

function createCapabilityRequest({ capability, contract, entityRefs, goalPlan, stage, sequence }) {
  const request = {
    abi: REQUEST_ABI,
    request_id: null,
    capability,
    capability_contract_version: contract.contract_version,
    entity_ref: entityRefs[0] || goalPlan.objective?.primary_entity_ref || null,
    entity_refs: entityRefs,
    input_schema: clonePlainObject(contract.input_schema),
    output_schema: clonePlainObject(contract.output_schema),
    constraints: clonePlainObject(goalPlan.constraints || {}),
    context_requirements: clonePlainObject(contract.context_requirements),
    risk: contract.policy_requirements.default_risk,
    policy_requirements: clonePlainObject(contract.policy_requirements),
    strategy_support: clonePlainObject(contract.strategy_support),
    expected_observations: clonePlainObject(contract.expected_observations),
    verification_rules: clonePlainObject(contract.verification_rules),
  };

  request.request_id = `cap_req_${hashStable({
    goal_plan_ref: goalPlan.plan_id,
    source_stage_ref: stage.stage_id || stage.id || sequence,
    capability,
    entity_refs: entityRefs,
  }).slice(0, 32)}`;
  return request;
}

function normalizeGoalPlan(plan) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('CapabilityResolver requires a GoalPlan');
  }
  if (plan.abi !== 'chatr.goal_plan.v0_9_rc') {
    throw new Error(`CapabilityResolver requires GoalPlan ABI, received: ${plan.abi}`);
  }
  if (!plan.plan_id || typeof plan.plan_id !== 'string') {
    throw new Error('GoalPlan requires plan_id before capability resolution');
  }
  if (!plan.goal_id || typeof plan.goal_id !== 'string') {
    throw new Error('GoalPlan requires goal_id before capability resolution');
  }
  return plan;
}

function normalizeGoalStages(plan) {
  const stages = Array.isArray(plan.stages)
    ? plan.stages
    : Array.isArray(plan.steps)
      ? plan.steps
      : [];

  if (stages.length === 0) {
    throw new Error('GoalPlan requires stages before capability resolution');
  }

  return stages;
}

function normalizeCapability(rawCapability, goalPlan = {}) {
  const raw = String(rawCapability || '').trim();
  if (!raw) {
    throw new Error('Capability stage requires capability');
  }
  if (raw.includes('.')) {
    throw new Error(`Capability must be universal, not namespaced: ${raw}`);
  }
  // ABI producers must emit canonical uppercase names (B-01).
  // The resolver validates, not repairs. Reject non-uppercase inputs.
  // LEGACY_CAPABILITY_ALIASES is a deprecated migration bridge only.
  if (raw !== raw.toUpperCase()) {
    throw new Error(
      `Capability must be canonical uppercase ABI name: "${raw}". ` +
      `ABI producers must emit canonical values; the resolver does not normalize casing. ` +
      `(LEGACY_CAPABILITY_ALIASES is deprecated — B-01)`
    );
  }

  // Canonical uppercase path — verify it exists in the universal catalog
  if (UNIVERSAL_CAPABILITY_CATALOG[raw]) {
    // TRANSFER intent context override still applies for GoalPlan-level intent signals
    if (raw === Capability.PAY && goalPlan.objective?.intent === 'TRANSFER') {
      return Capability.TRANSFER;
    }
    return raw;
  }

  throw new Error(`Unknown universal capability: ${raw}`);
}

function normalizeContractVersion(value) {
  const raw = String(value || CAPABILITY_CONTRACT_VERSION).trim();
  if (raw === '1.0') return CAPABILITY_CONTRACT_VERSION;
  return raw;
}

function normalizeEntityRefs(stage, goalPlan) {
  const stageRefs = Array.isArray(stage.entity_refs) ? stage.entity_refs : [];
  if (stageRefs.length > 0) {
    return stageRefs.map(String).filter(Boolean);
  }

  const selected = Array.isArray(goalPlan.selected_entities) ? goalPlan.selected_entities : [];
  return selected
    .map((entity) => entity.entity_ref)
    .filter(Boolean);
}

function getCapabilityContract(capability) {
  const contract = UNIVERSAL_CAPABILITY_CATALOG[capability];
  if (!contract) {
    throw new Error(`Unknown universal capability: ${capability}`);
  }
  return contract;
}

function validateCapabilityGraph(graph) {
  if (!graph || typeof graph !== 'object') {
    throw new Error('CapabilityGraph must be an object');
  }
  if (graph.abi !== ABI) {
    throw new Error(`Invalid CapabilityGraph ABI: ${graph.abi}`);
  }
  if (graph.graph_version !== GRAPH_VERSION) {
    throw new Error(`Invalid CapabilityGraph version: ${graph.graph_version}`);
  }
  if (!graph.graph_id || typeof graph.graph_id !== 'string') {
    throw new Error('CapabilityGraph requires graph_id');
  }
  if (!graph.graph_hash || typeof graph.graph_hash !== 'string') {
    throw new Error('CapabilityGraph requires graph_hash');
  }
  if (graph.graph_id !== createCapabilityGraphId(graph)) {
    throw new Error('CapabilityGraph graph_id does not match graph_hash');
  }
  if (!graph.goal_id || typeof graph.goal_id !== 'string') {
    throw new Error('CapabilityGraph requires goal_id');
  }
  if (!graph.goal_plan_ref || typeof graph.goal_plan_ref !== 'string') {
    throw new Error('CapabilityGraph requires goal_plan_ref');
  }
  if (normalizeContractVersion(graph.capability_contract_version) !== CAPABILITY_CONTRACT_VERSION) {
    throw new Error(`Unsupported capability contract version: ${graph.capability_contract_version}`);
  }
  if (Number.isNaN(Date.parse(graph.resolved_at))) {
    throw new Error('CapabilityGraph requires resolved_at ISO timestamp');
  }
  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    throw new Error('CapabilityGraph requires nodes');
  }
  if (!Array.isArray(graph.edges)) {
    throw new Error('CapabilityGraph requires edges');
  }

  const nodeIds = new Set();
  for (const node of graph.nodes) {
    validateCapabilityNode(node);
    if (nodeIds.has(node.node_id)) {
      throw new Error(`Duplicate CapabilityGraph node_id: ${node.node_id}`);
    }
    nodeIds.add(node.node_id);
  }

  for (const edge of graph.edges) {
    if (!edge.edge_id || !edge.from || !edge.to) {
      throw new Error('CapabilityGraph edge requires edge_id, from, and to');
    }
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(`CapabilityGraph edge references unknown node: ${edge.edge_id}`);
    }
  }

  return true;
}

function validateCapabilityNode(node) {
  if (!node || typeof node !== 'object') {
    throw new Error('CapabilityGraph node must be an object');
  }
  if (!node.node_id || typeof node.node_id !== 'string') {
    throw new Error('CapabilityGraph node requires node_id');
  }
  if (!Number.isInteger(node.sequence) || node.sequence < 1) {
    throw new Error('CapabilityGraph node requires positive sequence');
  }
  if (!node.capability || typeof node.capability !== 'string') {
    throw new Error('CapabilityGraph node requires capability');
  }
  if (node.capability.includes('.')) {
    throw new Error(`Capability must be universal, not namespaced: ${node.capability}`);
  }
  if (!/^[A-Z][A-Z0-9_]*$/.test(node.capability)) {
    throw new Error(`Capability must be canonical uppercase: ${node.capability}`);
  }
  if (!UNIVERSAL_CAPABILITY_CATALOG[node.capability]) {
    throw new Error(`Unknown universal capability: ${node.capability}`);
  }
  if (normalizeContractVersion(node.capability_contract_version) !== CAPABILITY_CONTRACT_VERSION) {
    throw new Error(`Unsupported capability contract version: ${node.capability_contract_version}`);
  }
  if (!Array.isArray(node.depends_on)) {
    throw new Error('CapabilityGraph node requires depends_on array');
  }
  validateCapabilityRequest(node.capability_request, node.capability);
}

function validateCapabilityRequest(request, expectedCapability) {
  if (!request || typeof request !== 'object') {
    throw new Error('CapabilityRequest must be an object');
  }
  if (request.abi !== REQUEST_ABI) {
    throw new Error(`Invalid CapabilityRequest ABI: ${request.abi}`);
  }
  if (!request.request_id || typeof request.request_id !== 'string') {
    throw new Error('CapabilityRequest requires request_id');
  }
  if (request.capability !== expectedCapability) {
    throw new Error(`CapabilityRequest capability mismatch: ${request.capability}`);
  }
  if (request.capability.includes('.')) {
    throw new Error(`CapabilityRequest must be universal, not namespaced: ${request.capability}`);
  }
  if (normalizeContractVersion(request.capability_contract_version) !== CAPABILITY_CONTRACT_VERSION) {
    throw new Error(`Unsupported CapabilityRequest contract version: ${request.capability_contract_version}`);
  }
  if (!request.input_schema || typeof request.input_schema !== 'object') {
    throw new Error('CapabilityRequest requires input_schema');
  }
  if (!request.output_schema || typeof request.output_schema !== 'object') {
    throw new Error('CapabilityRequest requires output_schema');
  }
  if (!Array.isArray(request.context_requirements)) {
    throw new Error('CapabilityRequest requires context_requirements');
  }
  if (!request.risk || typeof request.risk !== 'string') {
    throw new Error('CapabilityRequest requires risk');
  }
  if (!Array.isArray(request.strategy_support)) {
    throw new Error('CapabilityRequest requires strategy_support');
  }
  if (!Array.isArray(request.expected_observations)) {
    throw new Error('CapabilityRequest requires expected_observations');
  }
  if (!request.verification_rules || typeof request.verification_rules !== 'object') {
    throw new Error('CapabilityRequest requires verification_rules');
  }
  return true;
}

function createCapabilityContract({
  capability,
  requiredInputs,
  outputs,
  risk,
  approval,
  contextRequirements,
  expectedObservations,
  verificationRequired = false,
}) {
  return Object.freeze({
    abi: 'chatr.capability_contract.v0_9_rc',
    capability,
    contract_version: CAPABILITY_CONTRACT_VERSION,
    input_schema: Object.freeze({
      type: 'object',
      required: Object.freeze([...requiredInputs]),
      properties: Object.freeze(Object.fromEntries(requiredInputs.map((key) => [
        key,
        Object.freeze({ type: ['string', 'number', 'boolean', 'object', 'array', 'null'] }),
      ]))),
      additionalProperties: true,
    }),
    output_schema: Object.freeze({
      type: 'object',
      required: Object.freeze([...outputs]),
      properties: Object.freeze(Object.fromEntries(outputs.map((key) => [
        key,
        Object.freeze({ type: ['string', 'number', 'boolean', 'object', 'array', 'null'] }),
      ]))),
      additionalProperties: true,
    }),
    policy_requirements: Object.freeze({
      default_risk: risk,
      approval,
    }),
    strategy_support: DEFAULT_STRATEGY_SUPPORT,
    context_requirements: Object.freeze([...contextRequirements]),
    expected_observations: Object.freeze([...expectedObservations]),
    verification_rules: Object.freeze({
      required: verificationRequired,
      evidence: Object.freeze(verificationRequired ? ['receipt_or_observation'] : []),
    }),
  });
}

function createCapabilityGraphId(graph) {
  return `capability_graph_${createCapabilityGraphHash(graph).slice(0, 32)}`;
}

function createCapabilityGraphHash(graph) {
  const payload = clonePlainObject(graph);
  delete payload.graph_id;
  delete payload.graph_hash;
  return hashStable(payload);
}

function createNodeId(goalPlan, stage, capability, index) {
  return `cap_node_${hashStable({
    goal_plan_ref: goalPlan.plan_id,
    source_stage_ref: stage.stage_id || stage.id || index + 1,
    capability,
    sequence: index + 1,
  }).slice(0, 32)}`;
}

function createEdgeId(from, to) {
  return `cap_edge_${hashStable({ from, to, type: 'sequential_dependency' }).slice(0, 32)}`;
}

function normalizeNow(now) {
  if (typeof now === 'function') {
    return now;
  }
  return () => new Date().toISOString();
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
  CAPABILITY_CONTRACT_VERSION,
  Capability,
  CapabilityResolver,
  GRAPH_COLLECTION,
  GRAPH_VERSION,
  REQUEST_ABI,
  UNIVERSAL_CAPABILITY_CATALOG,
  createCapabilityGraph,
  createCapabilityGraphHash,
  createCapabilityGraphId,
  createCapabilityRequest,
  deepFreeze,
  getCapabilityResolver,
  normalizeCapability,
  validateCapabilityGraph,
  validateCapabilityRequest,
};

Object.defineProperty(exported, 'capabilityResolver', {
  enumerable: true,
  get: getCapabilityResolver,
});

module.exports = exported;
