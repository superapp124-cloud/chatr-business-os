# CHATR Platform — Release Process

Date: 2026-07-15
Status: Active — applies to all milestones from Milestone B onward.

This document governs how software is shipped. It is an engineering process document, not an architecture document. It does not change the kernel ABI, introduce new abstractions, or supersede the Engineering Constitution.

---

## Release Pipeline

```
Developer
  ↓
PR / Branch
  ↓
Architecture Lint  ← automated, blocks merge on violation
  ↓
Unit & Integration Tests  ← automated, blocks merge on failure
  ↓
ABI Compatibility Check  ← automated, validates all ABI objects
  ↓
Capability Contract Validation  ← automated
  ↓
Provider Manifest Validation  ← automated, for any provider changes
  ↓
Kernel Certification Checklist  ← manual review at milestone boundaries
  ↓
Merge to main
  ↓
Release Candidate build
  ↓
Acceptance Tests (shared kernel pipeline)
  ↓
Production
```

---

## Gate Definitions

### Gate 1 — Architecture Lint

Every PR touching the following paths must pass Architecture Lint:

- `kernel/`
- `runtime/`
- `planner/`
- `provider/`
- `workflow/`
- `ontology/`
- `sdk/`
- `electron/chatr-core/`
- `src/core/`

Architecture Lint rejects:

| Violation | Example |
| --- | --- |
| Domain runtime class or module | `FoodRuntime`, `TravelRuntime`, `ShoppingRuntime` |
| Industry-prefixed capability ID | `food.search`, `travel.book`, `shopping.buy` |
| Domain branch in kernel | `switch(food)`, `if (category == "travel")` |
| Hardcoded provider ID in kernel routing | Any provider name in kernel dispatch logic |
| Industry-bound UI widget | Components that branch by `food`, `hotel`, `flight` |
| Provider routing bypassing ABI | Skipping `Capability → Strategy → Provider → Execution` |

### Gate 2 — Unit & Integration Tests

- All tests must pass.
- Test coverage must not regress.
- Tests must use canonical ABI objects (not mocked domain shapes).

### Gate 3 — ABI Compatibility Check

Validates that all ABI objects emitted by modified code conform to the current Kernel ABI version:

```
chatr.context.v0_9_rc
chatr.intent.v0_9_rc
chatr.entity_graph.v0_9_rc
chatr.goal_plan.v0_9_rc
chatr.capability_request.v0_9_rc
chatr.capability_graph.v0_9_rc
chatr.strategy_selection.v0_9_rc
chatr.goal_runtime_state.v0_9_rc
chatr.world_state.v0_9_rc
chatr.reconciliation_decision.v0_9_rc
chatr.policy_decision.v0_9_rc
chatr.trust_assessment.v0_9_rc
chatr.resource_lease.v0_9_rc
chatr.agent_proposal.v0_9_rc
chatr.workflow_graph.v0_9_rc
chatr.ui_schema.v0_9_rc
chatr.provider_manifest.v0_9_rc
```

Any ABI-breaking change requires an ADR and approval before the PR may be merged.

### Gate 4 — Capability Contract Validation

Every capability declared in a PR must exist in the universal Capability Catalog. Capability names must not encode industries. The capability contract version must be declared.

### Gate 5 — Provider Manifest Validation

For any PR modifying a provider or manifest:

- ABI version is declared and supported.
- All declared capabilities exist in the Capability Catalog.
- Capability contract versions are declared.
- Supported entity types are ontology IDs, not runtime domains.
- All required manifest fields are present: `capabilities`, `execution_modes`, `authentication`, `permissions`, `rate_limits`, `latency`, `reliability`, `cost`, `policies`, `observation`, `recovery`, `resource_profile`, `audit`, `trust_evidence`, `health_check`, `compatibility`.

### Gate 6 — Kernel Certification Checklist

Applied at milestone boundaries (not every PR). See `KERNEL_CERTIFICATION_CHECKLIST.md`.

---

## Kernel Versioning

The kernel is versioned explicitly. Git tags alone are insufficient.

| Version | Status | Notes |
| --- | --- | --- |
| 0.9 RC | Active | Current implementation target |
| 0.9.1 | Planned | First patch after Milestone B evidence |
| 0.9.2 | Planned | Autonomous runtime evidence |
| 1.0 | Pending | Requires full Certification Checklist passage |

Kernel version is declared in a machine-readable manifest at:

```
kernel/version.json
```

Format:

```json
{
  "kernel_version": "0.9.0-rc",
  "abi_version": "chatr.kernel.v0_9_rc",
  "certified": false,
  "certification_date": null,
  "milestone": "A"
}
```

---

## Milestone Gate Summary

| Milestone | Focus | Release Gate |
| --- | --- | --- |
| A — Kernel Core | Goal Runtime, Event Bus, Context, Entity, Planner, Lint | Lint + Tests + Restart proof |
| B — Resolution Layer | Capability Resolver, Strategy, Provider Intelligence, Trust, Policy, Resources | All gates + dynamic provider selection proof |
| C — Autonomous Runtime | Workflow Generator, Observer, World State, Reconciliation, Verification, Scheduler | All gates + recovery proof + long-running goal proof |
| D — Provider Platform | Provider SDK, Manifest SDK, Validator, Marketplace, Extension SDK | All gates + third-party provider proof |
| E — Intent Platform | Desktop, Android, iOS, Web, Enterprise | All gates + cross-platform shared-kernel proof |

---

## ADR Requirement

Every ABI-affecting change requires an Architecture Decision Record (ADR) filed in:

```
docs/intent-os/ARCHITECTURE_DECISION_RECORDS/
```

ADR format:
- Status: `proposed` → `accepted` → `superseded`
- Context: what problem exists
- Decision: what was decided
- Consequences: what changes
- ABI impact: which ABI objects are affected

---

## What This Process Does Not Govern

- What the architecture is (see `KERNEL_ABI_V0_9_RC.md`)
- Which capabilities exist (see `CAPABILITY_CATALOG_V0_9_RC.md`)
- Which ADRs govern which decisions (see `ARCHITECTURE_DECISION_RECORDS/`)
- What agents are allowed to implement (see `ENGINEERING_CONSTITUTION.md`)
