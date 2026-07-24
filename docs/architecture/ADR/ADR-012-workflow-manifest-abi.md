# ADR-012 — WorkflowManifest ABI

**Status:** Accepted
**Date:** 2026-07-17
**ABI Version:** 1.0.0
**ABI File:** `src/platform/contracts/workflow-manifest.contract.ts`

## Context

Workflow versions were previously stored as mutable database rows, meaning a published workflow's graph could be patched in place after it had already run. This made it impossible to reproduce a historical run from its version snapshot, undermined compliance audits that needed to prove exactly which graph was executing, and caused subtle bugs when a version was silently modified while runs were in flight. An immutable, content-addressed artifact was needed for published workflows.

## Decision

When a workflow is published, the engine produces a `WorkflowManifest` that captures a full graph snapshot (all nodes, edges, and configuration) alongside a SHA-256 `checksum` of that snapshot. The manifest has a `status` field (`active` | `yanked` | `deprecated`) that the engine checks before admitting a new run; manifests with a `yanked` status cannot start new runs but their data is preserved permanently. All version operations (publish, yank, list, fetch) are mediated through the `IVersionStore` contract; direct database writes to the versions table outside this contract are prohibited.

## Consequences

- Any historical run can be replayed deterministically because the manifest it ran against is immutable and permanently stored.
- Compliance audits can verify the exact graph that executed by recomputing the checksum against the stored snapshot.
- The `yanked` status provides a safe recall mechanism that stops new runs without destroying audit evidence, satisfying both operational and legal retention requirements.
