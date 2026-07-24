# Architecture Overview

## The Core Principle
"No optimization, architectural change, or provider integration is considered complete until it is measurable through observability, repeatable through automated tests, and recoverable through documented operational procedures."

## The Layered Architecture

The platform has evolved from domain-specific workflows into a hardened, highly observable runtime-oriented architecture.

1. **Kernel:** Foundational platform services. Extremely strict boundaries. Completely frozen.
2. **Workflow Runtime (Pipeline Engine):** Orchestration, policies, artifact generation, DAG state machine.
3. **Execution Runtime (Task Runtime):** Concurrency, lock-free parallel scheduling, worker pools.
4. **Event Runtime:** Messaging, persistence, DLQ, replay, pub-sub.
5. **AI Runtime:** Local-first BYOAI execution, provider abstractions, memory cache.

## Extensibility Rule
Capabilities and Providers are implemented entirely using the SDK. You may **not** bypass the SDK to interact with the underlying Runtimes directly.
