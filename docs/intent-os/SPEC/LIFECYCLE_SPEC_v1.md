# CHATR-SPEC-003 — Lifecycle Specification

| Field          | Value                                      |
|----------------|--------------------------------------------|
| Document ID    | CHATR-SPEC-003                             |
| Status         | Active                                     |
| Version        | 1.0.0                                      |
| Depends On     | CHATR-SPEC-002 (INTENT_OBJECT_SPEC_v1)     |
| Part Of        | CHATR Intent OS Specification Suite v1.0.0 |
| Date           | 2026-07-16                                 |

---

## 1. Purpose

This document defines the complete lifecycle of an Intent Object: every phase, every legal state transition, every forbidden transition, and the orthogonal operational condition system. The kernel's lifecycle guard MUST enforce every rule in this document without exception.

---

## 2. Lifecycle Phases

An Intent Object occupies exactly one phase at any moment. Phase names are uppercase string literals. The kernel MUST reject any phase value not listed here.

| Phase        | Definition                                                                                                                                             |
|--------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| `DRAFT`      | The intent has been recognized from user input and an Intent Object has been created. No execution plan exists yet. No execution has occurred.          |
| `PLANNED`    | The Planner has constructed an execution plan and attached it to the intent's `plan` field. The intent is authorized to proceed to execution.           |
| `EXECUTING`  | An Execution Runtime has accepted the intent and execution is in progress. The real-world action has been initiated but not yet confirmed complete.      |
| `VERIFYING`  | Execution has reported completion. The Verification Runtime is confirming that the expected real-world outcome was achieved.                             |
| `COMPLETED`  | Verification has passed. The intent's one-shot lifecycle is concluded. The intent is read-only unless the user explicitly transitions it to STEWARDED.  |
| `STEWARDED`  | The user has explicitly authorized ongoing management of this intent. The lifecycle continues. The Stewardship Runtime monitors and re-triggers as needed. |
| `ARCHIVED`   | The lifecycle has permanently ended. The intent is read-only in perpetuity. No transitions out of this phase are possible.                              |

---

## 3. Legal Transitions

The following table defines every legal phase transition. Any transition not in this table is forbidden (see §4). "Authority" is the principal that may authorize the transition; the kernel enforces this at the lifecycle guard level.

| From          | To           | Authority                              | Condition                                                       |
|---------------|--------------|----------------------------------------|-----------------------------------------------------------------|
| `DRAFT`       | `PLANNED`    | Kernel                                 | Planner has produced a valid plan for the intent.               |
| `DRAFT`       | `ARCHIVED`   | User or Kernel                         | User explicitly cancels, or kernel encounters unrecoverable recognition failure. |
| `PLANNED`     | `EXECUTING`  | Kernel                                 | Policy permits execution; all required approvals are satisfied. |
| `PLANNED`     | `DRAFT`      | Kernel                                 | Kernel determines re-planning is required (e.g., plan is stale or ambiguous). |
| `PLANNED`     | `ARCHIVED`   | User                                   | User explicitly cancels the intent before execution begins.     |
| `EXECUTING`   | `VERIFYING`  | Kernel                                 | Execution Runtime reports `execution.completed`.                |
| `EXECUTING`   | `PLANNED`    | Kernel                                 | Execution failed; retry authorized by policy; re-plan required. |
| `EXECUTING`   | `ARCHIVED`   | Kernel                                 | Execution failure is unrecoverable; no retry authorized.        |
| `VERIFYING`   | `COMPLETED`  | Kernel                                 | Verification Runtime reports `verification.completed` with `verified: true`. |
| `VERIFYING`   | `EXECUTING`  | Kernel                                 | Verification failed; retry authorized by policy's `retry` configuration. |
| `VERIFYING`   | `ARCHIVED`   | Kernel                                 | Maximum retry attempts exceeded; no further action possible.    |
| `COMPLETED`   | `STEWARDED`  | User                                   | User explicitly authorizes ongoing stewardship for this intent. |
| `COMPLETED`   | `ARCHIVED`   | User or Kernel                         | User explicitly archives, or kernel applies TTL expiry.         |
| `STEWARDED`   | `EXECUTING`  | Kernel                                 | Stewardship Runtime detects a trigger condition that matches policy. |
| `STEWARDED`   | `ARCHIVED`   | User                                   | User explicitly retires the stewardship.                        |
| `ARCHIVED`    | *(none)*     | *(none)*                               | Terminal phase. No transition is possible from ARCHIVED.        |

---

## 4. Forbidden Transitions

The following transitions are explicitly forbidden. A runtime or user request that attempts any of these MUST be rejected by the lifecycle guard with `LIFECYCLE_VIOLATION` (see §7).

| Attempted Transition             | Reason                                                                                    |
|----------------------------------|-------------------------------------------------------------------------------------------|
| `DRAFT` → `STEWARDED`            | An intent cannot be stewarded before it has been executed and verified.                   |
| `DRAFT` → `EXECUTING`            | An intent cannot be executed without a plan. PLANNED is a mandatory intermediate phase.   |
| `DRAFT` → `VERIFYING`            | No execution has occurred; nothing to verify.                                             |
| `DRAFT` → `COMPLETED`            | Completion requires execution and verification.                                           |
| `PLANNED` → `STEWARDED`          | An intent cannot be stewarded before execution and verification.                          |
| `PLANNED` → `VERIFYING`          | No execution has occurred; nothing to verify.                                             |
| `PLANNED` → `COMPLETED`          | Completion requires execution and verification.                                           |
| `EXECUTING` → `COMPLETED`        | Execution completion alone does not constitute completion. VERIFYING is mandatory.        |
| `EXECUTING` → `STEWARDED`        | An intent cannot be stewarded during active execution.                                    |
| `VERIFYING` → `DRAFT`            | Once execution has occurred, re-entry to DRAFT is forbidden.                              |
| `VERIFYING` → `PLANNED`          | Once execution has occurred, re-entry to PLANNED is forbidden.                            |
| `VERIFYING` → `STEWARDED`        | An intent cannot be stewarded while verification is in progress.                          |
| `COMPLETED` → `EXECUTING`        | A completed intent cannot be re-executed without explicit user-initiated stewardship transition first. |
| `COMPLETED` → `PLANNED`          | A completed intent cannot be re-planned without explicit user-initiated stewardship transition first. |
| `ARCHIVED` → *(any)*             | ARCHIVED is terminal and immutable. No transition out of this phase is possible, ever.    |

---

## 5. Operational Conditions

Operational condition is orthogonal to lifecycle phase. It describes the current operational state of the intent, independent of where it sits in the lifecycle. An intent is always in exactly one phase and exactly one condition (except ARCHIVED; see §6).

| Condition     | Fields                                                        | Meaning                                                                                       |
|---------------|---------------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| `HEALTHY`     | *(none)*                                                      | The intent is operating normally within its current phase.                                    |
| `RETRYING`    | `count: integer`                                              | A previous action failed; the system is retrying. `count` is the number of attempts so far.  |
| `WAITING`     | `reason: string`, `since: ISO8601 timestamp`                  | The intent is blocked waiting for an external condition. `reason` describes what is awaited.  |
| `ESCALATED`   | `reason: string`, `escalated_at: ISO8601 timestamp`           | The intent has exceeded its automatic recovery capability and requires explicit user attention. |
| `BLOCKED`     | `reason: string`                                              | The intent cannot proceed due to a definite blocking condition (e.g., policy denied, auth required). |
| `RECOVERED`   | `from_condition: string`, `at: ISO8601 timestamp`             | The intent has successfully recovered from a prior non-HEALTHY condition.                     |

---

## 6. Condition Rules

1. An intent MAY be in any phase with any compatible condition.
2. `ARCHIVED` phase FORCES `condition = null`. Any intent in `ARCHIVED` phase with a non-null condition is in an invalid state.
3. `ESCALATED` condition requires that the Stewardship Runtime has emitted `stewardship.escalated` and the user has been notified.
4. `RETRYING` condition requires that the policy's `retry` object specifies `max_attempts > 0` and the current attempt count has not exceeded it.
5. Transition from `RETRYING` to `HEALTHY` or `RECOVERED` is the kernel's responsibility; no runtime may set `condition = HEALTHY` directly.
6. A condition change MUST emit `intent.condition_changed` event with the prior and new condition values in the payload.

---

## 7. Machine Testability

Each rule in §3 and §4 is enforced by the kernel's lifecycle guard at runtime.

- A lifecycle guard is a pure function: `guard(current_phase, target_phase, authority) → allowed: boolean | LIFECYCLE_VIOLATION`.
- Any attempted illegal transition MUST throw a `LIFECYCLE_VIOLATION` error. The error payload MUST include:

```json
{
  "error": "LIFECYCLE_VIOLATION",
  "intent_id": "<UUID>",
  "from_phase": "<current phase>",
  "to_phase": "<attempted phase>",
  "authority": "<principal that attempted the transition>",
  "timestamp": "<ISO8601>"
}
```

- The guard MUST be invoked before any state is written. No partial writes are permitted on a LIFECYCLE_VIOLATION.
- Unit tests MUST cover every row in §3 (each transition succeeds when authority is correct) and every row in §4 (each forbidden transition raises LIFECYCLE_VIOLATION).
- Conformance: a lifecycle guard that permits any forbidden transition, or blocks any legal transition when authority is satisfied, is non-conformant.

---

## 8. Versioning

| Increment | Criteria                                                                                       |
|-----------|-----------------------------------------------------------------------------------------------|
| PATCH     | Non-normative clarifications. No change to phases, transitions, or conditions.                |
| MINOR     | Addition of new operational conditions. Existing phases and transitions unchanged.            |
| MAJOR     | Addition or removal of phases, change to legal or forbidden transitions, change to condition schema. |

The current version of this document is **1.0.0**. All changes are recorded in `CHANGELOG.md`.
