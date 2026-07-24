# ADR-007 — ExecutionContext ABI Freeze

**Status:** Accepted
**Date:** 2026-07-17
**ABI Version:** 1.0.0
**ABI File:** `src/platform/contracts/ExecutionContext.abi.ts`

## Context

The existing `ExecutionContext` in `src/platform/AutomationOS/Types.ts` is a flat map of
`nodeId → { output, status }`. It carries no run identity, correlation id, tenant scope,
secret references, trigger payload, or variable bindings. This makes it impossible to
write durable run records, trace executions, or enforce tenant isolation.

## Decision

We freeze a canonical `ExecutionContext` ABI that serves as the complete data envelope
for a workflow run. Key decisions:

- `runId` and `correlationId` are required — enabling durable run persistence and tracing.
- `tenantId` is present — enabling multi-tenant isolation at the execution layer.
- `secrets` is a map of resolved `ResolvedSecret` objects — injected by the runtime before
  executor call, never logged, never persisted.
- `nodeOutputs` replaces the old flat context map with typed `NodeOutput` entries.
- Secrets are referenced by name in node config, resolved once before executor call.

## Consequences

- `RuntimeAdapter.execute()` must be updated to accept and populate `ExecutionContext`.
- Node executors must receive `ExecutionContext` instead of bare `data` objects.
- The old `ExecutionContext` type in `Types.ts` is deprecated.
- Breaking changes require a new ADR and semver bump.
