# ADR-010 — Provider ABI

**Status:** Accepted
**Date:** 2026-07-17
**ABI Version:** 1.0.0
**ABI File:** `src/platform/contracts/provider.contract.ts`

## Context

Before this decision, workflow nodes contained both the graph-level behavior (routing, retry, branching) and the capability execution logic (calling an API, running a model, writing to a database) in a single class. This coupling meant that swapping one email provider for another required changing node code rather than a configuration entry, and that secret handling was inconsistently spread across node implementations. A clear separation between graph behavior and capability execution was needed.

## Decision

A node references a capability by `capabilityId` only and never imports or instantiates a provider directly. The `ProviderResolver` service reads the node's `capabilityId` and the tenant's provider policy to select and instantiate the correct `IProvider` at runtime. Every provider must implement `execute()`, `testConnection()`, and `classifyError()` methods; secrets are accessed exclusively through `ExecutionContext.secrets` and are never passed as constructor arguments or method parameters.

## Consequences

- Swapping a provider (e.g., replacing SendGrid with AWS SES for email) requires a tenant-level policy change only; no node code is touched.
- The `classifyError()` method gives the engine a standard way to distinguish retriable errors from terminal failures without special-casing individual providers.
- Secrets centralized in `ExecutionContext.secrets` means provider implementations are never allowed to hold credentials in memory beyond a single `execute()` call, narrowing the blast radius of a compromised provider module.
