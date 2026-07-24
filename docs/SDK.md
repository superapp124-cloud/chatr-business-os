# CHATR Kernel SDK (`kernel-sdk`)

Welcome to the CHATR ecosystem.

As a capability developer (e.g. building Tasks, Meetings, Documents, Healthcare), you are responsible for defining domain logic. You are **not** responsible for rendering UI, managing global state, or routing raw events.

The Kernel SDK provides a stable facade that isolates your capability from the internal Kernel runtime (`bus.cjs`, `journal.cjs`). By enforcing this boundary, we guarantee that the platform can scale vertically without fragmenting architecture.

## 1. Initializing a Capability
Every module begins by registering itself to receive a scoped API context.

```javascript
const sdk = require('../../kernel-sdk/index.cjs');

// Returns a scoped capability interface
const capability = sdk.capability('Tasks');
```

## 2. Capability Life Cycle Methods

### `capability.observe(handler)`
Hook into the `OBSERVATION` pipeline to extract domain-specific entities (Who, When, Where).
```javascript
capability.observe((understanding, context) => {
  if (understanding.type === 'TASK') {
     // Augment entities
     capability.publishEntities(understanding.id, { ... });
  }
});
```

### `capability.publishEntities(id, entities)`
Pushes resolved entities to the Kernel Entity Graph. This safely merges your extracted data into the broader system context without direct mutation.

### `capability.requestConfirmation(action)`
Publishes `ACTION.REVEALED` for the Kernel to present to the user via the Universal Action Surface.
```javascript
capability.requestConfirmation({
  type: 'CREATE_TASK',
  summary: 'Draft Genesis Proposal',
  dueDate: 'Friday'
});
```

### `capability.execute(handler)`
Triggered when the user clicks "Confirm" on the Action Surface. This is where you perform actual side-effects (e.g., API calls, database writes).
```javascript
capability.execute((action, context) => {
  // Call Task API...
  const success = true;

  if (success) {
    capability.journal({
      event: 'Task Created',
      details: action
    });
  }
});
```

### `capability.journal(event)`
Safely appends an immutable record to the `Intent Journal` for Undo operations and asynchronous learning.

## Enforcement
Do NOT import any files from `electron/chatr-core/events` or `electron/chatr-core/context`. CI pipelines are configured to fail builds if a capability module bypasses the SDK.
