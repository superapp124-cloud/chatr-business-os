# ADR-014 — AuditEvent ABI

**Status:** Accepted
**Date:** 2026-07-17
**ABI Version:** 1.0.0
**ABI File:** `src/platform/contracts/audit-event.contract.ts`

## Context

Audit logging was previously an afterthought bolted onto individual service methods, producing inconsistent log shapes, missing actor attribution on some entries, and—critically—secret values occasionally leaking into log payloads when raw context objects were serialized without scrubbing. Compliance requirements (SOC 2, GDPR) demanded an append-only audit trail with a guaranteed shape and a provable guarantee that secrets never appear in log storage. A formal audit event contract was required.

## Decision

The `AuditEvent` interface is an append-only record written exclusively through the `IAuditStore.append()` method; there is no update or delete path in the contract, and implementations must treat `append()` as infallible (it must never throw—failures are swallowed and emitted as an internal metric). The event union covers seven domains: workflow lifecycle, execution steps, approval actions, secret access, side-effect operations (file writes, outbound HTTP), policy evaluations, and AI model actions. A `scrub()` utility is applied to all payloads before `append()` is called, replacing any field matching the secrets pattern with a redacted placeholder.

## Consequences

- The append-only contract satisfies auditor requirements for tamper-evident logs; the `IAuditStore` abstraction allows the underlying store (Postgres, an external SIEM) to be swapped without touching audit-emitting code.
- The `scrub()` pre-processing step provides a single, testable choke point for secret redaction, eliminating the category of "secret leaked in audit log" incidents entirely.
- Covering AI model actions as a first-class domain means every prompt sent and response received by an AI node is logged with actor, timestamp, and token cost, enabling both cost attribution and governance review.
