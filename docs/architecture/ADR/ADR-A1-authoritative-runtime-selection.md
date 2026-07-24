# ADR-A1 — Authoritative Browser Runtime Selection

**Status:** Accepted
**Date:** 2026-07-17
**Phase:** A — Single Runtime
**Location:** `docs/ADR/ADR-A1-authoritative-runtime-selection.md`

## Context

The audit identified six competing execution paths in the CHATR codebase:

1. `WorkflowStudio.tsx` local behavior
2. `AutomationOS/RuntimeAdapter.ts` (`LocalBrowserRuntime`)
3. `supabase/functions/business-workflow-engine/index.ts`
4. `electron/chatr-core/execution/workflow-engine.cjs`
5. `electron/chatr-core/kernel/execution-graph.cjs`
6. `WorkflowBuilder.tsx` alternate builder path

Runtime Invariant I-03 states: every execution must go through one authoritative runtime.
This ADR documents the selection of that authoritative runtime for the Studio (browser) path.

## Candidate Evaluation

### Evaluation Criteria

| Criterion | Why it matters |
|---|---|
| Frozen ABI compatibility | Must accept `WorkflowGraph` ABI and emit `ExecutionEvent` ABI |
| Event model | Must publish typed events that Studio and ObservabilityPlatform consume |
| Observability | Must support `ExecutionTracer` hooks for Phase C.5 |
| Testability | Must be unit-testable in isolation |
| Portability | Must be swappable in Phase A.5 without Studio changes |
| Current integration | How much refactoring is needed to wire it as the single path |

### Candidate 1 — `AutomationOS/RuntimeAdapter.ts` (`LocalBrowserRuntime`)

| Criterion | Assessment |
|---|---|
| ABI compatibility | ✅ Already accepts `ExecutionGraph` (a subset of `WorkflowGraph`). Needs upgrade to full ABI. |
| Event model | ✅ Already publishes EventBus events. Needs upgrade to typed `ExecutionEvent` ABI. |
| Observability | ✅ `execute()` and `executeTask()` are the natural hook points for `ExecutionTracer`. |
| Testability | ✅ Plain TypeScript class — fully unit-testable. |
| Portability | ✅ The `RuntimeAdapter.execute()` signature maps cleanly to `ExecutionEngine.execute()`. In Phase A.5 it becomes a thin shim. |
| Current integration | ✅ Studio already dispatches `RUN_WORKFLOW` to `CommandBus` which calls `RuntimeAdapter`. The integration path exists — the bug is that `CommandBus` ignores the dispatched payload. |
| **Overall** | **Strong candidate. Minimal surgery needed.** |

### Candidate 2 — `supabase/functions/business-workflow-engine/index.ts`

| Criterion | Assessment |
|---|---|
| ABI compatibility | ❌ Operates on Supabase row data, not on `WorkflowGraph` ABI objects. Significant rework needed. |
| Event model | ❌ No typed event publishing. Returns HTTP responses. |
| Observability | ❌ No node-level event hooks. |
| Testability | ⚠️ Requires Supabase Edge Function environment to test. |
| Portability | ❌ Tied to Deno runtime. Cannot be used in browser or Electron without a network hop. |
| Current integration | ❌ Studio has no direct integration path. Would require an HTTP call per test run. |
| **Overall** | **Not suitable as the browser runtime. Retained as a future background/scheduled trigger endpoint.** |

### Candidate 3 — `electron/chatr-core/execution/workflow-engine.cjs`

| Criterion | Assessment |
|---|---|
| ABI compatibility | ❌ CommonJS module. Cannot be imported in the browser/Vite bundle. |
| Event model | ❌ Uses Electron IPC events. Not compatible with Studio EventBus. |
| Observability | ⚠️ Has its own execution ledger — valuable for Electron path, not for browser path. |
| Testability | ⚠️ Requires Electron environment. |
| Portability | ❌ Electron-only. Cannot swap into Phase A.5 browser stack. |
| Current integration | ❌ Not reachable from Studio without IPC bridge. |
| **Overall** | **Not suitable as the browser runtime. Retained as the authoritative Electron/desktop execution path.** |

### Candidate 4 — `electron/chatr-core/kernel/execution-graph.cjs`

| Criterion | Assessment |
|---|---|
| ABI compatibility | ❌ CommonJS. Electron-only. |
| **Overall** | **Same conclusion as Candidate 3.** |

### Candidate 5 — `WorkflowBuilder.tsx` alternate builder path

| Criterion | Assessment |
|---|---|
| ABI compatibility | ❌ UI component, not an execution runtime. |
| **Overall** | **Not a runtime candidate.** |

## Decision

**`AutomationOS/RuntimeAdapter.ts` (`LocalBrowserRuntime`) is designated the authoritative browser/Studio execution runtime.**

Rationale:
- It is the only candidate that already has an integration path from Studio through `CommandBus`.
- It publishes events via `EventBus`, which is already wired to the Studio UI state updates.
- It is a plain TypeScript class with no environment dependencies — fully testable and swappable.
- Its `execute()` / `executeTask()` structure maps directly to the `ExecutionEngine` / `ExecutionRuntime` abstraction layer defined in Phase A.5.
- The only bugs are in the caller (`CommandBus` reading `KernelStore` instead of the dispatched payload) — the runtime itself receives a compiled graph correctly.

## Consequences

1. `CommandBus.RUN_WORKFLOW` must use the graph from `command.payload`, not `KernelStore.getState()`. **(Phase A, task A2)**
2. `CommandBus.COMPILE_WORKFLOW` must compile the graph from `command.payload` if provided, falling back to `KernelStore` for display-only compilation. **(Phase A, task A2)**
3. `supabase/functions/business-workflow-engine` is marked non-authoritative for Studio execution. **(Phase A, task A3)**
4. Electron runtime candidates are retained as-is for the Electron path — they are not touched. **(Phase A, no change)**
5. In Phase A.5, `LocalBrowserRuntime` becomes the implementation of `ExecutionRuntime`. `RuntimeAdapter` becomes a thin adapter shim.
6. The Electron `workflow-engine.cjs` becomes the implementation of `ExecutionRuntime` for the Electron path — same interface, different environment.

## Success Metric (Phase A)

> 100% of Studio test run executions use `LocalBrowserRuntime.execute()` as the single entry point.
> Zero `KernelStore.getState()` calls remain in any execution path.
