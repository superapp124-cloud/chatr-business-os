# Kernel Boundary & Responsibility Matrix

This document defines the architectural "firewall" between engines in the CHATR OS Enterprise Kernel. It strictly enforces the Separation of Concerns.

## The One Golden Rule
> **The Kernel owns truth. The Runtime owns behavior. The Clients own experience. AI owns neither truth nor behavior—it enhances understanding and decision-making.**

## The Universal Boundaries

**The Kernel does NOT own:**
* React components, pages, themes, CSS, layouts, or UI rendering.
* LLM system prompts or text generation algorithms.
* Vendor SDKs or third-party integrations (these belong in the Integration Layer).
* Process Execution / Orchestration (this belongs to the Runtimes).

**The Runtimes (Workflow, Automation, Agent, Conversation) own:**
* Execution of Process Definitions over time.

## Engine Responsibility Matrix

| Engine / Service | Owns | Never Owns | Depends On | Exposes |
| :--- | :--- | :--- | :--- | :--- |
| **Identity** | Actors, roles, organizational units | UI state, workflows | Event Engine | Identity API |
| **Object Runtime** | Lifecycle, state, versioning of objects | Rendering, UI validation | Identity, Events | Object API |
| **Relationship** | The Semantic Enterprise Graph (Edges) | Object payloads | Object Runtime | Graph API |
| **Event** | The immutable ledger, causation tracing | Current state projections | Identity, Objects | Event Stream |
| **Time Service** | Temporal views (Past, Present, Planned) | Scheduling execution | Events | Time API |
| **Semantic Service** | Vocabulary, context, intent resolution | LLM reasoning | Knowledge | Resolution API |
| **Knowledge Service**| Documents, SOPs, unstructured information | Deterministic state | Objects | Retrieval API |
| **Policy** | Rules, constraints, compliance | UI validation | Identity, Objects | Policy API |
| **Process** | Definition of behavior / state machines | Execution orchestration | Policy | Workflow Definitions |
| **Outcome** | Goals, OKRs, targets, risks | Process execution | Events, Objects | Outcome API |
| **Query Engine** | Centralized enterprise querying | Direct DB connections | All Kernel Engines | Query API |
| **Evidence Builder** | Gathering deterministic facts for AI | LLM Generation | All Kernel Engines | Evidence Packages |
| **Projection Service**| Fast-read projections, search indexes | Source of truth | Event Engine | Read APIs |
| **Version Service** | Version control for objects and schemas | Change execution | Event Engine | Version API |
| **Intelligence** | Reasoning, explanation, text generation | Data querying | Evidence Builder | AI API |

## Engine Independence Rule
**No engine may directly mutate another engine's state.** Communication happens strictly through contracts and Events. Internal engine state is fully encapsulated.
