# CHATR-SPEC-006 — Observation Runtime Specification

| Field          | Value                                      |
|----------------|--------------------------------------------|
| Document ID    | CHATR-SPEC-006                             |
| Status         | Active                                     |
| Version        | 1.0.0                                      |
| Depends On     | CHATR-SPEC-005 (EVENT_SPEC_v1)             |
| Part Of        | CHATR Intent OS Specification Suite v1.0.0 |
| Date           | 2026-07-16                                 |

---

## 1. Purpose

The Observation Runtime is the sole system component authorized to watch external world signals and translate them into normalized kernel events. It enforces LAW-3 on its side of the boundary: it observes and nothing else. It does not decide whether an observation is actionable. It does not notify users. It does not change intent state. It emits a single event type — `world.changed` — and the rest of the system determines what to do with it.

---

## 2. The Observation Contract

The Observation Runtime is bound by the following contract. These are not guidelines; they are machine-testable invariants. Any implementation that violates a CANNOT is non-conformant.

| Capability                                           | Permitted  |
|------------------------------------------------------|-----------|
| Watch external sources (calendar, price feeds, webhooks, documents, etc.) | **CAN**   |
| Normalize raw signals to canonical signal types      | **CAN**   |
| Timestamp observations with observed_at              | **CAN**   |
| Emit `world.changed` events on the kernel bus        | **CAN**   |
| Maintain a read-cache of recently observed raw data  | **CAN**   |
| Execute any real-world action                        | **CANNOT** |
| Make decisions about whether an observation should trigger execution | **CANNOT** |
| Notify users directly (push, SMS, email, in-app)     | **CANNOT** |
| Change the `lifecycle.phase` or `lifecycle.condition` of any intent | **CANNOT** |
| Modify any policy                                    | **CANNOT** |
| Persist data outside its own read-cache              | **CANNOT** |
| Call any other runtime directly                      | **CANNOT** |
| Emit any event type other than `world.changed`       | **CANNOT** |

**Conformance test:** A conformant Observation Runtime, given full isolation from all other system components except the event bus, produces no side effects on any intent, policy, or user state. Its only observable output is `world.changed` events on the bus.

---

## 3. `world.changed` Event Schema

Every `world.changed` event emitted by the Observation Runtime MUST have a payload that conforms to the following schema. See EVENT_SPEC_v1 §3.2 for the envelope requirements.

```json
{
  "source": "string (required, enum: calendar | price_feed | email | sms | webhook | document | location | weather)",
  "signal_type": "string (required, canonical signal type identifier, e.g. 'document_expiring', 'price_changed', 'bill_cycle_started', 'bill_received')",
  "normalized_data": "object (required, signal-type-specific normalized fields; see §3.1)",
  "observed_at": "string (required, ISO8601 UTC, when the signal was detected)",
  "confidence": "number (required, 0.0 to 1.0 inclusive, certainty of the signal interpretation)",
  "raw_source_ref": "string or null (optional, opaque reference to the source record for audit; must not contain PII)"
}
```

### 3.1 Normalized Data Schemas by Signal Type

| `signal_type`           | `normalized_data` required fields                                                     |
|-------------------------|---------------------------------------------------------------------------------------|
| `document_expiring`     | `{ document_type: string, expiry_date: ISO8601, days_remaining: integer }`           |
| `price_changed`         | `{ item_id: string, prior_price: number, new_price: number, currency: string }`      |
| `bill_cycle_started`    | `{ provider: string, account_ref: string, billing_month: "YYYY-MM" }`                |
| `bill_received`         | `{ provider: string, account_ref: string, amount: number, currency: string, due_date: ISO8601 }` |
| `webhook_status_update` | `{ provider: string, status: string, reference_id: string }`                         |
| `calendar_proximity`    | `{ event_name: string, event_date: ISO8601, days_until: integer }`                   |

The Observation Runtime MUST map every source-specific signal to one of these canonical `signal_type` values and populate the corresponding `normalized_data` fields. Source-specific field names, encodings, or formats MUST NOT appear in the `normalized_data` object.

### 3.2 Confidence

`confidence` represents the Observation Runtime's certainty that it has correctly interpreted the raw signal.

| Range         | Interpretation                                            |
|---------------|-----------------------------------------------------------|
| 0.90 – 1.00   | High confidence. Normal processing.                       |
| 0.70 – 0.89   | Moderate confidence. Emit; Stewardship Runtime may apply additional gate. |
| 0.00 – 0.69   | Low confidence. Emit with `confidence` value; Stewardship Runtime SHOULD escalate before acting. |

The Observation Runtime MUST emit all observations regardless of confidence. It does not gate its own output based on confidence. Confidence-based routing is the kernel's and Stewardship Runtime's responsibility.

---

## 4. Observation Sources

Observation sources are categorized by implementation phase. Phase 2 implementations use simulated signals for development and testing. Phase 3 implementations use real external data feeds.

| Source         | Signal Types Produced                             | Phase 2 (Simulated)                        | Phase 3 (Real)                                       |
|----------------|---------------------------------------------------|--------------------------------------------|------------------------------------------------------|
| `calendar`     | `calendar_proximity`, `document_expiring`         | Time-based simulation with configurable dates | Google Calendar API, system calendar                |
| `price_feed`   | `price_changed`                                   | Configurable price step functions          | Market data APIs, provider price APIs               |
| `document`     | `document_expiring`                               | Test document records with set expiry dates | Document stores, government portals (scraped/API)   |
| `bill_cycle`   | `bill_cycle_started`, `bill_received`             | Scheduled monthly simulation              | Email parsing, SMS parsing, provider webhooks       |
| `webhook`      | `webhook_status_update`                           | Mock webhook server                        | Provider-registered webhook endpoints               |

---

## 5. Normalization Rules

1. Every signal received from an external source MUST be normalized before a `world.changed` event is emitted.
2. Source-specific formats, field names, encodings, or units MUST NOT appear in the `normalized_data` payload.
3. The Observation Runtime MUST map amounts to the canonical currency unit (base unit, not fractional) and include the `currency` field as ISO 4217.
4. Timestamps from external sources MUST be converted to UTC ISO 8601 before being placed in any event field.
5. If the Observation Runtime cannot normalize a raw signal to a recognized `signal_type`, it MUST silently discard the signal and record the discard in its internal read-cache log. It MUST NOT emit a malformed or partially populated `world.changed` event.
6. The Observation Runtime MUST NOT merge or aggregate multiple raw signals into a single `world.changed` event. Each signal produces exactly one event.

---

## 6. What Happens After

The Observation Runtime emits a `world.changed` event and forgets it. It does not:

- Maintain state about which intents it has triggered.
- Track whether its emitted observations were acted upon.
- Re-emit a signal if no downstream action occurred.
- Wait for acknowledgement from the kernel or any runtime.

It is the kernel's responsibility to route `world.changed` events to the Stewardship Runtime for evaluation. It is the Stewardship Runtime's responsibility to determine whether the signal matches a trigger for an active stewarded intent. The Observation Runtime is stateless with respect to the outcome of its observations.

The only state the Observation Runtime maintains is its read-cache: a short-lived local buffer of recent raw signals, used to deduplicate rapid-fire signals from noisy sources (e.g., a price feed that updates every second). The read-cache is not persisted across runtime restarts.

---

## 7. Versioning

| Increment | Criteria                                                                                         |
|-----------|--------------------------------------------------------------------------------------------------|
| PATCH     | Non-normative clarifications. No change to contract, schema, or normalization rules.             |
| MINOR     | Addition of new observation sources or new `signal_type` values. Existing behavior unchanged.    |
| MAJOR     | Change to `world.changed` payload schema, removal of `signal_type` values, change to CAN/CANNOT contract. |

The current version of this document is **1.0.0**. All changes are recorded in `CHANGELOG.md`.
