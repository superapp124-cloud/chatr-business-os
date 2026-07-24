'use strict';

process.env.NODE_ENV = 'test';
const assert = require('assert');
const { ContextEngine, FRAME_COLLECTION } = require('../../context/context-engine.cjs');
const { KernelEventBus } = require('../../events/bus.cjs');
const { CONTEXT } = require('../../events/events.cjs');

const FIXED_NOW = '2026-07-15T10:00:00.000Z';

async function run() {
  const persistence = createMemoryPersistence();
  const bus = new KernelEventBus();
  const sourceEvents = [];
  const readyEvents = [];

  bus.subscribe(CONTEXT.SOURCE_LOADED, (envelope) => {
    sourceEvents.push(envelope);
  });
  bus.subscribe(CONTEXT.READY, (envelope) => {
    readyEvents.push(envelope);
  });

  const engine = new ContextEngine({
    persistence,
    bus,
    now: () => FIXED_NOW,
    sources: createDeterministicSources(),
  });

  const input = {
    goal_id: 'goal_context_proof',
    text: 'Order Chicken Biryani',
    source: 'user',
    user_id: 'user_1',
    conversation_id: 'conversation_1',
  };

  const first = await engine.collect(input);
  const second = await engine.collect(input);

  assert.deepStrictEqual(second, first, 'same input and sources should produce an identical ContextFrame');
  assert.equal(first.abi, 'chatr.context_frame.v0_9_rc');
  assert.equal(first.frame_version, 1);
  assert.ok(first.context_hash);
  assert.equal(first.context_id, `context_${first.context_hash.slice(0, 32)}`);
  assert.equal(first.goal_id, 'goal_context_proof');
  assert.equal(first.collected_at, FIXED_NOW);
  assert.equal(first.gps.status, 'missing');
  assert.equal(first.gps.permission, 'denied');
  assert.equal(first.source_classification.gps, 'dynamic');
  assert.equal(first.source_classification.identity, 'static');
  assert.equal(first.source_classification.execution_memory, 'historical');
  assert.equal(first.source_classification.permissions, 'policy');
  assert.equal(first.quality.source_confidence.gps, 0);
  assert.ok(first.quality.confidence > 0);
  assert.ok(first.quality.missing_sources.includes('gps'));
  assert.deepStrictEqual(first.permissions.denied, ['gps']);
  assert.ok(first.provenance.sources.gps);
  assert.ok(Object.isFrozen(first), 'ContextFrame should be immutable');
  assert.ok(Object.isFrozen(first.request), 'nested ContextFrame objects should be immutable');
  assert.throws(() => {
    first.request.raw_text = 'changed';
  }, /Cannot assign|read only/);

  assert.equal(readyEvents.length, 2);
  assert.ok(sourceEvents.length >= 2);
  assert.equal(sourceEvents[sourceEvents.length - 1].event_type, 'context.source.loaded');
  const ready = readyEvents[readyEvents.length - 1];
  assert.equal(ready.event_type, 'context.ready');
  assert.equal(ready.goal_id, 'goal_context_proof');
  assert.equal(ready.payload.context_ref, first.context_id);
  assert.equal(ready.payload.context_hash, first.context_hash);
  assert.equal(ready.payload.frame.context_id, first.context_id);
  assert.ok(Object.isFrozen(ready.payload.frame), 'event payload frame should remain immutable');

  const reloadedEngine = new ContextEngine({
    persistence,
    bus,
    now: () => FIXED_NOW,
    sources: createDeterministicSources(),
  });
  const reloaded = reloadedEngine.getFrame(first.context_id);
  assert.deepStrictEqual(reloaded, first, 'ContextFrame should reload from persistence');
  assert.ok(Object.isFrozen(reloaded), 'reloaded ContextFrame should be immutable');

  console.log('Context Engine immutable ContextFrame test passed.');
}

function createDeterministicSources() {
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
      permission: 'denied',
      latitude: null,
      longitude: null,
      accuracy_meters: null,
      source: 'permission_denied',
    }),
    network: () => ({
      status: 'available',
      online: true,
      active_interfaces: [{ name: 'test0', family: 'IPv4', mac: '00:00:00:00:00:01' }],
    }),
    device: () => ({
      status: 'available',
      platform: 'test',
      release: '1',
      arch: 'x64',
      hostname: 'test-host',
      cpu_count: 1,
      memory_total_bytes: 1,
      memory_free_bytes: 1,
    }),
    identity: () => ({
      status: 'authenticated',
      user_id: 'user_1',
      account_id: 'account_1',
      auth_state: 'known',
    }),
    permissions: () => ({
      status: 'partial',
      granted: ['notifications'],
      denied: ['gps'],
      required: ['gps'],
      scopes: {},
    }),
    wallet: () => ({
      status: 'available',
      default_payment_ref: 'payment_ref_1',
      payment_method_refs: ['payment_ref_1'],
      currency: 'INR',
    }),
    preferences: () => ({
      status: 'available',
      values: {
        language: 'en',
      },
      source: 'test',
    }),
    history: () => ({
      status: 'available',
      recent_goal_refs: ['goal_previous'],
      recent_provider_refs: ['provider_previous'],
    }),
    execution_memory: () => ({
      status: 'available',
      preferred_provider_refs: ['provider_previous'],
      preferred_payment_ref: 'payment_ref_1',
      previous_workflow_ref: 'workflow_previous',
    }),
    world_state_refs: () => ['world_state_ref_1'],
    policy_refs: () => ['policy_ref_1'],
    active_environment: () => ({
      status: 'available',
      runtime: 'test',
      node_version: 'test',
      pid: 1,
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
      kv.delete(collection || FRAME_COLLECTION);
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
