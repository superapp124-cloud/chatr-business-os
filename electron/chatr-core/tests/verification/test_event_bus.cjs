'use strict';

const assert = require('assert');
const { KernelEventBus } = require('../../events/bus.cjs');
const { GOAL, CORE } = require('../../events/events.cjs');

function run() {
  const bus = new KernelEventBus();
  let goalEnvelope = null;
  let legacyEnvelope = null;
  let wildcardEvent = null;

  bus.subscribe(GOAL.CREATED, (envelope) => {
    goalEnvelope = envelope;
  });
  bus.subscribe('kernel.ready', (envelope) => {
    legacyEnvelope = envelope;
  });
  bus.subscribe('*', (event) => {
    wildcardEvent = event;
  });

  bus.publish(GOAL.CREATED, {
    goal_id: 'goal_1',
    workflow_id: 'workflow_1',
    source: 'goal-runtime',
    correlation_id: 'corr_1',
    causation_id: 'cause_1',
    metadata: {
      test: true,
    },
  });

  assert.ok(goalEnvelope, 'typed goal subscriber should receive envelope');
  assert.equal(goalEnvelope.abi, 'chatr.event.v0_9_rc');
  assert.equal(goalEnvelope.version, '1.0');
  assert.equal(goalEnvelope.event_type, 'goal.created');
  assert.equal(goalEnvelope.source_event_name, 'goal.created');
  assert.equal(goalEnvelope.goal_id, 'goal_1');
  assert.equal(goalEnvelope.workflow_id, 'workflow_1');
  assert.equal(goalEnvelope.source, 'goal-runtime');
  assert.equal(goalEnvelope.correlation_id, 'corr_1');
  assert.equal(goalEnvelope.causation_id, 'cause_1');
  assert.equal(goalEnvelope.metadata.test, true);
  assert.ok(goalEnvelope.event_id);
  assert.ok(goalEnvelope.timestamp);
  assert.ok(Number.isFinite(goalEnvelope.timestamp_ms));
  assert.equal(goalEnvelope.payload.goal_id, 'goal_1');
  assert.ok(Object.isFrozen(goalEnvelope), 'event envelope should be immutable');
  assert.ok(Object.isFrozen(goalEnvelope.payload), 'event payload should be immutable');

  bus.publish(CORE.KERNEL_READY, { source: 'kernel', version: 'test' });
  assert.ok(legacyEnvelope, 'canonical subscriber should receive legacy CORE event');
  assert.equal(legacyEnvelope.event_type, 'kernel.ready');
  assert.equal(legacyEnvelope.source_event_name, CORE.KERNEL_READY);

  assert.ok(wildcardEvent);
  assert.ok(wildcardEvent.eventName);
  assert.ok(wildcardEvent.eventType);
  assert.ok(wildcardEvent.envelope);

  assert.throws(
    // architecture-lint-disable-next-line domain-event-name domain-capability-id
    () => bus.publish('food.ordered', { goal_id: 'bad_goal' }),
    /Industry event namespace is forbidden/
  );

  console.log('Event Bus typed envelope validation test passed.');
}

try {
  run();
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
