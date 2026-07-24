# ADR-008 — ExecutionEvent ABI

**Status:** Accepted
**Date:** 2026-07-17
**ABI Version:** 1.0.0
**ABI File:** `src/platform/contracts/execution-event.contract.ts`

## Context

The execution runtime previously emitted events through an untyped `EventBus`, where payloads were plain objects with no enforced shape. This made it impossible to statically verify event consumers, caused runtime mismatches between publishers and subscribers, and meant that adding a new event type required grep-based searches across the codebase to find all affected listeners. A formal, versioned contract was needed so that all runtime events have a guaranteed, inspectable shape.

## Decision

All events emitted by the execution runtime are defined as a discriminated union of typed payloads under the `ExecutionEvent` type, keyed by a `type` string literal (e.g., `node.started`, `node.completed`, `approval.requested`, `checkpoint.saved`, `provider.error`). A typed `IExecutionEventPublisher` contract is the only permitted way to publish events; direct `EventBus.emit()` calls are banned in execution code. The union covers four lifecycle domains: node lifecycle events, approval gate events, checkpoint/resume events, and provider-level error or retry events.

## Consequences

- All event consumers can be statically typed against the discriminated union, eliminating an entire class of runtime payload errors caught only in production.
- Adding a new event type requires a contract change under version control, making event-schema evolution an explicit, reviewable decision.
- Any code that bypasses `IExecutionEventPublisher` and calls `EventBus` directly will fail the `no-untyped-event-emit` lint rule introduced alongside this ABI.
