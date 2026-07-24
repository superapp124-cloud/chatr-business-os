'use strict';

process.env.NODE_ENV = 'test';
const assert = require('assert');
const { ContextEngine } = require('../../context/context-engine.cjs');
const { EntityResolver } = require('../../entities/entity-resolver.cjs');
const { GoalPlanner } = require('../../kernel/goal-planner.cjs');
const {
  CAPABILITY_CONTRACT_VERSION,
  CapabilityResolver,
  GRAPH_COLLECTION,
} = require('../../kernel/capability-resolver.cjs');
const { KernelEventBus } = require('../../events/bus.cjs');
const { CAPABILITY } = require('../../events/events.cjs');

const FIXED_NOW = '2026-07-15T12:00:00.000Z';

async function run() {
  const persistence = createMemoryPersistence();
  const bus = new KernelEventBus();
  const resolvedEvents = [];
  const failedEvents = [];

  bus.subscribe(CAPABILITY.RESOLVED, (envelope) => {
    resolvedEvents.push(envelope);
  });
  bus.subscribe(CAPABILITY.FAILED, (envelope) => {
    failedEvents.push(envelope);
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

  const contextFrame = await contextEngine.collect({
    goal_id: 'goal_capability_resolver_proof',
    text: 'Order Chicken Biryani',
    source: 'user',
  });
  const entityGraph = await entityResolver.resolve({ context_frame: contextFrame });
  const goalPlan = goalPlanner.plan({
    goal_id: 'goal_capability_resolver_proof',
    context_frame: contextFrame,
    entity_graph: entityGraph,
    intent_frame: {
      intent_id: 'intent_capability_resolver_proof',
      intent: 'ORDER',
      confidence: 0.97,
    },
  });
  const graph = capabilityResolver.resolve({ goal_plan: goalPlan });

  assert.equal(graph.abi, 'chatr.capability_graph.v0_9_rc');
  assert.equal(graph.graph_version, 1);
  assert.equal(graph.graph_id, `capability_graph_${graph.graph_hash.slice(0, 32)}`);
  assert.equal(graph.goal_id, goalPlan.goal_id);
  assert.equal(graph.goal_plan_ref, goalPlan.plan_id);
  assert.equal(graph.goal_plan_hash, goalPlan.plan_hash);
  assert.equal(graph.context_ref, contextFrame.context_id);
  assert.equal(graph.context_hash, contextFrame.context_hash);
  assert.equal(graph.entity_graph_ref, entityGraph.graph_id);
  assert.equal(graph.capability_contract_version, CAPABILITY_CONTRACT_VERSION);
  assert.deepStrictEqual(graph.nodes.map((node) => node.capability), [
    'DISCOVER',
    'COMPARE',
    'SELECT',
    'AUTHENTICATE',
    'PAY',
    'EXECUTE',
    'TRACK',
    'VERIFY',
  ]);
  assert.equal(graph.edges.length, graph.nodes.length - 1);
  assert.deepStrictEqual(graph.nodes[0].depends_on, []);
  assert.deepStrictEqual(graph.nodes[1].depends_on, [graph.nodes[0].node_id]);
  assert.ok(graph.nodes.every((node) => !node.capability.includes('.')));
  assert.ok(graph.nodes.every((node) => node.capability_request.abi === 'chatr.capability_request.v0_9_rc'));
  assert.ok(graph.nodes.every((node) => node.capability_request.capability === node.capability));
  assert.ok(graph.nodes.every((node) => node.capability_request.capability_contract_version === '1.0.0'));

  const payNode = graph.nodes.find((node) => node.capability === 'PAY');
  assert.equal(payNode.risk, 'high');
  assert.equal(payNode.approval, 'explicit_authorization');
  assert.equal(payNode.capability_request.verification_rules.required, true);

  assert.ok(Object.isFrozen(graph), 'CapabilityGraph should be immutable');
  assert.ok(Object.isFrozen(graph.nodes[0]), 'CapabilityGraph nodes should be immutable');
  assert.throws(() => {
    graph.nodes[0].capability = 'PAY';
  }, /Cannot assign|read only/);

  assert.equal(resolvedEvents.length, 1);
  assert.equal(resolvedEvents[0].event_type, 'capability.resolved');
  assert.equal(resolvedEvents[0].payload.capability_graph_ref, graph.graph_id);
  assert.equal(resolvedEvents[0].payload.goal_plan_ref, goalPlan.plan_id);

  const reloadedResolver = new CapabilityResolver({
    persistence,
    bus,
    now: () => FIXED_NOW,
  });
  const reloaded = reloadedResolver.getGraph(graph.graph_id);
  assert.deepStrictEqual(reloaded, graph, 'CapabilityGraph should reload from persistence');
  assert.ok(Object.isFrozen(reloaded), 'reloaded CapabilityGraph should be immutable');

  const badPlan = JSON.parse(JSON.stringify(goalPlan));
  badPlan.plan_id = 'goal_plan_bad_capability';
  badPlan.stages[0].capability = 'food' + '.search';
  assert.throws(
    () => capabilityResolver.resolve({ goal_plan: badPlan }),
    /Capability must be universal/
  );
  assert.equal(failedEvents.length, 1);
  assert.equal(failedEvents[0].event_type, 'capability.failed');

  console.log('Capability Resolver graph ABI test passed.');
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
      kv.delete(collection || GRAPH_COLLECTION);
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
