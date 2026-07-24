# CHATR-SPEC-004 — Policy Specification

| Field          | Value                                      |
|----------------|--------------------------------------------|
| Document ID    | CHATR-SPEC-004                             |
| Status         | Active                                     |
| Version        | 1.0.0                                      |
| Depends On     | CHATR-SPEC-002 (INTENT_OBJECT_SPEC_v1)     |
| Part Of        | CHATR Intent OS Specification Suite v1.0.0 |
| Date           | 2026-07-16                                 |

---

## 1. Purpose

This document defines the schema, language, evaluation rules, and authority constraints for the Policy object. Policy is the user's formal expression of intent governing how, when, under what conditions, and with what limits the kernel may act on their behalf.

---

## 2. Policy Position in the Hierarchy

**Policy precedes Intent.** The kernel's authorization hierarchy is:

```
Policy → Intent → Execution
```

The Execution Runtime MUST query applicable policy BEFORE initiating any action. Querying policy during execution or after a result is produced is a contract violation. The Policy Engine evaluates the policy at the moment the intent transitions from `PLANNED` to `EXECUTING`. Any intent that reaches the `EXECUTING` phase without a policy evaluation record is in an invalid state.

---

## 3. Policy Schema

A Policy object MUST conform to the following schema. All fields marked required MUST be present; absent required fields MUST cause the kernel to reject the policy with `POLICY_SCHEMA_VIOLATION`.

```json
{
  "version": "string (semver, required)",
  "created_at": "ISO8601 UTC (required, immutable)",
  "updated_at": "ISO8601 UTC (required)",
  "owner": "string (user_id, required)",
  "applies_to": "string (capability pattern, required)",
  "triggers": ["array of trigger objects (required, min length 1)"],
  "budget": {
    "auto_approve_below": "number (currency units, required)",
    "escalate_above": "number (currency units, required)",
    "currency": "string (ISO 4217 currency code, required)",
    "never_use_methods": ["array of string (payment method identifiers)"]
  },
  "auth": {
    "biometric_above_amount": "number (currency units)",
    "require_pin_above_amount": "number (currency units)"
  },
  "alerts": {
    "notify_days_before": "integer (days before event to notify user)",
    "channel": "string (e.g. 'push', 'sms', 'email')"
  },
  "retry": {
    "max_attempts": "integer (required, min 0)",
    "backoff": "string (enum: 'linear' | 'exponential' | 'fixed')"
  },
  "on_failure": "string (enum: 'escalate_user' | 'archive' | 'retry', required)",
  "channel_preference": {
    "prefer": ["array of string (preferred channel identifiers)"],
    "never": ["array of string (forbidden channel identifiers)"]
  }
}
```

### Field Constraints

| Field                       | Constraint                                                                                           |
|-----------------------------|------------------------------------------------------------------------------------------------------|
| `version`                   | Must be a valid semver string. Must match the policy version, not the spec version.                  |
| `applies_to`                | May use glob-style wildcard: `utility.*` matches all utility capabilities. Must resolve to at least one registered capability. |
| `budget.auto_approve_below` | Must be `>= 0`. Execution at or below this amount proceeds without user confirmation.                |
| `budget.escalate_above`     | Must be `> auto_approve_below`. Execution above this amount requires explicit user approval.         |
| `budget.currency`           | Must be a valid ISO 4217 three-letter currency code.                                                 |
| `auth.biometric_above_amount` | Optional. If set, biometric confirmation required for amounts above this value.                    |
| `auth.require_pin_above_amount` | Optional. If set, PIN required for amounts above this value. Must not conflict with biometric. |
| `retry.max_attempts`        | `0` means no retry. Maximum value: `10`.                                                             |
| `on_failure`                | If `retry` and `max_attempts > 0`, `on_failure` applies after retries are exhausted.                |
| `channel_preference.never`  | A channel appearing in `never` MUST NOT be used even if it is the only available channel. If all channels are in `never`, escalate to user. |

---

## 4. Trigger Types

A trigger object defines the condition under which a stewarded intent should be re-activated. Every trigger object MUST have a `type` field. The kernel's Stewardship Runtime evaluates triggers and emits `stewardship.triggered` when the condition is met.

### 4.1 Calendar Trigger

```json
{
  "type": "calendar",
  "days_before_expiry": 7
}
```

Fires `days_before_expiry` days before a known expiry date associated with the intent's subject (e.g., a passport, an insurance policy). The expiry date is sourced from the intent's `plan.constraints` or observation signals.

### 4.2 Price Threshold Trigger

```json
{
  "type": "price",
  "direction": "above",
  "amount": 1500.00
}
```

`direction` is `"above"` or `"below"`. Fires when the observed price of the capability's target crosses the threshold in the specified direction. Observation Runtime provides the `world.changed` event; Stewardship Runtime evaluates it against this trigger.

### 4.3 Bill Cycle Trigger

```json
{
  "type": "bill_cycle",
  "day_of_month": 5
}
```

Fires on the specified day of each calendar month. If the day does not exist in a given month (e.g., day 31 in February), the trigger fires on the last day of that month.

### 4.4 Document Expiry Trigger

```json
{
  "type": "document_expiry",
  "days_before": 90
}
```

Fires when a tracked document (passport, license, certificate) is `days_before` days from its expiry date. Observation Runtime detects the signal; Stewardship Runtime evaluates against this trigger.

### 4.5 Manual Trigger

```json
{
  "type": "manual"
}
```

The intent fires only on explicit user action. No automatic trigger evaluation is performed. This trigger type is valid only for STEWARDED intents where user confirmation is always required before execution.

---

## 5. Policy Language

The Policy Language is a declarative, human-readable representation of a policy object for display and user editing interfaces. It is NOT executed by the kernel. The kernel operates exclusively on the JSON schema defined in §3. The Policy Language MUST be compiled to the JSON schema before any policy evaluation occurs.

```
WHEN <trigger>
IF <condition>
THEN <action>
USING <channel>
NOTIFY <timing>
VERIFY <verification_class>
ELSE <fallback>
```

**Clause definitions:**

| Clause   | Type        | Description                                                                    |
|----------|-------------|--------------------------------------------------------------------------------|
| `WHEN`   | Required    | The trigger condition (see §4). References a trigger type.                     |
| `IF`     | Optional    | Additional condition that must be true for the action to proceed.              |
| `THEN`   | Required    | The action to execute. Must map to a registered capability.                    |
| `USING`  | Optional    | Channel preference override for this specific execution.                       |
| `NOTIFY` | Optional    | When to notify the user (e.g., `before 3 days`, `on_completion`).              |
| `VERIFY` | Required    | Verification class to apply (maps to VERIFICATION_SPEC_v1 §4).                |
| `ELSE`   | Required    | Fallback action if the THEN action fails after retries.                        |

**Example — Electricity Bill Auto-Pay:**

```
WHEN bill_cycle(day_of_month: 1)
IF amount < 5000 INR
THEN utility.bill_pay(provider: "BESCOM", account: "ACC-001")
USING channel("UPI")
NOTIFY before 3 days
VERIFY financial_payment
ELSE escalate_user
```

This policy compiles to a JSON object where `triggers[0].type = "bill_cycle"`, `budget.auto_approve_below = 5000`, `budget.currency = "INR"`, `channel_preference.prefer = ["UPI"]`, `alerts.notify_days_before = 3`, and `on_failure = "escalate_user"`.

---

## 6. Policy Evaluation

The Policy Engine evaluates applicable policies in the following order when multiple policies could apply to an intent:

1. **Specificity:** A policy with a more specific `applies_to` pattern takes precedence over a more general one. `utility.bill_pay` beats `utility.*`.
2. **Recency:** For policies of equal specificity, the policy with the later `created_at` timestamp takes precedence.
3. **Single Winner:** Only one policy governs a given execution. The Policy Engine selects the winning policy and records its `version` in the `policy.evaluated` event payload.
4. **No-policy case:** If no applicable policy exists for a capability, the kernel MUST escalate to the user before any execution. The escalation must be recorded as `intent.condition_changed` with `condition = ESCALATED`.
5. **Conflict:** If two policies of equal specificity and identical `created_at` exist, the Policy Engine MUST reject both and raise `POLICY_CONFLICT`, requiring user resolution before execution.

---

## 7. Policy Authority

1. Only the User may create, update, or retire a policy. This is a hard constraint; see AUTHORITY_SPEC_v1 §3.
2. The Learning Runtime MAY produce a `learning.suggestion_created` event that contains a proposed policy change. This proposal is surfaced to the user. The Learning Runtime MUST NOT write to the policy store.
3. A user approving a Learning Runtime suggestion results in the User — not the Learning Runtime — being recorded as the policy author.
4. The Kernel MAY reject a proposed policy that violates schema constraints (§3) or that creates an unresolvable conflict (§6 rule 5). Rejection MUST emit `policy.violated` with the reason.

---

## 8. Policy Immutability

1. A policy update does not overwrite the existing policy record. It creates a new policy version.
2. The previous policy version MUST be retained in the policy history store indefinitely.
3. Retired policies (transitioned via `policy.retired`) are read-only. They may not be re-activated.
4. Each policy version is identified by the combination of `owner + applies_to + version`.
5. The policy history forms an append-only audit log. No entry may be deleted.

---

## 9. Versioning

| Increment | Criteria                                                                                              |
|-----------|-------------------------------------------------------------------------------------------------------|
| PATCH     | Non-normative clarifications. No change to schema, trigger types, or evaluation rules.                |
| MINOR     | Addition of new optional policy fields or new trigger types. Backward-compatible with existing policies. |
| MAJOR     | Removal or rename of required fields, change to evaluation precedence rules, change to authority rules. |

The current version of this document is **1.0.0**. All changes are recorded in `CHANGELOG.md`.
