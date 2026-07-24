# ADR-008: Why Trust is Computed by the Kernel

Date: 2026-07-15
Status: Accepted

## Context

Not every provider, adapter, execution mode, or agent should be trusted equally. A provider manifest can offer evidence, but it cannot assign its own trust level.

## Decision

Trust is computed by the kernel Trust Service from evidence such as manifest signature, provenance, telemetry, audit history, policy compliance, permission scope, user preference, organization approval, and recovery behavior.

## Consequences

Trust affects policy, approval, provider selection, execution permission, and recovery. Provider Intelligence consumes `TrustAssessment`; it does not compute trust internally.

## Migration Notes

Provider manifests may include trust evidence fields. Kernel bootstrap and runtime services must compute trust assessments before consequential execution.
