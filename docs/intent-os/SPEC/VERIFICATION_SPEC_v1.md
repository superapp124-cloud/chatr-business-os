# CHATR-SPEC-007 — Verification Specification

| Field          | Value                                      |
|----------------|--------------------------------------------|
| Document ID    | CHATR-SPEC-007                             |
| Status         | Active                                     |
| Version        | 1.0.0                                      |
| Depends On     | CHATR-SPEC-003 (LIFECYCLE_SPEC_v1), CHATR-SPEC-005 (EVENT_SPEC_v1) |
| Part Of        | CHATR Intent OS Specification Suite v1.0.0 |
| Date           | 2026-07-16                                 |

---

## 1. Purpose

Verification is the confirmation that execution produced the expected real-world outcome. It is a distinct phase from execution and a distinct fact from execution completion. The kernel MUST NOT treat an intent as `COMPLETED` until verification passes or the capability class is explicitly exempt from this requirement (see §4). This document defines the verification contract, the result schema, the capability class requirements, and the failure handling protocol. LAW-4 is the root axiom; every rule in this document is a derivation of it.

---

## 2. Verification vs. Execution

These are two distinct, non-interchangeable facts:

| Fact | Definition | Example |
|------|-----------|---------|
| **Execution Fact** | The execution action was dispatched. The kernel's request to the external system completed without a transport error. | "The UPI payment request was sent and the provider returned HTTP 200." |
| **Verification Fact** | The expected real-world outcome was achieved and is confirmed by an authoritative post-hoc check. | "The payment settled in the recipient's account, confirmed by querying the provider's transaction status endpoint." |

These facts are different. The kernel MUST hold them separately. An intent in the `VERIFYING` phase has established the Execution Fact. It has NOT yet established the Verification Fact. The transition from `VERIFYING` to `COMPLETED` establishes the Verification Fact.

**Rule:** The lifecycle guard MUST enforce that `EXECUTING → COMPLETED` is a forbidden transition. See LIFECYCLE_SPEC_v1 §4. Any system that conflates execution completion with outcome verification is non-conformant with LAW-4.

---

## 3. Verification Result Schema

The `verification_result` field of an Intent Object (INTENT_OBJECT_SPEC_v1 §3) MUST conform to the following schema when populated.

```json
{
  "verified": "boolean (required; true = outcome confirmed; false = outcome not confirmed or ambiguous)",
  "method": "string (required; enum: re_query | webhook | poll | receipt_check | manual)",
  "verified_at": "string (ISO8601 UTC, required when verified=true; null when verified=false)",
  "evidence": "object (required; method-specific evidence fields; see §3.1)",
  "attempts": "integer (required; number of verification attempts made, min 1)",
  "failure_reason": "string or null (required when verified=false; null when verified=true)"
}
```

### 3.1 Evidence Schemas by Method

| `method`         | `evidence` required fields                                                                   |
|------------------|----------------------------------------------------------------------------------------------|
| `re_query`       | `{ provider: string, transaction_id: string, status: string, queried_at: ISO8601 }`         |
| `webhook`        | `{ webhook_source: string, event_type: string, received_at: ISO8601, reference_id: string }` |
| `poll`           | `{ provider: string, poll_count: integer, last_polled_at: ISO8601, final_status: string }`  |
| `receipt_check`  | `{ receipt_id: string, receipt_source: string, amount_confirmed: number, currency: string }` |
| `manual`         | `{ confirmed_by: "user", confirmed_at: ISO8601, note: string or null }`                      |

---

## 4. Capability Class Verification Requirements

Every capability class is assigned a verification requirement. Runtimes MUST NOT skip verification for required classes.

| Capability Class       | Verification Required | Method(s)                             | Timing / Constraints                                             |
|------------------------|-----------------------|---------------------------------------|------------------------------------------------------------------|
| `financial_payment`    | **Required**          | `receipt_check` or `re_query`         | Must begin within 30 seconds of `execution.completed`.           |
| `travel_booking`       | **Required**          | `re_query`                            | Must begin 60 seconds after `execution.completed` to allow settlement. |
| `document_renewal`     | **Required**          | `poll`                                | Poll interval: 24 hours. Maximum polling window: 30 calendar days. |
| `food_order`           | **Required**          | `webhook` or `poll`                   | Must begin within 2 minutes of `execution.completed`.            |
| `government_service`   | **Required**          | `poll`                                | Poll interval: 24 hours. Maximum polling window: 90 calendar days. |
| `information_query`    | **Exempt**            | N/A                                   | No real-world side effect. Verification phase is skipped; intent transitions directly from `EXECUTING` to `COMPLETED` after execution completion. |
| `local_execution`      | **Exempt**            | N/A                                   | Kernel-internal operation with no external state mutation. Verification phase is skipped. |

**Exempt class behavior:** For exempt capability classes, the Kernel transitions the intent directly from `EXECUTING` to `COMPLETED` upon `execution.completed`. The `verification_result` field remains `null`. This is the only case in which `verification_result = null` on a `COMPLETED` intent is valid.

---

## 5. Verification Failure Handling

When a verification attempt fails (i.e., `verification.failed` is emitted), the following sequence MUST execute in order:

1. **Emit `verification.failed`** with payload `{ method, attempt, failure_reason }`.
2. **Evaluate retry authorization:** Query the intent's policy `retry.max_attempts`. If `attempts < max_attempts`:
   a. Set intent `lifecycle.condition = RETRYING` with updated `count`.
   b. Emit `intent.condition_changed`.
   c. Re-invoke the Verification Runtime after the backoff interval specified in `policy.retry.backoff`.
3. **If max retries exceeded:**
   a. Set intent `lifecycle.condition = ESCALATED` with `reason = "verification_max_retries_exceeded"`.
   b. Emit `intent.condition_changed`.
   c. Emit `stewardship.escalated` with the intent ID and escalation reason.
4. **User resolution required.** The user MUST choose one of:
   - **Retry:** Authorizes one additional verification attempt. Resets retry count.
   - **Archive:** Transitions intent to `ARCHIVED` via `VERIFYING → ARCHIVED` (legal per LIFECYCLE_SPEC_v1 §3).
   - **Accept Unverified:** User explicitly marks the intent as completed without verification evidence. This action MUST be recorded in the intent's `history` with event type `intent.completed` and a `manual_override: true` flag in the payload.

**Rule:** No runtime may automatically accept an unverified intent as completed. That decision belongs exclusively to the user (LAW-2).

---

## 6. Verification Timing

| Capability Class     | Verification Must Begin                              | Maximum Total Duration                             |
|----------------------|------------------------------------------------------|----------------------------------------------------|
| `financial_payment`  | Within 30 seconds of `execution.completed`           | No explicit maximum; must complete or escalate.    |
| `travel_booking`     | 60 seconds after `execution.completed`               | No explicit maximum; must complete or escalate.    |
| `document_renewal`   | Within 24 hours of `execution.completed`             | 30 calendar days from first poll.                  |
| `food_order`         | Within 2 minutes of `execution.completed`            | No explicit maximum; must complete or escalate.    |
| `government_service` | Within 24 hours of `execution.completed`             | 90 calendar days from first poll.                  |

**Rule:** If verification has not begun within the required window after `execution.completed`, the kernel MUST set intent condition to `ESCALATED` and emit `stewardship.escalated`. A verification that was never initiated is treated as a verification failure.

**Synchronous vs. Asynchronous:** For synchronous capabilities (financial_payment, travel_booking, food_order), verification begins immediately after execution. For asynchronous capabilities (document_renewal, government_service), verification begins with a polling schedule. The first poll is the start of verification; subsequent polls continue until a definitive result or the maximum window is exceeded.

---

## 7. Versioning

| Increment | Criteria                                                                                          |
|-----------|---------------------------------------------------------------------------------------------------|
| PATCH     | Non-normative clarifications. No change to schema, timing requirements, or failure protocol.      |
| MINOR     | Addition of new capability classes or new verification methods. Existing classes unchanged.        |
| MAJOR     | Change to `VerificationResult` schema, change to required/exempt classification, change to timing requirements, change to failure handling sequence. |

The current version of this document is **1.0.0**. All changes are recorded in `CHANGELOG.md`.
