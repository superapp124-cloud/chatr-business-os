# KERNEL_MODEL_v1

**Document ID**: CHATR-SPEC-001
**Status**: Active
**Version**: 1.0.0
**Supersedes**: None

---

## 0. Five Immutable Laws

These laws govern all present and future specifications. Any component, runtime, or capability that violates them is non-conformant regardless of other justifications.

```
LAW-1   Everything the kernel manages is represented as an Intent Object.
LAW-2   Every action must be authorized by explicit user policy.
LAW-3   Observation never executes; execution never observes.
LAW-4   Every execution that matters must be verified before the system
        treats it as complete.
LAW-5   Every runtime exists only to observe, evaluate, execute, verify,
        or improve the lifecycle of an Intent Object.
```

No exception to any law is permitted without a MAJOR version increment to this document and explicit rationale recorded in CHANGELOG.md.

---

## 1. Purpose

This document defines the fundamental abstractions of the CHATR Intent OS kernel. It answers definitional questions only. Implementation is out of scope. All other SPEC documents derive from definitions stated here.

---

## 2. Fundamental Abstractions

### 2.1 Intent

An **Intent** is the kernel-internal representation of a user-expressed goal. An intent is not a message, not a command, and not a request. It is a durable object with a defined lifecycle, owned by the kernel on behalf of the user.

An intent may be one-shot (lifecycle ends at COMPLETED) or persistent (lifecycle continues into STEWARDED). The distinction is determined by user policy, not by the kernel unilaterally.

A user does not directly manipulate an intent object. The user creates policy that governs intents. The kernel manages all intent state transitions.

### 2.2 Policy

A **Policy** is a user-authored, kernel-enforced rule set that governs what the kernel is authorized to do on the user's behalf.

Policy is the law of the OS. It precedes intent in the authorization hierarchy:

```
User
 └─ Policy          <- established before any intent is evaluated
     └─ Intent
         └─ Execution
```

No execution may proceed without a policy that permits it. No runtime may modify policy. Only the user may create, update, or retire policies. The Learning Runtime may propose policy changes; it may never implement them.

### 2.3 Observation

**Observation** is the act of passively detecting changes in the external world and normalizing them into a canonical event format. Observation is performed exclusively by the Observation Runtime.

Observation has no authority. It cannot act on what it observes. It cannot notify users. It cannot change intent state. It emits `world.changed` events only. What those events mean is determined by the kernel and policy, not the Observation Runtime.

### 2.4 Execution

**Execution** is the act of interacting with an external system to fulfill a step in an intent's plan. Execution is performed exclusively by the Execution Runtime.

Execution does not observe the world. Execution does not evaluate policy. The Execution Runtime receives a pre-authorized execution plan from the kernel and carries it out.

### 2.5 Verification

**Verification** is the act of confirming that an execution produced the expected real-world outcome. It is a mandatory, distinct stage from execution for all capabilities with real-world side effects.

```
Execution:    "The payment request was dispatched."
Verification: "The payment settled in the recipient account."
```

These are different facts. The kernel must not transition an intent to COMPLETED until verification passes, or the capability class is explicitly exempt (see VERIFICATION_SPEC_v1).

### 2.6 Stewardship

**Stewardship** is the ongoing management of a persistent intent over time. A stewarded intent remains active across sessions, kernel restarts, and extended time periods (days, months, years). The Stewardship Runtime is responsible for evaluating whether world observations and policy conditions require triggering execution for a stewarded intent.

### 2.7 Learning

**Learning** is the process of analyzing historical intent outcomes to generate policy improvement suggestions. Learning never modifies policy. It produces suggestions. The user approves or rejects suggestions. Only user-approved suggestions result in policy changes.

### 2.8 Capability

A **Capability** is a named, versioned operation the kernel can perform on behalf of the user. Capabilities are registered in the capability registry. Every execution invokes exactly one capability (or a composed set). Capability identifiers follow the format `domain.verb` (e.g. `utility.bill_pay`, `transport.search`).

### 2.9 Intent Object

An **Intent Object** is the durable, kernel-managed record that represents a single intent across its full lifecycle. It is the central data structure of the kernel. All runtimes interact with intent objects according to their granted authority (see AUTHORITY_SPEC_v1 and RUNTIME_CONTRACT_v1). Its schema is defined in INTENT_OBJECT_SPEC_v1.

---

## 3. The Five Runtimes

The kernel owns five runtimes. No runtime owns another. All report to the kernel. All inter-runtime communication passes exclusively through the event bus. No runtime calls another runtime directly.

| Runtime | Verb (from LAW-5) | Primary Input | Primary Output |
|---|---|---|---|
| Observation | Observe | External world signals | `world.changed` events |
| Stewardship | Evaluate | Intent objects + world events + policy | Execution triggers |
| Execution | Execute | Pre-authorized execution plan | Execution result |
| Verification | Verify | Execution result | Verification result |
| Learning | Improve | Historical intent outcomes | Policy suggestions |

### 3.1 The Causality Chain

```
World
  └─ Observation Runtime        -> world.changed
       └─ Intent Kernel
            └─ Policy Engine    -> policy authorized?
                 └─ Stewardship Runtime
                      └─ Execution Runtime    -> execution.completed
                           └─ Verification Runtime -> verification.completed
                                └─ Intent Object updated (phase, condition, history)
                                     └─ Learning Runtime -> learning.suggestion_created
```

This chain is linear. No stage may skip a preceding stage. No stage may reach back and modify a preceding stage.

---

## 4. State Ownership

| State Domain | Owner | Authority |
|---|---|---|
| Intent lifecycle phase | Kernel | Exclusive write |
| Intent operational condition | Kernel | Exclusive write |
| Policy | User | Create, update, retire |
| Observation events | Observation Runtime | Emit only |
| Execution result | Execution Runtime | Append to intent.history |
| Verification result | Verification Runtime | Append to intent.history |
| Policy suggestions | Learning Runtime | Propose only; never write |

---

## 5. Immutability Rules

The following fields are immutable once set:

- `intent.id`
- `intent.created_at`
- `intent.user_text` (original user utterance)
- All entries in `intent.history` (append-only log)
- All emitted events (events are facts, not commands)

The following are mutable under controlled conditions only:

- `intent.lifecycle.phase` — kernel only, via legal transitions defined in LIFECYCLE_SPEC_v1
- `intent.lifecycle.condition` — kernel only
- `intent.policy` — user only, via explicit policy update; history of versions retained
- `intent.stewardship.confidence` — kernel only, updated after verification events

---

## 6. The Event Bus — Golden Rule

All inter-runtime communication passes through the event bus. No runtime calls another runtime directly.

The event bus is defined in EVENT_SPEC_v1. The canonical event vocabulary is closed. No runtime may emit events outside the defined vocabulary.

---

## 7. Versioning

Changes to this document require:

1. Version increment: MAJOR for law changes, MINOR for new definitions, PATCH for clarifications
2. Entry in CHANGELOG.md with rationale and author
3. Review of all dependent SPEC documents for conformance impact

A change to any of the Five Laws in section 0 requires MAJOR version increment and an explicit migration path for all existing intent objects.

---

## 8. References

| Spec | ID | Defines |
|---|---|---|
| INTENT_OBJECT_SPEC_v1 | CHATR-SPEC-002 | Intent Object schema, fields, migration |
| LIFECYCLE_SPEC_v1 | CHATR-SPEC-003 | Legal transitions, forbidden transitions, operational conditions |
| POLICY_SPEC_v1 | CHATR-SPEC-004 | Policy schema, declarative language, evaluation rules |
| EVENT_SPEC_v1 | CHATR-SPEC-005 | Canonical event vocabulary, envelope schema |
| OBSERVATION_SPEC_v1 | CHATR-SPEC-006 | Observation Runtime CAN/CANNOT contract |
| VERIFICATION_SPEC_v1 | CHATR-SPEC-007 | Verification contract per capability class |
| RUNTIME_CONTRACT_v1 | CHATR-SPEC-008 | Per-runtime authority, inputs, outputs |
| AUTHORITY_SPEC_v1 | CHATR-SPEC-009 | Who may authorize what; privilege matrix |
| ABI_v1 | CHATR-SPEC-010 | Runtime interface contracts for version-safe replacement |
