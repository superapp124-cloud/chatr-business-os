# Architecture Decision Records

Date: 2026-07-15
Status: governance record for CHATR Architecture v1.0

## Governance Rule

CHATR Architecture v1.0 is frozen. Kernel ABI remains v0.9 RC until implementation evidence satisfies the v1.0 gate.

From this point forward, architectural changes must be recorded as ADRs. Any change that affects ABI objects, runtime concepts, kernel services, capability contracts, provider manifests, workflow schema, UI schema, policy schema, event schema, extension SDK contracts, or OS principles requires explicit architectural approval.

Current engineering milestone: `CHATR Kernel v0.9 RC Validation`.

Architecture Phase is complete. Kernel Validation Phase has begun.

Kernel ABI and contract changes are governed by `KERNEL_ABI_CHANGE_POLICY.md`.

## Pull Request Checklist

Every pull request touching kernel, runtime, provider, ontology, workflow, UI schema, policy, event, SDK, or architecture docs must answer:

- Is this an implementation problem or an architecture problem?
- Does this introduce a new runtime concept?
- Does this introduce a new capability?
- Could this be represented as ontology instead?
- Could this be represented as provider metadata instead?
- Does this violate `OS_PRINCIPLES.md`?
- Does it change Kernel ABI, capability contract, provider manifest, workflow schema, UI schema, event schema, policy schema, or SDK contract?
- Does it require a migration path?
- Does it require a new ADR?
- Does it trigger `KERNEL_ABI_CHANGE_POLICY.md`?

If the answer is yes to an ABI or contract change, the pull request must link an accepted ADR.

Pull requests that only implement the frozen architecture should link the relevant validation item instead of proposing new architecture.

Every pull request touching `kernel/`, `runtime/`, `planner/`, `provider/`, `workflow/`, `ontology/`, `sdk/`, `electron/chatr-core/`, or `src/core/` must pass Architecture Lint and preserve Kernel Purity KPI targets.

## ADR Index

| ADR | Title | Status |
| --- | --- | --- |
| ADR-001 | Why CHATR is Goal-Oriented instead of Workflow-Oriented | Accepted |
| ADR-002 | Why Capabilities are Universal | Accepted |
| ADR-003 | Why Industries Never Enter Kernel Runtime | Accepted |
| ADR-004 | Why Providers are Manifest Driven | Accepted |
| ADR-005 | Why Goal Runtime Exists | Accepted |
| ADR-006 | Why Verification Gates Completion | Accepted |
| ADR-007 | Why Strategy is Separate from Capability | Accepted |
| ADR-008 | Why Trust is Computed by the Kernel | Accepted |

## ADR Format

Each ADR should use this shape:

```text
# ADR-NNN: Title

Date:
Status:

## Context

## Decision

## Consequences

## Migration Notes
```
