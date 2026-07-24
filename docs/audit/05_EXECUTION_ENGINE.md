# 05 Execution Engine

## Summary

CHATR currently has multiple execution engines. The `/desktop/studio` route uses the frontend AutomationOS path, while Electron has a separate execution graph and runtime. Supabase has a separate Edge Function workflow engine. These engines are not yet unified.

For the Studio route, execution is local, sequential, in-memory, and event-driven through a frontend EventBus. It is not a durable distributed workflow engine.

## Execution Starts

Studio test execution starts in `src/pages/desktop/WorkflowStudio.tsx:1047` through `handleTestRun()`.

Path:

1. The user clicks `Test Run`.
2. Studio builds a workflow payload from local nodes.
3. Studio dispatches `RUN_WORKFLOW` to `CommandBus`.
4. `CommandBus` compiles `KernelStore.getState()`.
5. `RuntimeAdapter.execute()` runs compiled tasks.

Important mismatch: `CommandBus` ignores the graph payload sent by the click handler and compiles `KernelStore.getState()`. If the selected project was changed without dispatching `LOAD_WORKFLOW`, execution can target stale kernel state.

## Runtime

`src/platform/AutomationOS/RuntimeAdapter.ts` implements `LocalBrowserRuntime`.

Implemented executors:

- `core.trigger`
- `core.ai_agent`
- `core.email`
- `core.webhook`
- `core.condition`
- `core.notification`
- `core.database`

The runtime stores execution context in an in-memory object:

```text
private context: ExecutionContext = {};
```

It publishes frontend events:

- `EXECUTION_STARTED`
- `NODE_STARTED`
- `NODE_COMPLETED`
- `NODE_FAILED`
- `EXECUTION_COMPLETED`

## Compiler

`src/platform/AutomationOS/Compiler.ts` compiles `OSNode[]` and `OSEdge[]` into an `ExecutionGraph`.

Known behavior:

- Builds adjacency and in-degree maps.
- Uses Kahn topological sort.
- Throws on cycles.
- Creates one `ExecutionTask` per node.
- Assigns run order based on sorted sequence.

Limitations:

- No branch expression model.
- No loop semantics.
- No subflow semantics.
- No join/merge semantics.
- No typed data contracts.
- No per-node retry policy compile enforcement.
- No condition route compile enforcement.

## Sequential Execution

The Studio runtime effectively executes sequentially.

`RuntimeAdapter.execute()` groups tasks by `runOrder`, but the compiler assigns increasing run orders for each sorted node. That creates a sequential task list in practice.

## Parallel Execution

The frontend AutomationOS runtime does not provide real parallel execution for Studio workflows. The Electron execution runtime has an `executeParallel()` helper for connectors, but that is separate from the Studio route and not part of the React Flow graph execution path.

## Queue

`execution_queue` schema exists in `supabase/migrations/20260709000006_phase3_execution_queue.sql`.

Studio does not enqueue workflow runs into `execution_queue`.

The Studio bottom Queue tab uses static display content, not queue records.

## Scheduler

There is no Scheduler integration for Studio workflow execution. Schedule node type exists in the union/config, but no durable timer path was found for Studio.

## Retries

`compileWorkflow()` attaches `retry: 3` to compiled nodes, but the runtime does not implement retry behavior based on that value.

No exponential backoff, retry queue, retry history, retry budget, idempotency guard, or dead-letter queue was found in the Studio execution path.

## Failure Handling

`RuntimeAdapter.runTask()` catches errors, publishes `NODE_FAILED`, and throws. `execute()` does not recover and does not persist failure state.

`SelfHealingService` listens for `NODE_FAILED` and can recommend or attempt healing, but it is not a durable failure recovery system. Its rerun dispatch also suffers from the same `CommandBus` graph-state issue.

## Timeouts

The webhook executor uses `AbortSignal.timeout(15000)`.

`compileWorkflow()` emits `timeout: 30000`, but the runtime does not enforce this uniformly across all node types.

## Transactions

No transaction model was found for Studio workflow execution. Database actions, notification inserts, and webhook calls are independent side effects.

## Compensation and Rollback

No compensation or rollback is implemented in the Studio frontend runtime.

Electron core has broader execution metadata and ledger concepts, but no Studio graph-level compensation engine was found.

## Checkpointing

Workflow checkpoint tables exist in `supabase/migrations/20260710000001_stage1_production_validation.sql`, but Studio does not write checkpoints during test execution.

## Resume

No durable resume is implemented for Studio runs.

ApprovalEngine can mark workflow runs as waiting/running/cancelled in Supabase, but Studio runtime does not create the run rows required for that lifecycle.

## Persistence

Current Studio execution persistence:

- Local EventBus events: in memory.
- Local execution cards: React state.
- Supabase `workflow_runs`: not written by Studio runtime.
- `execution_queue`: not used by Studio runtime.
- `audit_logs`: not written by Studio runtime.

## Scaling

The Studio execution path runs in the browser. It is not horizontally scalable and should not be used for enterprise background workflow processing.

Scaling blockers:

- No workers.
- No queue consumers.
- No durable run state.
- No lease/heartbeat.
- No idempotency keys.
- No backpressure.
- No rate limiting at node execution level.
- No central execution API.

## Supabase Edge Function Engine

`supabase/functions/business-workflow-engine/index.ts` is a separate partial workflow engine:

- Reads `business_workflows` by id.
- Requires workflow status `active`.
- Locates a `trigger` node.
- Simulates traversal for at most 10 steps.
- Handles `ai_decision` and `action` specially.
- Updates `run_count`.
- Returns an `executionLog`.

Limitations:

- Not called by Studio route.
- Does not write `workflow_runs`.
- Does not write audit logs.
- Does not use workflow versions.
- Does not use queue/checkpoints/approvals.
- Simulates action execution.

## Electron Execution Engine

Electron has a separate runtime:

- `electron/main.cjs` builds plans with `workflowEngine` and executes through `executionGraph`.
- `electron/chatr-core/execution/workflow-engine.cjs` builds a DAG from outcome templates or hard-coded intents.
- `electron/chatr-core/kernel/execution-graph.cjs` executes sequentially and supports in-memory approvals.
- `electron/chatr-core/execution/execution-runtime.cjs` chooses browser/API/local/simulation executors.
- `electron/chatr-core/execution/execution-ledger.cjs` records execution metadata in local SQLite.

This is more durable locally than the browser Studio runtime, but it is not the source of truth for `/desktop/studio` workflows.

## Execution Engine Maturity

Execution maturity score: 28/100.

Reason:

- Local test runs exist.
- A compiler exists.
- Runtime events exist.
- Multiple backend execution pieces exist.
- Durable, scalable, versioned, queue-backed, observable enterprise execution is not yet integrated.
