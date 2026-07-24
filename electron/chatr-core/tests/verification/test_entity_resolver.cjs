'use strict';

process.env.NODE_ENV = 'test';
const assert = require('assert');
const { ContextEngine } = require('../../context/context-engine.cjs');
const { EntityResolver, GRAPH_COLLECTION } = require('../../entities/entity-resolver.cjs');
const { KernelEventBus } = require('../../events/bus.cjs');
const { ENTITY } = require('../../events/events.cjs');

const FIXED_NOW = '2026-07-15T10:30:00.000Z';

async function run() {
  const persistence = createMemoryPersistence();
  const bus = new KernelEventBus();
  const resolvedEvents = [];

  bus.subscribe(ENTITY.RESOLVED, (envelope) => {
    resolvedEvents.push(envelope);
  });

  const contextEngine = new ContextEngine({
    persistence,
    bus,
    now: () => FIXED_NOW,
    sources: createContextSources(),
  });
  const contextFrame = await contextEngine.collect({
    goal_id: 'goal_entity_proof',
    text: 'Order Chicken Biryani',
    source: 'user',
  });

  const resolver = new EntityResolver({
    persistence,
    bus,
    now: () => FIXED_NOW,
    ontology: createOntologyFixture(),
  });

  const first = await resolver.resolve({ context_frame: contextFrame });
  const second = await resolver.resolve({ context_frame: contextFrame });

  assert.deepStrictEqual(second, first, 'same ContextFrame and ontology should produce identical EntityGraph');
  assert.equal(first.abi, 'chatr.entity_graph.v0_9_rc');
  assert.equal(first.goal_id, 'goal_entity_proof');
  assert.equal(first.context_ref, contextFrame.context_id);
  assert.ok(first.entities.length >= 1);
  assert.ok(Object.isFrozen(first), 'EntityGraph should be immutable');
  assert.ok(Object.isFrozen(first.entities[0]), 'Entity nodes should be immutable');

  const primary = first.entities.find((entity) => entity.role === 'target');
  assert.ok(primary, 'primary target entity should be extracted');
  assert.equal(primary.normalized_text, 'chicken biryani');
  assert.equal(primary.canonical_name, 'Chicken Biryani');
  assert.equal(primary.ontology.type, 'PreparedItem');
  assert.deepStrictEqual(primary.ontology.lineage, ['Entity', 'CatalogItem', 'PreparedItem']);
  assert.equal(primary.ontology.source, 'test_ontology');
  assert.throws(() => {
    primary.role = 'changed';
  }, /Cannot assign|read only/);

  assert.equal(resolvedEvents.length, 2);
  const resolved = resolvedEvents[resolvedEvents.length - 1];
  assert.equal(resolved.event_type, 'entity.resolved');
  assert.equal(resolved.goal_id, 'goal_entity_proof');
  assert.equal(resolved.payload.entity_graph_ref, first.graph_id);
  assert.equal(resolved.payload.graph.graph_id, first.graph_id);

  const reloadedResolver = new EntityResolver({
    persistence,
    bus,
    now: () => FIXED_NOW,
    ontology: createOntologyFixture(),
  });
  const reloaded = reloadedResolver.getGraph(first.graph_id);
  assert.deepStrictEqual(reloaded, first, 'EntityGraph should reload from persistence');
  assert.ok(Object.isFrozen(reloaded), 'reloaded EntityGraph should be immutable');

  const amountGraph = await resolver.resolve({
    goal_id: 'goal_amount_proof',
    request: {
      request_id: 'request_amount_proof',
      raw_text: 'Transfer INR 5000',
      normalized_text: 'Transfer INR 5000',
    },
  });
  const amount = amountGraph.entities.find((entity) => entity.ontology.type === 'Amount');
  assert.ok(amount, 'amount entity should be shape-resolved without a domain route');
  assert.equal(amount.role, 'amount');

  console.log('Entity Resolver immutable EntityGraph test passed.');
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
