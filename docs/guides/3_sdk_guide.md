# SDK Guide

## Building with the Workflow SDK
The `WorkflowSDK` is the ONLY approved interface for building capabilities. 
It provides factory methods that ensure security boundaries and type-safety.

```typescript
// 1. Create Stages
const stage = WorkflowSDK.createStage(
  'stage_id',
  'Description',
  ['depends_on_id'], // Dependencies
  async (ctx) => {
     // Execution Logic
     WorkflowSDK.log(ctx, 'Executing logic');
  }
);

// 2. Wrap in Capability
const capability = WorkflowSDK.createCapability(
  'Name',
  [stage],
  initialStateFactory
);
```

## Anti-Patterns
- **DO NOT** instantiate `PipelineEngine` or `TaskRuntime` manually.
- **DO NOT** mutate `ctx.state` outside of a Stage execution block.
- **DO NOT** attempt to write directly to the `EventRuntime.dlq`.
