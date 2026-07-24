# ADR-006 — WorkflowGraph ABI Freeze

**Status:** Accepted
**Date:** 2026-07-17
**ABI Version:** 1.0.0
**ABI File:** `src/platform/contracts/WorkflowGraph.abi.ts`

## Context

The CHATR Workflow Studio audit (docs/audit/20_FINAL_AUDIT.md) identified that the workflow
graph is fragmented across local React state, React Flow generated nodes, KernelStore, and
Supabase — with no single canonical type. Edges are ignored on save and synthesised
sequentially on load, making real branching workflows impossible.

The existing `WorkflowGraph` interface in `src/platform/AutomationOS/Types.ts` contains
only `nodes` and `edges` — insufficient for layout, permissions, variables, metadata,
or execution hints.

## Decision

We freeze a canonical `WorkflowGraph` ABI as the authoritative graph type for all consumers:
Studio, AI Builder, Runtime, Publish, Templates, and Industry Packs.

Key decisions:

- `edges` is a first-class required field — never synthesised, always persisted.
- `layout` is a separate map of `nodeId → {x, y}` — never regenerated from node order.
- `schemaVersion` enables forward migration via `GraphMigration`.
- `executionHints` are stored with the graph, not hardcoded in the compiler.
- The type is in `platform/contracts/` with zero runtime imports.

## Consequences

- All consumers must migrate to this type. The existing `WorkflowGraph` in `Types.ts`
  is deprecated and will be removed in Phase B.
- `handleSave` must save edges and layout.
- `LOAD_WORKFLOW` must accept a full `WorkflowGraph`.
- Breaking changes to this ABI require a new ADR and a semver bump.
