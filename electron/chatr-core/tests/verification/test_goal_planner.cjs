'use strict';

process.env.NODE_ENV = 'test';
const assert = require('assert');
const { ContextEngine } = require('../../context/context-engine.cjs');
const { EntityResolver } = require('../../entities/entity-resolver.cjs');
const { GoalPlanner, PLAN_COLLECTION } = require('../../kernel/goal-planner.cjs');
const { KernelEventBus } = require('../../events/bus.cjs');
const { GOAL } = require('../../events/events.cjs');

const FIXED_NOW = '2026-07-15T11:00:00.000Z';

async function run() {
  const persistence = createMemoryPersistence();
  const bus = new KernelEventBus();
  const plannedEvents = [];

  bus.subscribe(GOAL.PLANNED, (envelope) => {
    plannedEvents.push(envelope);
  });

  const contextEngine = new ContextEngine({
    persistence,
    bus,
    now: () => FIXED_NOW,
    sources: createContextSources(),
  });
  const entityResolver = new EntityResolver({
    persistence,
    bus,
    now: () => FIXED_NOW,
    ontology: createOntologyFixture(),
  });
  const planner = new GoalPlanner({
    persistence,
    bus,
    now: () => FIXED_NOW,
  });

  const contextFrame = await contextEngine.collect({
    goal_id: 'goal_planner_proof',
    text: 'Order Chicken Biryani',
    source: 'user',
  });
  const entityGraph = await entityResolver.resolve({ context_frame: contextFrame });
  const first = planner.plan({
    goal_id: 'goal_planner_proof',
    context_frame: contextFrame,
    entity_graph: entityGraph,
    intent_frame: {
      intent_id: 'intent_order_proof',
      intent: 'ORDER',
      confidence: 0.97,
      constraints: {},
    },
  });
  const second = planner.plan({
    goal_id: 'goal_planner_proof',
    context_frame: contextFrame,
    entity_graph: entityGraph,
    intent_frame: {
      intent_id: 'intent_order_proof',
      intent: 'ORDER',
      confidence: 0.97,
      constraints: {},
    },
  });

  assert.deepStrictEqual(second, first, 'same frames should produce identical GoalPlan');
  assert.equal(first.abi, 'chatr.goal_plan.v0_9_rc');
  assert.equal(first.plan_version, 1);
  assert.equal(first.plan_id, `goal_plan_${first.plan_hash.slice(0, 32)}`);
  assert.equal(first.goal_id, 'goal_planner_proof');
  assert.equal(first.context_ref, contextFrame.context_id);
  assert.equal(first.context_hash, contextFrame.context_hash);
  assert.equal(first.entity_graph_ref, entityGraph.graph_id);
  assert.equal(first.objective.intent, 'ORDER');
  assert.equal(first.objective.primary_entity_name, 'Chicken Biryani');
  assert.ok(Object.isFrozen(first), 'GoalPlan should be immutable');
  assert.ok(Object.isFrozen(first.stages[0]), 'GoalPlan stages should be immutable');
  assert.throws(() => {
    first.stages[0].capability = 'changed';
  }, /Cannot assign|read only/);

  const capabilities = first.stages.map((stage) => stage.capability);
  assert.deepStrictEqual(capabilities, [
    'search',
    'compare',
    'select',
    'authenticate',
    'pay',
    'execute',
    'track',
    'verify',
  ]);
  assert.ok(first.stages.every((stage) => !stage.capability.includes('.')), 'capabilities must stay universal');
  assert.ok(first.stages.every((stage) => stage.capability_contract_version === '1.0'));
  assert.equal(first.stopping_conditions.verification_required, true);

  assert.equal(plannedEvents.length, 2);
  const planned = plannedEvents[plannedEvents.length - 1];
  assert.equal(planned.event_type, 'goal.planned');
  assert.equal(planned.payload.goal_plan_ref, first.plan_id);
  assert.equal(planned.payload.context_hash, contextFrame.context_hash);

  const reloadedPlanner = new GoalPlanner({
    persistence,
    bus,
    now: () => FIXED_NOW,
  });
  const reloaded = reloadedPlanner.getPlan(first.plan_id);
  assert.deepStrictEqual(reloaded, first, 'GoalPlan should reload from persistence');
  assert.ok(Object.isFrozen(reloaded), 'reloaded GoalPlan should be immutable');

  const discovery = planner.plan({
    goal_id: 'goal_discovery_proof',
    intent_frame: {
      intent: 'FIND',
      confidence: 0.91,
    },
  });
  assert.deepStrictEqual(discovery.stages.map((stage) => stage.capability), ['search', 'compare', 'verify']);

  const transfer = planner.plan({
    goal_id: 'goal_transfer_proof',
    intent_frame: {
      intent: 'TRANSFER',
      confidence: 0.94,
      constraints: {
        amount_ref: 'entity_amount_1',
      },
    },
  });
  assert.deepStrictEqual(transfer.stages.map((stage) => stage.capability), ['authenticate', 'pay', 'execute', 'verify']);

  console.log('Goal Planner immutable GoalPlan test passed.');
}

function createContextSources() {
  return {
    time: () => ({
      status: 'available',
      iso: FIXED_NOW,
      timestamp_ms: Date.parse(FIXED_NOW),
      timezone: 'Asia/Calcutta',
      offset_minutes: -330,
    }),
    gps: () => ({
      status: 'missing',
      permission: 'unknown',
      latitude: null,
      longitude: null,
      accuracy_meters: null,
      source: 'none',
    }),
  };
}

function createOntologyFixture() {
  return {
    source: 'test_ontology',
    resolve(candidate) {
      if (candidate.text.toLowerCase() === 'chicken biryani') {
        return {
          canonical_name: 'Chicken Biryani',
          type: 'PreparedItem',
          lineage: ['Entity', 'CatalogItem', 'PreparedItem'],
          confidence: 0.97,
          source: 'test_ontology',
        };
      }

      return null;
    },
  };
}

function createMemoryPersistence() {
  const kv = new Map();

  return {
    store(collection, data) {
      kv.set(collection, JSON.parse(JSON.stringify(data)));
      return true;
    },
    retrieve(collection) {
      const value = kv.get(collection);
      return value ? JSON.parse(JSON.stringify(value)) : null;
    },
    append() {
      return true;
    },
    flush(collection) {
      kv.delete(collection || PLAN_COLLECTION);
      return true;
    },
  };
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
