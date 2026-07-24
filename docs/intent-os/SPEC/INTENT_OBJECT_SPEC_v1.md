# CHATR-SPEC-002 — Intent Object Specification

| Field          | Value                                      |
|----------------|--------------------------------------------|
| Document ID    | CHATR-SPEC-002                             |
| Status         | Active                                     |
| Version        | 1.0.0                                      |
| Depends On     | CHATR-SPEC-003 (LIFECYCLE_SPEC_v1), CHATR-SPEC-004 (POLICY_SPEC_v1) |
| Part Of        | CHATR Intent OS Specification Suite v1.0.0 |
| Date           | 2026-07-16                                 |

---

## 1. Purpose

The Intent Object is the sole unit of state managed by the CHATR Intent Kernel (LAW-1). This document defines the canonical schema, field ownership, persistence rules, serialization format, and versioning contract for every Intent Object in the system.

---

## 2. Required Fields

Every Intent Object persisted by the kernel MUST contain all fields defined in this section. Absence of any required field is a schema violation; the kernel MUST reject the object.

| Field         | Type      | Constraints                                                                                  | Description                                                                                 |
|---------------|-----------|----------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| `id`          | `string`  | UUID v4; set once at creation; immutable thereafter                                          | Globally unique identifier for this intent. No two intents may share an `id`.               |
| `version`     | `string`  | Semver `MAJOR.MINOR.PATCH`; references the spec version this object was created under        | Spec conformance version. Used by the kernel to select the correct migration function.      |
| `user_text`   | `string`  | Non-empty; set once at creation; immutable thereafter; UTF-8                                 | Verbatim original utterance from the user. Must not be normalized, corrected, or truncated. |
| `capability`  | `string`  | Format: `domain.verb` (e.g., `utility.bill_pay`, `travel.book_flight`); lowercase, dot-delimited | Canonical capability identifier. Must resolve to a registered capability in the kernel registry. |
| `lifecycle`   | `object`  | Conforms to CHATR-SPEC-003; `phase` and `condition` are always present                      | Current lifecycle state of the intent. See §4 and LIFECYCLE_SPEC_v1.                       |
| `policy`      | `object`  | Conforms to CHATR-SPEC-004; must reference a valid, non-retired policy                       | Policy governing this intent's execution. Evaluated before any execution action.           |
| `stewardship` | `object`  | Present if and only if `lifecycle.phase = STEWARDED`; absent otherwise                       | Stewardship metadata: schedules, triggers, next-run time. Schema defined in RUNTIME_CONTRACT_v1. |
| `history`     | `array`   | Append-only; each entry is an `event_id` reference (UUID string); no deletions permitted     | Ordered log of all events that have mutated this intent. Oldest first.                      |
| `created_at`  | `string`  | ISO 8601 UTC; set once at creation; immutable thereafter                                     | Timestamp of intent creation.                                                               |
| `updated_at`  | `string`  | ISO 8601 UTC; updated on every mutation                                                      | Timestamp of the most recent mutation to this intent object.                                |

---

## 3. Optional Fields

Optional fields MUST be `null` when not yet populated. A field that is absent and a field that is `null` are treated identically by the kernel.

| Field                 | Type     | Initial Value | Description                                                                                   |
|-----------------------|----------|---------------|-----------------------------------------------------------------------------------------------|
| `execution_result`    | `object` | `null`        | Populated by the Execution Runtime after first execution completes. Schema defined in ABI_v1 §3. |
| `verification_result` | `object` | `null`        | Populated by the Verification Runtime after first verification completes. Schema defined in VERIFICATION_SPEC_v1 §3. |
| `plan`                | `object` | `null`        | Populated by the Planner during the `PLANNED` phase. Contains `intent`, `constraints`, and `stewardship_hint`. Schema defined in ABI_v1 §7. |
| `tags`                | `array`  | `null`        | Array of non-empty UTF-8 strings. Used for grouping and filtering. No semantic meaning to the kernel. |

---

## 4. Lifecycle

The `lifecycle` field is an embedded object that conforms entirely to CHATR-SPEC-003 (LIFECYCLE_SPEC_v1). The following invariants hold at all times:

- `lifecycle.phase` is always present and is one of the values defined in LIFECYCLE_SPEC_v1 §2.
- `lifecycle.condition` is always present. It is `null` if and only if `lifecycle.phase = ARCHIVED`.
- The kernel's lifecycle guard enforces all legal and forbidden transitions defined in LIFECYCLE_SPEC_v1 §3 and §4.

---

## 5. Persistence Rules

1. Every Intent Object MUST survive a kernel restart without data loss.
2. Intent Objects are stored in the `stewarded_intents` table in the kernel's primary data store.
3. The kernel MUST write `updated_at` atomically with every mutation. A mutation that succeeds without updating `updated_at` is a persistence violation.
4. The `history` array is append-only at the storage layer. Storage engines that support soft-delete MUST NOT soft-delete history entries.
5. Intent Objects in the `ARCHIVED` phase remain in the `stewarded_intents` table and are read-only. They are never physically deleted by the kernel.
6. A kernel restart MUST trigger `StewardshipRuntime.restore()` for all intents where `lifecycle.phase = STEWARDED`, as defined in ABI_v1 §5.

---

## 6. Serialization

1. All Intent Objects MUST be serialized as JSON.
2. Encoding MUST be UTF-8.
3. Binary fields are forbidden. Any binary content (e.g., document bytes) MUST be stored externally and referenced by URI.
4. JSON keys MUST use `snake_case`.
5. Timestamps MUST be ISO 8601 strings in UTC, formatted as `YYYY-MM-DDTHH:mm:ss.sssZ`.
6. `null` values MUST be serialized as JSON `null`, not omitted.

**Canonical Serialization Example:**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "version": "1.0.0",
  "user_text": "Pay my electricity bill automatically every month",
  "capability": "utility.bill_pay",
  "lifecycle": {
    "phase": "STEWARDED",
    "condition": "HEALTHY"
  },
  "policy": {
    "version": "1.0.0",
    "owner": "user_001",
    "applies_to": "utility.bill_pay"
  },
  "stewardship": {
    "next_trigger_at": "2026-08-01T00:00:00.000Z",
    "trigger_type": "bill_cycle",
    "trigger_count": 3
  },
  "history": [
    "evt-uuid-0001",
    "evt-uuid-0002",
    "evt-uuid-0003"
  ],
  "created_at": "2026-07-01T10:00:00.000Z",
  "updated_at": "2026-07-16T10:00:00.000Z",
  "execution_result": null,
  "verification_result": null,
  "plan": null,
  "tags": ["bills", "auto-pay"]
}
```

---

## 7. Migration

1. When the spec version increments, existing Intent Objects retain their original `version` value at creation.
2. The kernel selects the migration function `migrate_<from>_to_<to>(object)` based on the object's `version` vs. the current spec version.
3. Migration functions are additive by default for MINOR version increments (new optional fields are added with `null` defaults).
4. MAJOR version increments may require destructive migration. Each MAJOR version increment MUST document its migration function in the changelog.
5. Migration is applied lazily on read or eagerly at boot — the kernel implementation chooses — but migrated objects MUST be re-persisted with updated `version` field.
6. An object whose `version` has no registered migration path MUST be rejected with error `MIGRATION_PATH_NOT_FOUND`.

---

## 8. Ownership

Write authority over each field is assigned exclusively. Unauthorized writes MUST be rejected by the kernel with `AUTHORITY_VIOLATION`.

| Field                 | Write Authority         | Notes                                                       |
|-----------------------|-------------------------|-------------------------------------------------------------|
| `id`                  | Kernel only             | Set at creation. Immutable after creation.                  |
| `version`             | Kernel only             | Set at creation. Updated only by migration functions.       |
| `user_text`           | Kernel only             | Written once from user input. Immutable after creation.     |
| `capability`          | Kernel only             | Resolved by Planner. Immutable after creation.              |
| `lifecycle`           | Kernel only             | All lifecycle transitions are gated by the lifecycle guard. |
| `policy`              | User only               | No runtime may write this field. Proposals are subject to user approval. |
| `stewardship`         | Stewardship Runtime     | Written when phase transitions to STEWARDED.                |
| `history`             | Kernel only             | Append-only. Only the kernel appends event references.      |
| `created_at`          | Kernel only             | Set at creation. Immutable.                                 |
| `updated_at`          | Kernel only             | Updated on every mutation by the kernel.                    |
| `execution_result`    | Execution Runtime       | Written upon execution completion via kernel bus.           |
| `verification_result` | Verification Runtime    | Written upon verification completion via kernel bus.        |
| `plan`                | Kernel (Planner)        | Written by the Planner component during PLANNED phase.      |
| `tags`                | User only               | No semantic enforcement by the kernel.                      |

---

## 9. Versioning

This document is versioned under the CHATR Specification versioning scheme:

- **PATCH** increment: non-normative clarifications, typo corrections, example updates. No schema change.
- **MINOR** increment: addition of new optional fields. Backward-compatible. Existing objects remain valid.
- **MAJOR** increment: removal of required fields, change of field types, rename of fields, or change to ownership rules. Requires a migration function and a CHANGELOG entry.

The current version of this document is **1.0.0**. All changes are recorded in `CHANGELOG.md`.
