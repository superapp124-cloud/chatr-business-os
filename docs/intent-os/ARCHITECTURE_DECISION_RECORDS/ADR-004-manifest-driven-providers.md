# ADR-004: Why Providers are Manifest Driven

Date: 2026-07-15
Status: Accepted

## Context

Static provider routing turns each provider or domain into a runtime code change. That prevents provider onboarding at platform scale.

## Decision

Providers declare capabilities, capability contract versions, supported entities, execution modes, authentication, permissions, rate limits, latency, reliability, policies, observation, recovery, resources, audit, and trust evidence through versioned manifests.

## Consequences

Provider Intelligence selects providers from validated manifests and kernel service outputs instead of hardcoded routes.

## Migration Notes

Existing connectors must be migrated to Provider Manifest ABI v0.9 RC and fail closed when validation fails.
