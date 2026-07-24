# ADR-013 — RunStatus ABI

**Status:** Accepted
**Date:** 2026-07-17
**ABI Version:** 1.0.0
**ABI File:** `src/platform/contracts/run-status.contract.ts`

## Context

Run lifecycle states were previously managed as free-form strings scattered across the execution engine, queue workers, and API handlers, with no enforced transition graph. This allowed invalid state sequences (e.g., a `completed` run transitioning to `running` on a retry), made it impossible to write exhaustive switch statements in TypeScript without casting, and caused monitoring dashboards to display inconsistent state labels. A canonical, machine-enforced state machine was needed.

## Decision

`RunStatus` is defined as a TypeScript string-literal union covering the full lifecycle: `queued → running → waiting_approval → completed | failed | cancelled | timed_out`. A `canTransition(from, to)` pure function encodes the allowed transition graph and is the single authority consulted before any status write; any attempted transition it rejects throws a `InvalidStatusTransitionError`. The `isTerminalStatus(status)` helper identifies states from which no further transitions are possible. A `TriggerType` enum enumerates all entry points: `manual`, `scheduled`, `webhook`, `event`, `api`, and `autonomous`.

## Consequences

- Invalid state sequences are impossible to persist silently; every state change passes through `canTransition()`, turning a class of subtle data corruption bugs into loud, traceable errors.
- Exhaustive switch statements over `RunStatus` are now type-safe; TypeScript will warn if a new status value is added to the union without updating all switch sites.
- `TriggerType` provides a structured dimension for run analytics, enabling segmentation of performance and failure metrics by how a run was initiated.
