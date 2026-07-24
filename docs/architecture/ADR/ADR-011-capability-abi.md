# ADR-011 — Capability ABI

**Status:** Accepted
**Date:** 2026-07-17
**ABI Version:** 1.0.0
**ABI File:** `src/platform/contracts/capability.contract.ts`

## Context

The platform previously had no formal concept that grouped related providers under a single abstract capability (e.g., "send-email" could be fulfilled by SendGrid, SES, or Postmark). Without this abstraction, nodes hardcoded a specific provider, tenant-level overrides were impossible without forking nodes, and there was no way to enforce a common input/output contract across providers that served the same purpose. A capability layer was needed to sit between nodes and providers.

## Decision

The `ICapability` interface defines an `inputSchema` and `outputSchema` that all registered providers for that capability must conform to; the `ProviderResolver` validates provider compliance at registration time, not at runtime. Each capability declares a `defaultProviderId` used when a tenant has no explicit override, and a `supportedProviders` array listing all valid provider IDs. The `ProviderResolver` selects among `supportedProviders` based on tenant policy at execution time.

## Consequences

- A new provider can be added to an existing capability without any node changes, as long as it satisfies the capability's `inputSchema`/`outputSchema` contract.
- Tenants gain the ability to pin, rotate, or A/B test providers for a capability through policy configuration alone.
- The schema conformance check at registration time prevents a misconfigured provider from being silently selected at runtime, turning a runtime failure into a startup-time configuration error.
