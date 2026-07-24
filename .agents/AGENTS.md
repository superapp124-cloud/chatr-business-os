# CHATR OS Architecture v1.0 - FREEZE

**Effective Date:** July 10, 2026

By executive order, the core architectural layers of the CHATR Intent OS are officially **FROZEN** at v1.0.

## Frozen Components (Kernel ABI v1.0)
Do NOT make breaking architectural changes or introduce new core abstractions to the following layers without a formal architecture review and explicit user approval:
1. **Intent Runtime** (Timeline, History, Replay)
2. **Workflow Runtime** (Decides how to accomplish it)
3. **Execution Layer / RuntimeManager** (Capability Discovery, Inspect, Health)
4. **Session Runtime** (Context Restoration)
5. **Provider SDK / Widget SDK**
6. **Kernel Event Bus**
7. **Capability Manifests & Workspace Manifests** (Strict JSON schemas defining plugin behavior and declarative workspaces)

## Development Focus
From this point forward, AI agents working on this repository MUST shift focus from infrastructure design to **production engineering and vertical slices**.
*   **Build capabilities, not infrastructure.** Reuse existing patterns.
*   If a new capability (e.g. Food Delivery, Flights, Hotel Booking) requires infrastructure, **first** ask whether an existing widget or execution pattern can be extended.
*   **Do not** add more layers preemptively. Let production experience drive the next architectural evolution.
*   Focus on performance, reliability, and expanding the provider ecosystem.

7. **CHATR Kernel v1.0 Storage Layer** (Storage Engine, Repository Layer, Sync Scheduler, Data Normalizer, Knowledge Graph, Vector Memory, Timeline Engine)

## Phase 5 Execution Substrate (FROZEN)
As of July 13, 2026, the Phase 5 Execution Substrate is **FROZEN**.
Do NOT introduce new abstractions or modify the architecture without explicit user approval. 
All agents must adhere to the following Phase 5 subsystems:
1. **System Context Engine:** Resolves Location, Time, Battery, Apps, Network, etc. *before* the Planner.
2. **Intent Lifecycle Manager:** Tracks Intents using a unique `intentId` (Received -> Executing -> Archived).
3. **Dynamic Discovery Engine:** Ranks connectors via reputation (success rate, latency, freshness).
4. **Declarative Connector Manifests:** Generic Executors (Browser, API, Local, MCP) parsing declarative JSON manifests with rich metadata (`permissions`, `selectors`, `authentication`).
5. **Workflow Engine & Decision Engine:** Evaluates Constraints + Intent. Supports Parallel, Conditional, Retries, Loops.
6. **Execution Ledger:** Immutable record of all execution data (Duration, Cost, Permissions, Files, Money Spent).
7. **Capability-Based Policy Engine:** Configurable Risk-Based Approvals (Silent vs Confirm).
8. **Knowledge Graph:** Tracks relationships (User -> Projects -> Capabilities -> Connectors -> Documents -> People).
9. **AI Rule:** AI Never Directly Executes. LLM outputs `Intent` + `Constraints`. Workflow Engine builds DAG.

## CHATR Platform v0.9 RC — Kernel Freeze (Effective July 16, 2026)

**Platform Milestone P1 is COMPLETE.** The following ABIs are frozen. Any change requires ADR + TSC approval. See docs/adr/ADR-001-kernel-abi-freeze.md.

### Frozen ABIs & Interfaces
- chatr.discovery_result.v0_9_rc
- chatr.provider_session.v0_9_rc
- chatr.transaction.v0_9_rc
- chatr.workflow_graph.v0_9_rc
- chatr.provider_manifest.v0_9_rc
- chatr.connector_interface (BaseConnector — discover/fetch/authenticate/checkout/track/health/capabilities/sla)

### Agent Rules (Effective Immediately)
1. **NO new kernel subsystems.** The execution pipeline is feature-complete.
2. **NO new ABI objects** unless critical production gap + explicit user approval.
3. **New connectors** extending BaseConnector require no TSC approval.
4. **Bug fixes, performance, security** permitted without ADR.
5. All engineering effort targets: real provider integrations, UX polish, observability, reliability.

### Reality Levels
- L0 Unit Tests - L1 Mock Connectors (current) - L2 Sandbox APIs - L3 Production APIs (v1.0 target) - L4 Live Users

### Engineering Priorities (v0.9 RC -> v1.0)
- 40% Real provider integrations (Zomato, IRCTC, Razorpay)
- 25% Browser Runtime automation
- 20% UX polish and performance
- 15% Reliability and observability
