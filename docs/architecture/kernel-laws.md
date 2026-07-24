# Kernel Laws & Contracts

This document establishes the inviolable physical laws of the CHATR OS Enterprise Kernel. It dictates exactly how the Core Primitives and Kernel Services must behave, independent of any specific implementation or language.

If an implementation violates these laws, it is not a valid CHATR OS Kernel.

---

## Part 1: The 11 Kernel Laws

These laws are absolute invariants. They govern all state, execution, and AI reasoning within the platform.

1. **Law 1: Everything Has Identity.** Every Actor, Living Object, Process, Policy, Knowledge node, and Goal must possess a globally unique identifier (UUID/URN) and a distinct type.
2. **Law 2: Nothing becomes true inside the Enterprise Kernel without an Event.** Drafts, simulations, and AI hypotheses can exist, but they do not become enterprise truth until committed via an immutable `Event`.
3. **Law 3: Everything Has History.** Because of Law 2, the complete lifecycle and state evolution of every primitive can be perfectly reconstructed at any point in time.
4. **Law 4: Everything Can Be Related.** Any two primitives can be connected via a typed `Relationship`. The Enterprise Graph is universal; there are no isolated tables.
5. **Law 5: AI Never Owns Truth.** The Intelligence Engine cannot assert facts, evaluate permissions, or store data. It strictly acts as a reasoning, generation, and explanation layer over Kernel-provided determinism.
6. **Law 6: Truth Is Deterministic.** Questions concerning state, metrics, and relationships must be answered via the Knowledge/Object graph, not via probabilistic LLM generation.
7. **Law 7: Knowledge May Be Uncertain.** Unstructured `Knowledge` (documents, notes, AI summaries) is probabilistic. The Kernel isolates this uncertainty from deterministic `Living Objects` and `Events`. The AI reasons over both, but only deterministic truth changes enterprise state.
8. **Law 8: Views Never Own Data.** Dashboards, forms, and reports are read-only projections. They cannot contain business logic or intrinsic state.
9. **Law 9: Business Logic Never Belongs in UI.** All execution paths, workflows, and policies must be defined in the `Process Engine` or `Policy Engine`, capable of running headlessly.
10. **Law 10: Metadata Is Executable.** The Enterprise Definition Language (EDL) is not just configuration; it is the exact code that the Universal Runtime executes.
11. **Law 11: Everything Is Explainable.** Every state, recommendation, permission decision, workflow execution, and AI response must be traceable back to deterministic evidence. The Kernel never produces an answer that cannot be explained via its causal chain.

---

## Part 2: Primitive Support Contracts

Any engine managing a Core Primitive MUST guarantee the following capabilities:

### 1. Universal Observability & Addressability
- **Addressability:** Everything must have a canonical address (e.g., `urn:chatr:actor:employee:123`, `urn:chatr:policy:expense-limit`) allowing universal referencing by APIs, deep links, and AI.
- **Observability:** Every primitive must expose its `Current State`, `Health`, `Version`, `Last Updated`, and `Event Position`.

### 2. Living Objects & Actors (The Nodes)
- **Support Contract:** 
  - Must expose universal properties (Identity, Owner, Timeline, Health, Capabilities, Evidence, Permissions).
  - Must emit an `Event` for every state change.
  - Must be addressable via the Universal Graph API.

### 3. Relationships (The Edges)
- **Support Contract:**
  - Relationships are Living Records. They must support properties: `Created By`, `Created At`, `Valid From`, `Valid Until`, `Confidence`, `Source`, and `Metadata`.
  - Must be typed (Structural, Authority, Dependency, Temporal, Behavioral, Reference, Inheritance).
  - Must be bidirectional.

### 4. Events (The Ledger)
- **Support Contract:**
  - Must be immutable once committed.
  - Must support Causation tracing: `Triggered By`, `Caused By`, `Correlates With`.
  - Must contain the Actor ID, Target Object ID, Timestamp, Event Type, and Payload.

### 5. Processes & Policies (The Logic)
- **Support Contract:**
  - Must support four execution modes: `Simulation`, `Validation`, `Execution`, and `Rollback`.
  - Must be verifiable against an Actor's permissions before execution.

---

## Part 3: Kernel Service Contracts

The shared services provide fundamental capabilities to the Core Primitives. They must adhere to these contracts:

### 1. The Time Service
- **Contract:** Must define four temporal states for any Living Object or Graph projection:
  1. **Past:** Immutable history.
  2. **Present:** Current truth.
  3. **Planned:** Approved future state (forecasts, budgets).
  4. **Hypothetical:** Simulation for "what-if" analysis without affecting reality.

### 2. The Semantic Service
- **Contract:** Must provide 5-level resolution for unstructured input:
  1. **Vocabulary:** Map aliases to canonical terms (Vacation → Leave).
  2. **Intent:** Map human requests to executable `Processes`.
  3. **Context:** Disambiguate terms based on Department/Role (Revenue Pipeline vs Deployment Pipeline).
  4. **Culture:** Adapt to organization-specific colloquialisms ("Squad Leads").
  5. **Memory:** Evolve based on how the specific organization uses language over time.

### 3. The Intelligence Service
- **Contract:** The Intelligence Engine MUST NEVER receive unrestricted access to the kernel. It operates strictly on an **Evidence Package** provided by the Kernel.
  - Flow: `Kernel` → `Evidence Package` → `Intelligence` → `Structured Recommendation` → `Planner` → `Kernel`.
