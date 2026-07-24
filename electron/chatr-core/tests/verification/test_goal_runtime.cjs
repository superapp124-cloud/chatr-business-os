'use strict';

process.env.NODE_ENV = 'test';
const assert = require('assert');
const { GoalRuntime, GoalStatus, STATE_COLLECTION, JOURNAL_COLLECTION } = require('../../kernel/goal-runtime.cjs');

function run() {
  const persistence = createMemoryPersistence();
  const published = [];
  const bus = {
    publish(eventName, payload) {
      published.push({ eventName, payload });
    },
  };

  persistence.flush(STATE_COLLECTION);
  persistence.flush(JOURNAL_COLLECTION);

  const firstRuntime = new GoalRuntime({ persistence, bus });
  const created = firstRuntime.createGoal({
    goal_id: 'goal_restart_proof',
    intent_ref: 'intent_1',
    entity_graph_ref: 'entity_graph_1',
    stopping_conditions: {
      verified_complete: true,
    },
  });

  assert.equal(created.abi, 'chatr.goal_runtime_state.v0_9_rc');
  assert.equal(created.status, GoalStatus.CREATED);

  firstRuntime.attachWorkflow(created.goal_id, 'workflow_1', {
    attempts: 1,
    reason: 'test_attach',
  });

  firstRuntime.suspendGoal(created.goal_id, {
    type: 'time',
    at: '2026-07-15T00:10:00Z',
  });

  const reloadedRuntime = new GoalRuntime({ persistence, bus });
  const reloaded = reloadedRuntime.getGoal(created.goal_id);

  assert.ok(reloaded, 'goal should reload from persistence');
  assert.equal(reloaded.goal_id, created.goal_id);
  assert.equal(reloaded.status, GoalStatus.SUSPENDED);
  assert.equal(reloaded.active_workflow_id, 'workflow_1');
  assert.equal(reloaded.attempts, 1);
  assert.equal(reloaded.suspended_until, '2026-07-15T00:10:00Z');
  assert.equal(reloaded.history.length, 3);

  const active = reloadedRuntime.recoverActiveGoals();
  assert.equal(active.length, 1);
  assert.equal(active[0].goal_id, created.goal_id);
  assert.ok(published.some((event) => event.eventName === 'goal.resumed'));

  reloadedRuntime.resumeGoal(created.goal_id);
  const resumed = reloadedRuntime.getGoal(created.goal_id);
  assert.equal(resumed.status, GoalStatus.RUNNING);
  assert.equal(resumed.suspended_until, null);

  console.log('Goal Runtime restart persistence test passed.');
}

function createMemoryPersistence() {
  const kv = new Map();
  const journal = new Map();

  return {
    store(collection, data) {
      kv.set(collection, JSON.parse(JSON.stringify(data)));
      return true;
    },
    retrieve(collection) {
      const value = kv.get(collection);
      return value ? JSON.parse(JSON.stringify(value)) : null;
    },
    append(collection, entry) {
      if (!journal.has(collection)) journal.set(collection, []);
      journal.get(collection).push(JSON.parse(JSON.stringify(entry)));
      return true;
    },
    flush(collection) {
      kv.delete(collection);
      journal.delete(collection);
      return true;
    },
  };
}

try {
  run();
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
