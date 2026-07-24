# CHATR ADR Registry

Architecture Decision Records for the CHATR platform.
All ADRs are append-only. Existing ADRs are never modified — only superseded.

## Existing ADRs

| ID | Title | Status |
|---|---|---|
| ADR-001 | Event Sourcing | Accepted |
| ADR-001b | Kernel ABI Freeze | Accepted |
| ADR-002 | Projection Store | Accepted |
| ADR-003 | Context Runtime | Accepted |
| ADR-004 | Universal Action Surface | Accepted |
| ADR-005 | Understanding Horizon | Accepted |

## Workflow Platform ABIs (Phase 0 — 2026-07-17)

| ID | Title | Status | ABI File |
|---|---|---|---|
| ADR-006 | WorkflowGraph ABI Freeze | Accepted | `src/platform/contracts/WorkflowGraph.abi.ts` |
| ADR-007 | ExecutionContext ABI Freeze | Accepted | `src/platform/contracts/ExecutionContext.abi.ts` |
| ADR-008 | ExecutionEvent ABI Freeze | Accepted | `src/platform/contracts/ExecutionEvent.abi.ts` |
| ADR-009 | NodeDefinition ABI Freeze | Accepted | `src/platform/contracts/NodeDefinition.abi.ts` |
| ADR-010 | Provider ABI Freeze | Accepted | `src/platform/contracts/Provider.abi.ts` |
| ADR-011 | Capability ABI Freeze | Accepted | `src/platform/contracts/Capability.abi.ts` |
| ADR-012 | WorkflowManifest ABI Freeze | Accepted | `src/platform/contracts/WorkflowManifest.abi.ts` |
| ADR-013 | RunStatus ABI Freeze | Accepted | `src/platform/contracts/RunStatus.abi.ts` |
| ADR-014 | AuditEvent ABI Freeze | Accepted | `src/platform/contracts/AuditEvent.abi.ts` |
| ADR-015 | ExecutionResult ABI Freeze | Accepted | `src/platform/contracts/ExecutionResult.abi.ts` |
| ADR-016 | PolicyContract ABI Freeze | Accepted | `src/platform/contracts/PolicyContract.abi.ts` |
| ADR-017 | WorkflowPackage ABI Freeze | Accepted | `src/platform/contracts/WorkflowPackage.abi.ts` |

## Phase A ADRs (Phase A — 2026-07-17)

| ID | Title | Status | Decision |
|---|---|---|---|
| ADR-A1 | Authoritative Browser Runtime Selection | Accepted | `RuntimeAdapter (LocalBrowserRuntime)` designated. See `docs/ADR/ADR-A1-authoritative-runtime-selection.md` |

## Rules

1. No ABI file in `src/platform/contracts/` may be modified without creating a new ADR entry.
2. Every ABI change requires a semver bump in the ABI file header comment.
3. Breaking changes (removing fields, changing types) require a major version bump and a migration strategy.
4. ADRs are append-only. Mark superseded ADRs as 'Superseded by ADR-XXX'.
