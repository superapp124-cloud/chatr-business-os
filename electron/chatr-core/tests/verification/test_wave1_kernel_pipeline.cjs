'use strict';

process.env.NODE_ENV = 'test';
const assert = require('assert');
const { ContextEngine } = require('../../context/context-engine.cjs');
const { EntityResolver } = require('../../entities/entity-resolver.cjs');
const { GoalPlanner } = require('../../kernel/goal-planner.cjs');
const { KernelEventBus } = require('../../events/bus.cjs');

const FIXED_NOW = '2026-07-15T11:30:00.000Z';

const CASES = [
  {
    goal_id: 'goal_pipeline_order',
    text: 'Order Chicken Biryani',
    intent: 'ORDER',
    capabilities: ['search', 'compare', 'select', 'authenticate', 'pay', 'execute', 'track', 'verify'],
  },
  {
    goal_id: 'goal_pipeline_book',
    text: 'Book Taj Palace',
    intent: 'BOOK',
    capabilities: ['search', 'compare', 'select', 'authenticate', 'pay', 'execute', 'track', 'verify'],
  },
  {
    goal_id: 'goal_pipeline_pay',
    text: 'Pay Electricity Bill',
    intent: 'PAY',
    capabilities: ['authenticate', 'pay', 'execute', 'verify'],
  },
  {
    goal_id: 'goal_pipeline_renew',
    text: 'Renew Passport',
    intent: 'RENEW',
    capabilities: ['search', 'compare', 'select', 'authenticate', 'pay', 'execute', 'track', 'verify'],
  },
  {
    goal_id: 'goal_pipeline_transfer',
    text: 'Transfer INR 5000',
    intent: 'TRANSFER',
    capabilities: ['authenticate', 'pay', 'execute', 'verify'],
  },
  {
    goal_id: 'goal_pipeline_reserve',
    text: 'Reserve Movie Tickets',
    intent: 'RESERVE',
    capabilities: ['search', 'compare', 'select', 'authenticate', 'pay', 'execute', 'track', 'verify'],
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

  for (const item of CASES) {
    const contextFrame = await contextEngine.collect({
      goal_id: item.goal_id,
      text: item.text,
      source: 'user',
    });
    const entityGraph = await entityResolver.resolve({ context_frame: contextFrame });
    const plan = goalPlanner.plan({
      goal_id: item.goal_id,
      context_frame: contextFrame,
      entity_graph: entityGraph,
      intent_frame: {
        intent: item.intent,
        confidence: 0.95,
      },
    });

    assert.equal(contextFrame.abi, 'chatr.context_frame.v0_9_rc');
    assert.equal(entityGraph.abi, 'chatr.entity_graph.v0_9_rc');
    assert.equal(plan.abi, 'chatr.goal_plan.v0_9_rc');
    assert.equal(plan.context_ref, contextFrame.context_id);
    assert.equal(plan.context_hash, contextFrame.context_hash);
    assert.equal(plan.entity_graph_ref, entityGraph.graph_id);
    assert.deepStrictEqual(plan.stages.map((stage) => stage.capability), item.capabilities);
    assert.ok(plan.stages.every((stage) => !stage.capability.includes('.')));

    const eventTypes = wildcardEvents
      .filter((event) => event.envelope.goal_id === item.goal_id)
      .map((event) => event.eventType);

    for (const expectedType of [
      'context.collecting',
      'context.source.loaded',
      'context.ready',
      'entity.resolving',
      'entity.resolved',
      'goal.planning',
      'goal.planned',
    ]) {
      assert.ok(eventTypes.includes(expectedType), `${item.goal_id} missing ${expectedType}`);
    }
  }

  console.log('Wave 1 same-kernel pipeline test passed.');
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
