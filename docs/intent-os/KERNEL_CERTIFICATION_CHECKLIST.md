# CHATR Kernel Certification Checklist

Date: 2026-07-15
Status: Active — applied at each Platform Milestone boundary.

This checklist is the formal gate that determines whether a milestone is **Kernel Certified**. "All tests passed" is insufficient. A milestone is certified only when every item below passes with recorded evidence.

Saying "certified" without completing this checklist is not allowed.

---

## Certification Procedure

1. Complete all implementation deliverables for the milestone.
2. Run the full automated gate suite (Architecture Lint, Tests, ABI Check, Contract Validation).
3. Complete every item in this checklist.
4. Fill in the Certification Report at the bottom of this document.
5. Submit for Architecture Board review.
6. Board decision: **Certified** or **Not Certified with required remediation**.

---

## Checklist

### Section 1 — Architecture Purity

| # | Check | Pass Condition | Evidence |
| --- | --- | --- | --- |
| 1.1 | Architecture Lint | Zero violations | Lint report attached |
| 1.2 | Domain runtime count | 0 files containing `FoodRuntime`, `TravelRuntime`, `ShoppingRuntime`, or equivalent | Lint output |
| 1.3 | Domain capability IDs | 0 capabilities with industry prefixes (`food.*`, `travel.*`, etc.) | Lint output |
| 1.4 | Domain branches in kernel | 0 `switch/if` branches on industry strings in kernel, runtime, planner, workflow, or provider code | Code review + lint |
| 1.5 | Hardcoded provider IDs in routing | 0 hardcoded provider IDs in kernel dispatch logic | Code review |
| 1.6 | Industry-bound UI widgets | 0 UI components that branch by industry | Code review |
| 1.7 | Kernel Pipeline Integrity | All goal executions traverse `Capability → Strategy → Provider → Execution` | Test evidence |

### Section 2 — ABI Compatibility

| # | Check | Pass Condition | Evidence |
| --- | --- | --- | --- |
| 2.1 | ABI version declared | All ABI objects carry the current `abi` version field | Schema validation report |
| 2.2 | ContextFrame schema | Passes `chatr.context.v0_9_rc` schema validation | Test evidence |
| 2.3 | IntentFrame schema | Passes `chatr.intent.v0_9_rc` schema validation | Test evidence |
| 2.4 | EntityGraph schema | Passes `chatr.entity_graph.v0_9_rc` schema validation | Test evidence |
| 2.5 | GoalPlan schema | Passes `chatr.goal_plan.v0_9_rc` schema validation | Test evidence |
| 2.6 | CapabilityGraph schema | Passes `chatr.capability_graph.v0_9_rc` schema validation | Test evidence |
| 2.7 | StrategySelection schema | Passes `chatr.strategy_selection.v0_9_rc` schema validation | Test evidence |
| 2.8 | GoalRuntimeState schema | Passes `chatr.goal_runtime_state.v0_9_rc` schema validation | Test evidence |
| 2.9 | WorldState schema | Passes `chatr.world_state.v0_9_rc` schema validation | Test evidence |
| 2.10 | ReconciliationDecision schema | Passes `chatr.reconciliation_decision.v0_9_rc` schema validation | Test evidence |
| 2.11 | PolicyDecision schema | Passes `chatr.policy_decision.v0_9_rc` schema validation | Test evidence |
| 2.12 | TrustAssessment schema | Passes `chatr.trust_assessment.v0_9_rc` schema validation | Test evidence |
| 2.13 | WorkflowGraph schema | Passes `chatr.workflow_graph.v0_9_rc` schema validation | Test evidence |
| 2.14 | ProviderManifest schema | Passes `chatr.provider_manifest.v0_9_rc` schema validation | Test evidence |
| 2.15 | No undocumented ABI fields | No extra fields in ABI objects not in the current spec | Schema diff report |
| 2.16 | ABI-breaking changes | Zero ABI-breaking changes without an accepted ADR | ADR log |

### Section 3 — Goal Runtime

| # | Check | Pass Condition | Evidence |
| --- | --- | --- | --- |
| 3.1 | Durable GoalRuntimeState | State survives process kill and restart | Restart test log |
| 3.2 | Goal state machine | All valid state transitions pass; invalid transitions are rejected | State machine test evidence |
| 3.3 | Stopping conditions | All four stopping conditions enforced: `verified_complete`, `user_cancelled`, `policy_blocked`, `max_recovery_attempts_exceeded` | Integration test |
| 3.4 | Goals survive crash | A goal in `running` state resumes correctly after unclean shutdown | Crash recovery test log |

### Section 4 — Event Bus

| # | Check | Pass Condition | Evidence |
| --- | --- | --- | --- |
| 4.1 | Typed lifecycle events | All kernel events carry declared schemas | Schema validation |
| 4.2 | Event delivery | Events delivered to all subscribers; no silent drop | Test evidence |
| 4.3 | Event ordering | Events for a single goal maintain causal ordering | Test evidence |
| 4.4 | Consequential actions emit events | Every external action, policy check, provider call, and state transition emits an event | Audit log review |

### Section 5 — Context Engine

| # | Check | Pass Condition | Evidence |
| --- | --- | --- | --- |
| 5.1 | ContextFrame built before planning | No goal plan may be produced without a prior ContextFrame | Integration test |
| 5.2 | Required fields populated | `time`, `device`, `gps`, `wallet`, `preferences`, `permissions`, `history`, `execution_memory` present or explicitly null | Schema validation |
| 5.3 | No domain keys in context | Context stores no `food`, `hotel`, or industry-keyed memory | Code review + lint |

### Section 6 — Capability ABI

| # | Check | Pass Condition | Evidence |
| --- | --- | --- | --- |
| 6.1 | All capabilities in universal catalog | 100% of runtime capability IDs exist in the Capability Catalog | Catalog diff |
| 6.2 | No industry-prefixed capabilities | 0 capabilities with industry prefixes | Lint output |
| 6.3 | Capability contract versions declared | 100% of capability requests carry `capability_contract_version` | Schema validation |
| 6.4 | Capability contracts validate | All declared capability contracts pass schema validation | Contract validator report |

### Section 7 — Provider Manifest ABI

| # | Check | Pass Condition | Evidence |
| --- | --- | --- | --- |
| 7.1 | Manifests validate | All provider manifests pass `chatr.provider_manifest.v0_9_rc` validation | Manifest validator report |
| 7.2 | Capability contract versions | All provider manifests declare `capability_contract_version` per capability | Manifest validator report |
| 7.3 | Entity types are ontology IDs | No runtime domain strings in `supported_entities` | Manifest review |
| 7.4 | Execution mode order | API → Native App → Browser Runtime → Human Assist; Simulation disallowed in production | Code review |
| 7.5 | Required manifest fields | All required fields present in every manifest | Manifest validator report |

### Section 8 — Autonomous Runtime (applicable from Milestone C)

| # | Check | Pass Condition | Evidence |
| --- | --- | --- | --- |
| 8.1 | Observer Loop records observations | External state observations recorded with `source`, `confidence`, `observed_at` | Integration test |
| 8.2 | Reconciliation recovers failures | At least one provider failure results in automatic reconciliation and recovery | Recovery test log |
| 8.3 | Scheduler resumes suspended goals | A `suspended` goal resumes correctly at the scheduled time | Scheduler test |
| 8.4 | Long-running goal survives restart | A goal in `observing` or `reconciling` state resumes after process restart | Integration test |
| 8.5 | Verification gates completion | No goal transitions to `completed` without a passing `VERIFY` step | Test evidence |

### Section 9 — Kernel Services

| # | Check | Pass Condition | Evidence |
| --- | --- | --- | --- |
| 9.1 | Identity Service boundary | No provider or agent resolves identity directly | Code review |
| 9.2 | Secrets Service boundary | No credential accessed outside Secrets Service | Code review + lint |
| 9.3 | Policy Service boundary | Every external action is policy-checked before execution | Integration test |
| 9.4 | Trust Service boundary | Provider trust computed by kernel from evidence, not declared by provider | Trust test |
| 9.5 | Resource Manager boundary | Scarce resources leased before use | Integration test |
| 9.6 | Audit Service | All external actions produce an audit record | Audit log review |
| 9.7 | Memory never bypasses policy | Execution memory improves ranking but cannot skip a policy check | Test evidence |

### Section 10 — Performance Budget

| # | Metric | Target | Measured |
| --- | --- | --- | --- |
| 10.1 | Intent parsing latency | < 200 ms p95 | Measured value |
| 10.2 | Entity resolution latency | < 300 ms p95 | Measured value |
| 10.3 | Capability resolution latency | < 100 ms p95 | Measured value |
| 10.4 | Strategy resolution latency | < 100 ms p95 | Measured value |
| 10.5 | Provider ranking latency | < 200 ms p95 | Measured value |
| 10.6 | Workflow generation latency | < 200 ms p95 | Measured value |
| 10.7 | Restart recovery time | < 5 s | Measured value |
| 10.8 | Recovery success rate | > 99% | Measured value |
| 10.9 | Goal completion rate | > 99% | Measured value |
| 10.10 | Verification failure rate | < 1% | Measured value |

### Section 11 — Shared Pipeline Proof

| # | Check | Pass Condition | Evidence |
| --- | --- | --- | --- |
| 11.1 | Four distinct intents | Four or more unrelated intents (e.g., order food, book hotel, pay bill, book appointment) execute through the identical kernel pipeline | Trace logs showing same pipeline path |
| 11.2 | Only data varies | The only differences between those four executions are: ontology entities, context values, strategies, provider manifests, schemas | Diff report |
| 11.3 | No domain runtime code invoked | No domain-specific runtime code path executed during any of the four intents | Lint + trace |

### Section 12 — ADR Governance

| # | Check | Pass Condition | Evidence |
| --- | --- | --- | --- |
| 12.1 | All ABI-affecting changes have ADRs | 0 ABI-breaking changes without an accepted ADR in `ARCHITECTURE_DECISION_RECORDS/` | ADR log |
| 12.2 | ADR process active | At least one ADR filed and accepted during this milestone | ADR directory |

---

## Kernel Purity KPIs

These must all be at target to achieve certification:

| Metric | Target | Measured |
| --- | --- | --- |
| Runtime files containing industry names | 0 | |
| Capabilities containing industry prefixes | 0 | |
| Kernel branches based on industries | 0 | |
| Kernel branches based on hardcoded providers | 0 | |
| UI widgets tied to industries | 0 | |
| Provider IDs hardcoded in kernel routing | 0 | |
| Workflow templates selected by industry | 0 | |
| Provider manifests missing capability contract versions | 0 | |
| ABI-affecting changes without ADR | 0 | |

---

## Certification Artifact

Every certified milestone MUST produce a machine-readable Certification Artifact written to:

```
certifications/<milestone-id>-<kernel-version>-<date>.json
```

Example: `certifications/platform-milestone-b-v0.9.1-2026-08-01.json`

The artifact schema is:

```json
{
  "schema": "chatr.certification.v1",
  "certification_id": "uuid",
  "milestone": "Platform Milestone B",
  "kernel_version": "0.9.1",
  "abi_version": "chatr.kernel.v0_9_rc",
  "certified": true,
  "certification_date": "2026-08-01T00:00:00Z",
  "build_sha": "git-sha",
  "tests_passed": 421,
  "tests_failed": 0,
  "sections": {
    "architecture_purity": "PASS",
    "abi_compatibility": "PASS",
    "goal_runtime": "PASS",
    "event_bus": "PASS",
    "context_engine": "PASS",
    "capability_abi": "PASS",
    "provider_manifest_abi": "PASS",
    "autonomous_runtime": "N/A",
    "kernel_services": "PASS",
    "performance_budget": "PASS",
    "shared_pipeline_proof": "PASS",
    "adr_governance": "PASS"
  },
  "kernel_purity": {
    "domain_runtime_files": 0,
    "industry_capability_ids": 0,
    "domain_branches_in_kernel": 0,
    "hardcoded_provider_ids": 0,
    "industry_bound_ui_widgets": 0,
    "workflow_templates_by_industry": 0,
    "manifests_missing_contract_versions": 0,
    "abi_changes_without_adr": 0
  },
  "architecture_purity_score": 100,
  "abi_compatible": true,
  "open_risks": [],
  "approved_by": ["Architecture Board"],
  "submitted_by": "",
  "notes": ""
}
```

A certification without a signed artifact file is not a certification.

## Human Certification Report

Fill this alongside the artifact for each milestone certification attempt.

```
Kernel Certification Report
============================
Platform Milestone:
Kernel Version:
ABI Version:
Date:
Build SHA:
Submitted By:

Section Results
---------------
1 - Architecture Purity:         PASS / FAIL
2 - ABI Compatibility:           PASS / FAIL
3 - Goal Runtime:                PASS / FAIL
4 - Event Bus:                   PASS / FAIL
5 - Context Engine:              PASS / FAIL
6 - Capability ABI:              PASS / FAIL
7 - Provider Manifest ABI:       PASS / FAIL
8 - Autonomous Runtime:          PASS / FAIL / N/A
9 - Kernel Services:             PASS / FAIL
10 - Performance Budget:         PASS / FAIL
11 - Shared Pipeline Proof:      PASS / FAIL
12 - ADR Governance:             PASS / FAIL

Kernel Purity KPIs:              ALL TARGET / NOT AT TARGET

Open Risks:

Architecture Board Decision:
  [ ] CERTIFIED — Artifact written to certifications/
  [ ] NOT CERTIFIED — Required remediation:

Certified By:
Certification Date:
```

---

## Platform Milestone Certification Matrix

| Platform Milestone | Cert Required Sections | Kernel Version Target | Status |
| --- | --- | --- | --- |
| Platform Milestone A — Kernel Core | 1, 2, 3, 4, 5, 6, 12 | 0.9.0-rc | ✅ Certified |
| Platform Milestone B — Resolution Layer | 1, 2, 3, 4, 5, 6, 7, 9, 12 | 0.9.1 | 🔲 Pending |
| Platform Milestone C — Autonomous Runtime | All sections | 0.9.2 | 🔲 Pending |
| Platform Milestone D — Provider Platform | All sections | 0.9.3 | 🔲 Pending |
| Platform Milestone E — Intent Platform | All sections | 1.0 | 🔲 Pending |

---

> Kernel ABI v1.0 freeze requires Platform Milestone C certification or higher.
> A certified milestone is a stronger claim than "all tests passed."
> Certification is evidence, not opinion.
> A certification without a machine-readable artifact file is not a certification.
