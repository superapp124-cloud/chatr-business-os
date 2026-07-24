# ADR-016 — PolicyContract ABI

**Status:** Accepted
**Date:** 2026-07-17
**ABI Version:** 1.0.0
**ABI File:** `src/platform/contracts/policy-contract.contract.ts`

## Context

Governance policies were previously enforced inconsistently: some were hardcoded checks inside specific node implementations, others were config flags read at service startup, and none were auditable as data. There was no way to add, change, or remove a policy without a code deployment, no way for compliance teams to inspect active policies without reading source code, and no uniform mechanism to route certain actions to an approval gate. A data-driven, runtime-evaluated policy engine was needed.

## Decision

The `PolicyContract` interface maps directly to the `org_policies` table and is evaluated by `IPolicyEngine.evaluate()` before every node execution. Each policy has an `enforcement` mode of `enforce` (blocks execution), `warn` (proceeds but emits a warning event), or `audit` (proceeds and logs silently). When `enforcement` is `enforce` and conditions are met, an optional `approval_required` field routes the action to a named approval group rather than blocking outright. Conditions are expressed as an array of `{ field, operator, value }` triples evaluated against the node's resolved inputs, keeping policy logic out of application code entirely.

## Consequences

- Governance policies become auditable data: compliance teams can query `org_policies` to enumerate all active policies, their enforcement modes, and their approval routing without reading source code.
- Adding, modifying, or disabling a policy is a database operation rather than a deployment, enabling incident-time policy changes in seconds.
- The field-path/operator/value condition model is expressive enough to cover common governance rules (e.g., "block any node that sends data to an external domain not on the allowlist") without requiring custom code per policy.
