# ADR 002: Intent OS Architecture

## Status
Approved

## Context
CHATR is evolving from an integration application (handling a few hardcoded MCP servers) into a globally scalable Provider Intelligence Operating System. The core challenge is abstracting providers such that CHATR can securely discover, certify, route, and execute actions across 100,000+ providers dynamically, without coupling workflows to specific provider APIs or transports.

## Decision
We will adopt the **Intent OS Architecture**, defined by the following core principles:

1. **Tri-Pillar Intelligence**: Intelligence is explicitly separated into Intent Intelligence (World Model/Decomposition), Provider Intelligence (Discovery/Certification), and Execution Intelligence (Routing/Verification/Memory).
2. **Knowledge Graphs over Flat Registries**: The system utilizes an Intent Knowledge Graph and a Provider Knowledge Graph to traverse capabilities and resources dynamically, incorporating geography, cost, trust, and policy into the graph edges.
3. **Storage Abstraction Layer**: The core kernel never couples directly to a specific database engine. All persistence routes through `IStorageAdapter`, splitting data across a Registry Store, an append-only Event Store, and a Telemetry Store.
4. **Strict Certification State Machine**: Providers enter a Candidate Queue and must traverse 14 immutable states (e.g., Security Review, Sandbox Test, Policy Review) before reaching ACTIVE production status.
5. **Universal Provider Manifest**: Providers are defined by a portable `ProviderManifestV1` contract dictating their capabilities, compliance, transport, and authentication.

## Consequences
- **Positive**: Workflows are completely agnostic to providers. We can remove or swap any provider instantly without breaking user experience.
- **Positive**: Safe ingestion of 100k+ providers via discovery isolation and rigid state transitions.
- **Negative**: High initial complexity and upfront engineering cost to build the abstract routing, ranking, and storage adapters before delivering tangible integrations.
- **Negative**: Increased latency during the resolution phase as policies, trust, and benchmarks are evaluated. This is mitigated by local caching and fast relational indexes over the graph concepts.
