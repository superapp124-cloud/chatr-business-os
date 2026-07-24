# Enterprise Ontology v0.1

This document defines the conceptual model of the enterprise—the periodic table of elements for CHATR OS. It strictly differentiates between intrinsic concepts (things that exist in every enterprise) and derived concepts (things that can be computed or projected).

The UI (Views) and Computations (Metrics) are strictly excluded from the Kernel.

---

## Part 1: The Separation of Concerns

The Kernel is divided into two distinct categories:

### A. Core Kernel Primitives (What Exists)
These are the physical and conceptual building blocks of the organization.
1. **Actor:** An entity capable of initiating an action (Humans, AI, Organizations, Systems).
2. **Living Object:** A digital twin of any noun with identity and a lifecycle (Assets, Candidates, Meetings, Workflows, Notifications).
3. **Relationship:** A typed, directed edge connecting two primitives.
4. **Event:** An immutable record of a state change in time.
5. **Process:** An executable description of behavior (the logic that a Workflow instance executes).
6. **Policy:** An executable constraint or governance rule (Approval limits, Compliance).
7. **Goal:** A measurable, independent enterprise objective (Reduce Hiring Time).
8. **Knowledge:** Passive, persisted information used for reasoning (SOPs, Wiki, PDFs).

### B. Kernel Services (How It's Powered)
These are not things an enterprise "contains"; they are capabilities the Kernel provides to every primitive.
1. **Time:** The 4D awareness of history, current state, and forecasts.
2. **Semantics:** The organizational context, vocabulary, and intent resolution.
3. **Intelligence:** The isolated reasoning, explaining, and planning engine.

---

## Part 2: Inheritance & Scope
Every specific enterprise concept inherits from a primitive. The Kernel only cares about the primitive.

```text
Entity
├── Actor
│     ├── Employee
│     ├── Customer
│     ├── Vendor
│     └── AI Agent
│
├── Living Object (Anything with Identity & Lifecycle)
│     ├── Asset (Laptop, Vehicle)
│     ├── Document (Invoice, Contract)
│     ├── Record (Candidate, Requisition)
│     ├── Workflow (An active instance of a Process)
│     ├── Meeting
│     └── Notification
│
├── Process
│     └── Workflow Definition / State Machine Logic
│
├── Policy
│     └── Executable Rules / Constraints
│
├── Knowledge
│     └── Passive Documents (SOPs, PDFs, Meeting Notes)
│
├── Goal
      └── OKRs, Service Level Objectives
```

---

## Part 3: Relationships (Typed Edges)
Relationships are not foreign keys; they are semantic, typed edges that form the Enterprise Graph. They belong to specific classes:

* **Structural:** `reports_to`, `contains`, `part_of`
* **Authority:** `approved_by`, `managed_by`, `owned_by`
* **Dependency:** `depends_on`, `blocks`, `requires`
* **Temporal:** `precedes`, `follows`
* **Behavioral:** `triggers`, `notifies`
* **Reference:** `references`, `related_to`
* **Inheritance:** `is_a`, `extends`

*Example:* `Employee` → `reports_to` (Structural) → `Manager`. `Project` → `depends_on` (Dependency) → `API`.

---

## Part 4: Lifecycles
All Living Objects share a Universal Lifecycle, ensuring consistent event generation and history tracking.

**The Universal Lifecycle:**
1. `Created` (Draft/Initial State)
2. `Active` (In Use)
3. `Changed` (Updated via Event)
4. `Paused` (Suspended/Inactive)
5. `Archived` (Hidden but retained)
6. `Deleted` (Soft deleted)
7. `Restored` (Recovered from Archive/Delete)

---

## Part 5: Universal Properties
To eliminate module-specific exceptions, **every** Living Object automatically receives these properties natively in the Kernel. Developers never have to define these.

* **Identity:** UUID, URN, Type.
* **Owner:** The `Actor` responsible for the object.
* **Timeline:** `Created At`, `Updated At`, `Valid From`, `Valid Until`.
* **Graph:** Array of outbound/inbound `Relationships`.
* **History:** The ledger of all `Events` that mutated the object.
* **Permissions:** Access Control List (ACL).
* **Goals:** Linked objectives tracking this object.
* **Documents:** Attached unstructured `Knowledge`.
* **Health:** Current operational status or health indicator.
* **Capabilities:** What actions can currently be performed on this object.
* **Evidence:** Supporting deterministic facts used by the AI for explainability.
* **Intelligence:** `AI Summary` (Auto-generated rolling summary).
* **Metadata:** Arbitrary Key/Value tags.
