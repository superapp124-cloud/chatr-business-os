const { CAPABILITY, CONTEXT, CORE, ENTITY, GOAL, INTELLIGENCE, INTENT, JOB } = require('../electron/chatr-core/events/events.cjs');
const {
  createEventEnvelope,
  validateEventEnvelope,
  validateEventType,
} = require('../electron/chatr-core/events/schema.cjs');

const eventGroups = {
  CAPABILITY,
  CONTEXT,
  CORE,
  ENTITY,
  GOAL,
  INTELLIGENCE,
  INTENT,
  JOB,
};

const failures = [];

for (const [groupName, group] of Object.entries(eventGroups)) {
  for (const [eventName, eventValue] of Object.entries(group)) {
    try {
      const envelope = createEventEnvelope(eventValue, {
        source: 'event-schema-validation',
        correlation_id: `${groupName.toLowerCase()}_${eventName.toLowerCase()}`,
      });
      validateEventEnvelope(envelope);
      validateEventType(envelope.event_type);
    } catch (error) {
      failures.push(`${groupName}.${eventName}: ${error.message}`);
    }
  }
}

for (const forbidden of ['food.ordered', 'travel.booked', 'shopping.completed']) {
  try {
    createEventEnvelope(forbidden, { source: 'event-schema-validation' });
    failures.push(`${forbidden}: expected forbidden event namespace rejection`);
  } catch {
    // Expected.
  }
}

if (failures.length > 0) {
  console.error('Event schema validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Event schema validation passed.');
