'use strict';

process.env.NODE_ENV = 'test';
const assert = require('assert');
const { ContextEngine } = require('../../context/context-engine.cjs');
const { EntityResolver } = require('../../entities/entity-resolver.cjs');
const { GoalPlanner } = require('../../kernel/goal-planner.cjs');
const { CapabilityResolver } = require('../../kernel/capability-resolver.cjs');
const { KernelEventBus } = require('../../events/bus.cjs');

const FIXED_NOW = '2026-07-15T12:15:00.000Z';
const EXECUTION_GRAPH = ['DISCOVER', 'COMPARE', 'SELECT', 'AUTHENTICATE', 'PAY', 'EXECUTE', 'TRACK', 'VERIFY'];

const CASES = [
  {
    goal_id: 'compat_order',
    text: 'Order Chicken Biryani',
    intent: 'ORDER',
    expected: EXECUTION_GRAPH,
  },
  {
    goal_id: 'compat_book',
    text: 'Book Taj Hotel',
    intent: 'BOOK',
    expected: EXECUTION_GRAPH,
  },
  {
    goal_id: 'compat_pay',
    text: 'Pay Electricity Bill',
    intent: 'PAY',
    expected: ['AUTHENTICATE', 'PAY', 'EXECUTE', 'VERIFY'],
  },
  {
    goal_id: 'compat_renew',
    text: 'Renew Passport',
    intent: 'RENEW',
    expected: EXECUTION_GRAPH,
  },
  {
    goal_id: 'compat_transfer',
    text: 'Transfer INR 5000',
    intent: 'TRANSFER',
    expected: ['AUTHENTICATE', 'TRANSFER', 'EXECUTE', 'VERIFY'],
  },
  {
    goal_id: 'compat_reserve',
    text: 'Reserve Movie Tickets',
    intent: 'RESERVE',
    expected: EXECUTION_GRAPH,
  },
];

async function run() {
  const persistence = createMemoryPersistence();
  const bus = new KernelEventBus();
  const wildcardEvents = [];

  bus.subscribe('*', (event) => {
    wildcardEvents.push(event);
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
  });
  const goalPlanner = new GoalPlanner({
    persistence,
    bus,
    now: () => FIXED_NOW,
  });
  const capabilityResolver = new CapabilityResolver({
    persistence,
    bus,
    now: () => FIXED_NOW,
  });

  const graphs = new Map();

  for (const item of CASES) {
    const contextFrame = await contextEngine.collect({
      goal_id: item.goal_id,
      text: item.text,
      source: 'user',
    });
    const entityGraph = await entityResolver.resolve({ context_frame: contextFrame });
    const goalPlan = goalPlanner.plan({
      goal_id: item.goal_id,
      context_frame: contextFrame,
      entity_graph: entityGraph,
      intent_frame: {
        intent: item.intent,
        confidence: 0.95,
      },
    });
    const capabilityGraph = capabilityResolver.resolve({ goal_plan: goalPlan });

    assert.equal(contextFrame.abi, 'chatr.context_frame.v0_9_rc');
    assert.equal(entityGraph.abi, 'chatr.entity_graph.v0_9_rc');
    assert.equal(goalPlan.abi, 'chatr.goal_plan.v0_9_rc');
    assert.equal(capabilityGraph.abi, 'chatr.capability_graph.v0_9_rc');
    assert.equal(capabilityGraph.goal_plan_ref, goalPlan.plan_id);
    assert.equal(capabilityGraph.context_ref, contextFrame.context_id);
    assert.equal(capabilityGraph.entity_graph_ref, entityGraph.graph_id);
    assert.deepStrictEqual(capabilityGraph.nodes.map((node) => node.capability), item.expected);
    assert.ok(capabilityGraph.nodes.every((node) => !node.capability.includes('.')));
    assert.ok(capabilityGraph.nodes.every((node) => node.capability_request.abi === 'chatr.capability_request.v0_9_rc'));
    assert.ok(capabilityGraph.nodes.every((node) => node.capability_request.capability_contract_version === '1.0.0'));

    const eventTypes = wildcardEvents
      .filter((event) => event.envelope.goal_id === item.goal_id)
      .map((event) => event.eventType);

    for (const expectedType of [
      'context.collecting',
      'context.ready',
      'entity.resolving',
      'entity.resolved',
      'goal.planning',
      'goal.planned',
      'capability.resolving',
      'capability.resolved',
    ]) {
      assert.ok(eventTypes.includes(expectedType), `${item.goal_id} missing ${expectedType}`);
    }

    graphs.set(item.intent, capabilityGraph);
  }

  assert.deepStrictEqual(
    graphs.get('ORDER').nodes.map((node) => node.capability),
    graphs.get('BOOK').nodes.map((node) => node.capability),
    'different entities should resolve to the same capability graph shape'
  );
  assert.deepStrictEqual(
    graphs.get('ORDER').nodes.map((node) => node.capability),
    graphs.get('RESERVE').nodes.map((node) => node.capability),
    'reservation intent should share the same universal execution graph'
  );

  console.log('Kernel Compatibility Suite Context -> Entity -> Goal -> Capability passed.');
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
      kv.delete(collection);
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
