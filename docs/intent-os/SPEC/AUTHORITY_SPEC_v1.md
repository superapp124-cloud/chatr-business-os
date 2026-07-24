# AUTHORITY_SPEC_v1

**Document ID**: CHATR-SPEC-009
**Status**: Active
**Version**: 1.0.0
**Supersedes**: None

---

## 1. Purpose

This document defines the Authority Matrix for the CHATR Intent OS. It specifies exactly which principals (actors) are permitted to perform which actions across the kernel. Its primary purpose is to prevent privilege creep. If a runtime attempts an action not explicitly authorized here, the kernel must reject it.

---

## 2. Principals

The following are the recognized principals within the CHATR Intent OS:

- **User**: The human being who owns the intents and policies. The ultimate authority.
- **Kernel**: The core OS layer that manages intent objects, enforces policy, and orchestrates runtimes.
- **Observation Runtime**: The runtime that passively monitors external signals.
- **Stewardship Runtime**: The runtime that manages persistent intents and evaluates policy.
- **Execution Runtime**: The runtime that interacts with external capabilities.
- **Verification Runtime**: The runtime that confirms execution outcomes.
- **Learning Runtime**: The runtime that analyzes history to suggest policy improvements.

---

## 3. Authority Matrix

| Action \ Principal | User | Kernel | Observation | Stewardship | Execution | Verification | Learning |
|---|---|---|---|---|---|---|---|
| **Policy Management** | | | | | | | |
| Create Policy | YES | NO | NO | NO | NO | NO | NO |
| Update Policy | YES | NO | NO | NO | NO | NO | NO |
| Retire Policy | YES | NO | NO | NO | NO | NO | NO |
| Propose Policy Change | NO | NO | NO | NO | NO | NO | YES |
| Approve Policy Change | YES | NO | NO | NO | NO | NO | NO |
| **Intent Management** | | | | | | | |
| Create Intent | YES | NO | NO | NO | NO | NO | NO |
| Transition Lifecycle Phase | NO | YES | NO | NO | NO | NO | NO |
| Update Condition | NO | YES | NO | NO | NO | NO | NO |
| Archive Intent | YES | YES | NO | NO | NO | NO | NO |
| Retire Stewardship | YES | YES | NO | NO | NO | NO | NO |
| Persist Intent State | NO | YES | NO | NO | NO | NO | NO |
| **Event Emission** | | | | | | | |
| Emit `world.changed` | NO | NO | YES | NO | NO | NO | NO |
| Emit `stewardship.*` | NO | NO | NO | YES | NO | NO | NO |
| Emit `execution.*` | NO | NO | NO | NO | YES | NO | NO |
| Emit `verification.*` | NO | NO | NO | NO | NO | YES | NO |
| Emit `learning.*` | NO | NO | NO | NO | NO | NO | YES |
| Emit `kernel.*` | NO | YES | NO | NO | NO | NO | NO |
| **Operations** | | | | | | | |
| Execute Capability | NO | NO | NO | NO | YES | NO | NO |
| Override Execution | YES | NO | NO | NO | NO | NO | NO |
| Verify Execution | NO | NO | NO | NO | NO | YES | NO |

---

## 4. Privilege Escalation

No runtime may escalate its own authority.

A runtime that attempts to perform an action outside of its authorized matrix (e.g., the Observation Runtime attempting to transition an intent's lifecycle phase, or the Execution Runtime attempting to emit a `verification.completed` event) must be rejected by the kernel.

The kernel must throw an `AUTHORITY_VIOLATION` error and log the attempt. Runtimes that repeatedly trigger `AUTHORITY_VIOLATION` errors should be considered compromised or defective.

---

## 5. Delegation Rules

The User is the ultimate authority over policy. However, the User MAY delegate specific, scoped policy decisions to the Kernel via explicit policy configuration.

For example, a user may configure a policy: `Auto-approve transactions below ₹5000`. In this case, the User has delegated the approval authority for that specific scope to the Kernel (specifically, the Stewardship Runtime evaluating the policy).

This delegation must always be:
1. **Explicit**: The user must actively enable the policy rule.
2. **Scoped**: The delegation applies only within the bounds of the rule (e.g., < ₹5000).
3. **Revocable**: The user may update or retire the policy at any time, immediately revoking the delegated authority.

---

## 6. The Learning Boundary

The boundary around the Learning Runtime is strict and non-negotiable.

The Learning Runtime **CAN**:
- Observe the history of intent objects and executions.
- Produce suggestions for policy improvements (`learning.suggestion_created`).

The Learning Runtime **CANNOT**:
- Modify policy.
- Change intent state.
- Approve its own suggestions.
- Emit any event other than `learning.suggestion_created` (and related internal learning events).

This ensures that the OS never unilaterally alters the rules governing its behavior without explicit User consent.

---

## 7. Versioning

Changes to the Authority Matrix require a MAJOR version increment of this document, as they fundamentally alter the trust model of the OS.
