# ADR-009 — NodeDefinition ABI

**Status:** Accepted
**Date:** 2026-07-17
**ABI Version:** 1.0.0
**ABI File:** `src/platform/contracts/node-definition.contract.ts`

## Context

Nodes were previously registered through a mix of decorator annotations, manual registry entries, and ad-hoc configuration objects spread across multiple files. There was no single source of truth for what a node provided, what it accepted, or what permissions it required, making it impossible to validate node graphs at build time or enforce governance policies consistently. A canonical, self-describing node contract was needed to close these gaps.

## Decision

Every node must implement the `INodeDefinition` interface and register itself through a single `register()` call, which is the only permitted registration mechanism; no other file needs to change when a new node is added. The definition includes `inputSchema` and `outputSchema` (JSON Schema objects) so the engine can validate data flowing in and out without running the node. The interface also mandates `validate()`, `execute()`, and `serialize()` methods, and requires the node to declare its `policies` and `permissions` inline as part of the definition rather than in a separate config file.

## Consequences

- Workflow graph validation can now happen entirely at publish time by checking each node's `inputSchema`/`outputSchema` against the edges connecting it, surfacing mismatches before any run is attempted.
- Governance tooling can enumerate all registered nodes and their declared permissions without executing any code, enabling static policy audits.
- The single-call `register()` pattern eliminates the "partially registered node" failure mode where a node was added to one registry but not another.
