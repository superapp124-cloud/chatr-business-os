# CHATR Platform — Runtime Invariants

**Status:** Frozen as of Phase 0 completion (2026-07-17)
**Authority:** Architecture Review Board
**Location:** `docs/RUNTIME_INVARIANTS.md`

Every engineer touching platform, execution, or workflow code must read this document before making changes.
These are architectural rules, not implementation details.
They apply to every phase from A through F.

---

## The Invariants

### I-01 — One Run ID per Execution

Every workflow execution has exactly one `runId`.
The `runId` is generated before the first node executes.
It is present in every `ExecutionContext`, every `ExecutionEvent`, every `AuditEvent`, and every `workflow_runs` row for that execution.
No execution may begin without a `runId`.

### I-02 — One ExecutionContext per Run

Every node execution within a run receives the same `ExecutionContext` instance.
The context is never forked, cloned, or re-created mid-run.
Node outputs are written to `context.nodeOutputs` by the runtime — never by the node executor directly.

### I-03 — One Authoritative Runtime

Every execution — manual test run, scheduled run, AI-generated run, approval resume, webhook-triggered run, and autonomous Intent Runtime run — executes through the same `ExecutionEngine`.
No other code path may call node executors directly.

### I-04 — One Canonical Graph

Every execution compiles from one `WorkflowGraph` object conforming to `WorkflowGraph.abi.ts`.
The graph is never synthesised, approximated, or regenerated from node order at execution time.
Edges are always persisted and always loaded from storage.
Sequential edge synthesis is prohibited.

### I-05 — One Event Stream

Every execution publishes events conforming to `ExecutionEvent.abi.ts`.
All consumers — Studio UI, `ExecutionTracer`, `ObservabilityPlatform` — subscribe to the same event stream.
Ad-hoc `console.log` or EventBus event shapes that do not conform to the ABI are not permitted in the execution path.

### I-06 — Secrets Are Always Referenced, Never Embedded

Node configurations never contain plaintext credentials, API keys, tokens, or passwords.
Nodes reference secrets by name only (a `secretRef` field pointing to a `secrets_vault` entry).
The `ExecutionRuntime` resolves secret references before calling the node executor.
Resolved secret values are placed in `ExecutionContext.secrets` and are never written to logs, audit entries, or persistent storage.

### I-07 — Every Provider Call Emits an Audit Event

Every call to an external provider — email, webhook, database, payment, AI — emits an `AuditEvent` conforming to `AuditEvent.abi.ts`.
The audit event is written to `audit_logs` before the provider response is processed.
Audit writes use `IAuditStore.append()`, which must never throw and must never include secret values.

### I-08 — Every State Transition Is Observable

Every change to `RunStatus` (queued → running → waiting_approval → completed/failed/cancelled/timed_out) emits a corresponding `ExecutionEvent` and writes an `AuditEvent`.
No status transition occurs silently.
`canTransition()` from `RunStatus.abi.ts` must be called before every status change.

### I-09 — Every Execution Is Replayable

The `execution_trace` stored in `workflow_runs` contains enough information for `RunReplay` to re-hydrate the execution state at any checkpoint.
Replay must not re-execute side effects.
Replay must be deterministic: given the same `execution_trace`, it always produces the same re-hydrated state.

### I-10 — Every Workflow Graph Is Deterministic After Validation

A `WorkflowGraph` that passes `GraphValidator.validate()` must produce the same `ExecutionPlan` every time it is compiled by `ExecutionPlanner`.
Compilation is a pure function of the graph — it does not depend on runtime state, random values, or wall-clock time.

### I-11 — Policy Is Evaluated Before Every Node Execution

`IPolicyEngine.evaluate()` is called before every node executor runs.
If any policy evaluation returns `outcome: 'deny'`, the node must not execute.
If any policy returns `outcome: 'require_approval'`, the run transitions to `waiting_approval` before proceeding.
Policy evaluation results are always emitted as `AuditEvent` entries.

### I-12 — No Cross-Plane Imports

Code in a higher plane may not import from a lower plane that it does not directly depend on.
Code in a lower plane may not import from a higher plane at all.
The nine platform planes are defined in the Engineering Execution Roadmap.
Violations are build errors enforced by import boundary lint rules.

### I-13 — ABIs Are Never Changed Without an ADR

No file in `src/platform/contracts/` may be modified without:
1. Creating a new ADR entry in `docs/ADR/`.
2. Bumping the semver in the ABI file header comment.
3. Providing a migration strategy for existing consumers if the change is breaking.

This invariant applies to all phases from A through F.

---

## Invariant Violation Policy

A pull request that violates any invariant must not be merged.
The reviewer is responsible for checking invariant compliance.
If an invariant needs to change, a new ADR is required first.
