# CHATR-SPEC-008 — Runtime Contract Specification

| Field          | Value                                      |
|----------------|--------------------------------------------|
| Document ID    | CHATR-SPEC-008                             |
| Status         | Active                                     |
| Version        | 1.0.0                                      |
| Depends On     | CHATR-SPEC-005 (EVENT_SPEC_v1), CHATR-SPEC-009 (AUTHORITY_SPEC_v1) |
| Part Of        | CHATR Intent OS Specification Suite v1.0.0 |
| Date           | 2026-07-16                                 |

---

## 1. Purpose

LAW-5 states: every runtime exists only to observe, evaluate, execute, verify, or improve the lifecycle of an Intent Object. This document operationalizes that law by defining a uniform contract that every runtime MUST answer. The contract is the same set of questions for each runtime; the answers differ. A runtime that cannot fully answer these questions is not a conformant runtime and MUST NOT be registered with the kernel.

---

## 2. Contract Schema

Every runtime is defined by answers to the following questions:

| Question                              | Description                                                                              |
|---------------------------------------|------------------------------------------------------------------------------------------|
| **Verb (LAW-5)**                      | Which verb from LAW-5 governs this runtime? (observe / evaluate / execute / verify / improve) |
| **Inputs**                            | What does this runtime read to do its work?                                              |
| **Outputs**                           | What does this runtime produce?                                                          |
| **May emit events**                   | Which event namespaces may this runtime emit on the kernel bus?                          |
| **May NOT emit**                      | Which event namespaces are explicitly forbidden to this runtime?                         |
| **May read intent state**             | Can this runtime read Intent Objects from the kernel store?                              |
| **May write intent state**            | Can this runtime write to Intent Objects, and if so, which fields?                       |
| **May call other runtimes directly**  | Always NO. All inter-runtime communication is via the kernel event bus only.             |
| **May persist data**                  | Can this runtime write to persistent storage, and if so, what?                           |
| **Failure behavior**                  | What does this runtime do when it encounters an unrecoverable error?                     |

---

## 3. Observation Runtime Contract

| Contract Field                    | Answer                                                                                                           |
|-----------------------------------|------------------------------------------------------------------------------------------------------------------|
| **Verb**                          | Observe                                                                                                          |
| **Inputs**                        | External world signals: calendar APIs, price feeds, email/SMS parsers, webhooks, document stores.               |
| **Outputs**                       | `world.changed` events on the kernel bus.                                                                        |
| **May emit events**               | `world` namespace only (`world.changed`).                                                                        |
| **May NOT emit**                  | `intent`, `execution`, `verification`, `policy`, `stewardship`, `learning`, `kernel` namespaces.                |
| **May read intent state**         | No. The Observation Runtime has no access to Intent Objects or the intent store.                                 |
| **May write intent state**        | No. Zero write authority on any field of any Intent Object.                                                      |
| **May call other runtimes directly** | No.                                                                                                           |
| **May persist data**              | Yes — own read-cache only. A short-lived local buffer for deduplication. Not persisted across restarts. No access to the kernel's persistent stores. |
| **Failure behavior**              | On source connection failure: log internally, continue attempting reconnection with exponential backoff. Do NOT emit any event. Do NOT notify users. Kernel detects long absence of `world.changed` events and may alert if monitoring is configured. |

---

## 4. Stewardship Runtime Contract

| Contract Field                    | Answer                                                                                                           |
|-----------------------------------|------------------------------------------------------------------------------------------------------------------|
| **Verb**                          | Evaluate                                                                                                         |
| **Inputs**                        | Intent Objects (all `STEWARDED` phase intents from the kernel store), `world.changed` events from the kernel bus, Policy objects for each stewarded intent. |
| **Outputs**                       | Lifecycle transition requests to the kernel (via bus), stewardship field updates on Intent Objects, escalation notifications to users. |
| **May emit events**               | `stewardship` namespace (`stewardship.triggered`, `stewardship.escalated`, `stewardship.recovered`).            |
| **May NOT emit**                  | `world`, `execution`, `verification`, `policy`, `learning`, `intent`, `kernel` namespaces.                      |
| **May read intent state**         | Yes — all Intent Objects where `lifecycle.phase = STEWARDED`.                                                    |
| **May write intent state**        | Yes — `stewardship` field only (next trigger time, trigger count, trigger type). All lifecycle transitions are requested via bus; the kernel applies them. |
| **May call other runtimes directly** | No.                                                                                                           |
| **May persist data**              | Yes — stewardship schedule data (next trigger times, trigger counters) in the `stewarded_intents` table, co-located with the kernel's intent store. Write access is scoped to stewardship fields only. |
| **Failure behavior**              | On trigger evaluation failure: emit `stewardship.escalated` with `reason = "trigger_evaluation_failed"`. Set intent condition to `ESCALATED`. Do not silently drop the trigger event. |

---

## 5. Execution Runtime Contract

| Contract Field                    | Answer                                                                                                           |
|-----------------------------------|------------------------------------------------------------------------------------------------------------------|
| **Verb**                          | Execute                                                                                                          |
| **Inputs**                        | The intent's `plan` object (execution plan), the evaluated Policy, an `ExecutionContext` (see ABI_v1 §3).       |
| **Outputs**                       | `ExecutionResult` object written to the intent's history via the kernel bus; `execution.*` events.              |
| **May emit events**               | `execution` namespace (`execution.started`, `execution.completed`, `execution.failed`, `execution.retrying`).   |
| **May NOT emit**                  | `world`, `verification`, `policy`, `stewardship`, `learning`, `intent`, `kernel` namespaces.                    |
| **May read intent state**         | Yes — reads `plan` and `policy` fields to construct and authorize the execution.                                  |
| **May write intent state**        | Yes — appends to `history` (via kernel bus); writes `execution_result` (via kernel bus). Does NOT directly mutate the intent store; all writes are mediated by the kernel. |
| **May call other runtimes directly** | No. Does NOT invoke the Observation Runtime, Verification Runtime, or any other runtime.                     |
| **May persist data**              | No independent persistent store. Execution artifacts (receipts, raw API responses) are referenced by `execution_result.output` URIs and stored in ephemeral execution logs outside the kernel store. |
| **Failure behavior**              | On execution failure: emit `execution.failed`. Do NOT emit `execution.completed`. Do NOT transition the intent's lifecycle. The kernel's failure handler evaluates the policy's `on_failure` and `retry` configuration and acts accordingly. |

**Critical constraint (LAW-3):** The Execution Runtime does NOT observe real-world state during or after execution. It dispatches the action and reports the transport-level outcome. Real-world outcome observation is the Verification Runtime's sole responsibility.

---

## 6. Verification Runtime Contract

| Contract Field                    | Answer                                                                                                           |
|-----------------------------------|------------------------------------------------------------------------------------------------------------------|
| **Verb**                          | Verify                                                                                                           |
| **Inputs**                        | `execution_result` from the completed intent, `capability_id` to determine verification class, `VerificationContext` (see ABI_v1 §6). |
| **Outputs**                       | `VerificationResult` object; `verification.*` events.                                                            |
| **May emit events**               | `verification` namespace (`verification.started`, `verification.completed`, `verification.failed`).              |
| **May NOT emit**                  | `world`, `execution`, `policy`, `stewardship`, `learning`, `intent`, `kernel` namespaces.                        |
| **May read intent state**         | Yes — reads `execution_result` and `policy` (to determine retry limits and verification timing).                  |
| **May write intent state**        | Yes — writes `verification_result` to the intent via the kernel bus. Does not directly mutate the intent store.  |
| **May call other runtimes directly** | No.                                                                                                           |
| **May persist data**              | No independent persistent store. Verification polling state (poll count, last polled at) is held in memory for the duration of the verification cycle. |
| **Failure behavior**              | On verification failure: emit `verification.failed`. Do NOT emit `verification.completed`. Consult policy retry config; if retries remain, wait the backoff interval and re-attempt. If max retries exceeded, emit `stewardship.escalated` (via bus) and set intent condition to `ESCALATED`. |

---

## 7. Learning Runtime Contract

| Contract Field                    | Answer                                                                                                           |
|-----------------------------------|------------------------------------------------------------------------------------------------------------------|
| **Verb**                          | Improve                                                                                                          |
| **Inputs**                        | Intent history (read-only): `history` arrays of completed and archived intents, `execution_result`, `verification_result`, `policy` evaluations over time. |
| **Outputs**                       | `learning.suggestion_created` events. These events carry proposed policy changes; they are surfaced to the user and do not take effect until the user approves. |
| **May emit events**               | `learning` namespace — `learning.suggestion_created` only. The kernel emits `learning.suggestion_approved` and `learning.suggestion_rejected` in response to user action; the Learning Runtime does NOT emit these. |
| **May NOT emit**                  | `world`, `execution`, `verification`, `policy`, `stewardship`, `intent`, `kernel` namespaces. May NOT emit `learning.suggestion_approved` or `learning.suggestion_rejected`. |
| **May read intent state**         | Yes — read-only access to all intent history. Cannot modify any field.                                           |
| **May write intent state**        | **No.** The Learning Runtime has zero write authority on Intent Objects.                                          |
| **May call other runtimes directly** | No.                                                                                                           |
| **May persist data**              | Yes — own internal model state (pattern weights, suggestion history) in an isolated learning store. No access to the kernel's intent store, policy store, or event store. |
| **Failure behavior**              | On analysis failure: log internally. Do NOT emit any event. The absence of suggestions is not an error state for the system. Learning Runtime failures are silent to the user unless the user is actively viewing learning suggestions. |

**Inviolable constraint:** The Learning Runtime MUST NOT modify policy. It MUST NOT change intent state. It MUST NOT approve its own suggestions. These are hard boundaries; see AUTHORITY_SPEC_v1 §6.

---

## 8. Conformance

1. A runtime that violates any CANNOT in its contract (§3–§7) is non-conformant.
2. Non-conformant runtimes MUST NOT be registered with the kernel.
3. The kernel MUST validate runtime contracts at registration time. Contract validation includes: verifying the runtime's declared event emission capabilities match those in §3–§7, and verifying the runtime's declared write scopes match those in §3–§7.
4. A runtime that is registered as conformant but is subsequently observed violating its contract MUST be deregistered by the kernel and `kernel.lifecycle_violation` MUST be emitted.
5. Conformance tests for each runtime are defined in the CHATR Test Suite (separate document). Each CANNOT clause in §3–§7 corresponds to a required test case.

---

## 9. Versioning

| Increment | Criteria                                                                                           |
|-----------|----------------------------------------------------------------------------------------------------|
| PATCH     | Non-normative clarifications. No change to any runtime contract.                                   |
| MINOR     | Addition of a new runtime contract. Existing runtime contracts unchanged.                          |
| MAJOR     | Change to any existing runtime's CAN/CANNOT constraints, event authority, or write scope.          |

The current version of this document is **1.0.0**. All changes are recorded in `CHANGELOG.md`.
