# ADR-006: Why Verification Gates Completion

Date: 2026-07-15
Status: Accepted

## Context

Provider execution success does not prove that a real-world user goal is complete. Providers may return success before fulfillment, later reject an action, or disagree with observed world state.

## Decision

Execution never implies completion. Verification gates completion.

## Consequences

The kernel marks goals complete only after verification rules pass. Failed verification triggers reconciliation, recovery, suspension, human assist, or blocked state according to policy.

## Migration Notes

Existing success paths must emit receipts and observations, then wait for verification where required.
