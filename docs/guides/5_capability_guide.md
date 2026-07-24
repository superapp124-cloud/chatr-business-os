# Capability Guide

## What is a Capability?
A Capability is an enterprise business flow (e.g., Procurement, HR Onboarding) mapped to an executable Workflow DAG.

## Anatomy of a Capability
Capabilities must define:
1. **Initial State:** The blank `ctx.state` and empty `ctx.artifacts` payload.
2. **Stages:** Array of `WorkflowSDK.createStage`.
3. **Execution Edge:** Outputting a `PipelineEngine.submit()` call when initiated by the user.

See `ProcurementCapability.ts` for the reference standard of building a capability using pure abstractions without modifying the core system.
