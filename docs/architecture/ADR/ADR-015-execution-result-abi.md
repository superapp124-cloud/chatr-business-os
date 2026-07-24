# ADR-015 — ExecutionResult ABI

**Status:** Accepted
**Date:** 2026-07-17
**ABI Version:** 1.0.0
**ABI File:** `src/platform/contracts/execution-result.contract.ts`

## Context

After a workflow run completed, the platform stored only a top-level pass/fail status and a flat log array, discarding per-node timing, individual node outputs, AI cost data, and approval wait durations. This made post-run debugging laborious (engineers had to correlate separate log streams), made AI cost attribution impossible, and meant that SLA analysis required manual reconstruction from raw event logs. A structured, comprehensive result artifact was needed to replace the flat record.

## Decision

`ExecutionResult` is the final object produced at the end of every run and persisted in `workflow_runs.execution_trace`. It includes a `nodeSummaries` array where each entry records the node ID, status, start/end timestamps, input/output snapshots, and any error detail. It aggregates AI cost and token usage across all AI nodes into a top-level `aiCost` block (total tokens, prompt tokens, completion tokens, estimated USD cost). It captures `queueWaitMs` and `approvalWaitMs` durations as first-class fields, and includes a typed `logs` array of structured log entries rather than raw strings.

## Consequences

- Engineers can diagnose failures to the exact node level from a single `execution_trace` record without joining against separate log tables.
- AI cost data is available per-run and per-workflow for billing, quota enforcement, and budget alerting without requiring a separate aggregation pipeline.
- Structured `logs` array entries (with `level`, `nodeId`, `timestamp`, and `message` fields) can be directly indexed and queried, replacing grep-based log investigation with SQL queries.
