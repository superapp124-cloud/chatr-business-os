# STAGE 15A: The Semantic Constitution
## Canonical Business Ontology of the CHATR Intent Operating System
**Version:** 1.0 | **Status:** Ratified | **Classification:** Foundational Contract

---

> **"Stages 1–14 define the mechanics of the Intent Operating System. Stage 15A defines the semantics."**
>
> Mechanics determine how the platform operates.
> Semantics determine what the platform understands.

---

## Mission

Stage 15A defines the immutable semantic foundation of the CHATR platform. It answers one question:

**"How does CHATR understand reality?"**

Not how it executes. Not how it authenticates. Not how it communicates.

But:

- *What exists?*
- *How are things related?*
- *How do they evolve?*
- *How do humans, AI agents, workflows, providers, and organizations refer to exactly the same thing?*

This document is the semantic equivalent of the Kernel ABI. It is the Business Constitution of the platform.

---

## Part 1 — The Ten Laws of the Semantic Constitution

These laws are absolute. They govern every entity, relationship, behavior, event, and extension in the CHATR ontology. Violation requires a formal **Ontology Decision Record (ODR)**.

---

### Law 1 — One Object. One Meaning.
Every semantic object has exactly one canonical definition. It may be **extended**. It may **never** be redefined.

**Correct:**
```
Person → Candidate → Employee → Senior Engineer
```

**Forbidden:**
```
HREmployee | PayrollEmployee | CRMEmployee | RecruitmentEmployee
```

A `Person` in Healthcare, Finance, and Recruitment is the same `Person`. Specialization occurs through strict inheritance, never duplication.

---

### Law 2 — Reality First
Software does not invent reality. Reality exists independently of software. The ontology models reality.

The **Reality Layer** is therefore the most stable semantic layer in the platform. Changes to it require the highest governance bar and must be treated with the same gravity as changes to the Kernel ABI.

---

### Law 3 — Everything Has Identity
Every semantic object **must** possess:
- **Canonical ID** — globally unique, stable across time
- **Type** — declared ontology type and layer
- **Owner** — the organization or workspace that governs it
- **Lifecycle State** — its current position in a lifecycle profile
- **Version** — monotonically increasing
- **Provenance** — how it came to exist (created, imported, federated)

Nothing anonymous exists in the CHATR ontology.

---

### Law 4 — Everything Exists in Context
No semantic object exists in isolation. Every object belongs to at minimum:
- **An Organization**
- **A Workspace**
- **A Point in Time**
- **A Relationship Graph**
- **A Policy Scope**

Context is not optional metadata. It is part of the object's identity.

---

### Law 5 — Relationships Are First-Class
Relationships are semantic objects, not foreign keys. They carry:
- **Subject** and **Object** (the two entities)
- **Predicate** (from the governed predicate library)
- **Direction** (uni- or bidirectional)
- **Multiplicity** (one-to-one, one-to-many, many-to-many)
- **Confidence** (1.0 for asserted, <1.0 for inferred)
- **Evidence** (the source of the relationship)
- **Validity** (time-bound start and expiry)
- **Provenance** (who/what established this relationship)
- **Policy Constraints** (governance rules on the relationship)

This is critical for AI reasoning. An AI agent that reads `Person works_for Organization` has semantics, not just data.

---

### Law 6 — Meaning Is Immutable
Attributes may evolve. Meaning may not. An `Invoice` is always a formal request for payment. That meaning cannot be repurposed by an Industry Pack, an AI model, or a capability.

Changing the meaning of a canonical object requires creating a **new canonical entity** with a formal **ODR**, not redefining the existing one.

---

### Law 7 — Canonical Before Industry
Industry Packs are not allowed to define business fundamentals. They extend them.

`Patient` extends `Person`. `Appointment` extends `Event`. `Prescription` extends `Document`. `Resume` extends `Document`. A Healthcare Pack cannot redefine what a `Person` or `Document` is.

---

### Law 8 — AI Must Use Canonical Semantics
AI agents, LLMs, planners, and recommendation engines operating on the CHATR platform must operate on ontology entities — not raw JSON, not arbitrary field names, not ad-hoc schemas.

This ensures that recommendations, predictions, simulations, and generated plans are explainable because they reason over well-defined semantic objects with known meaning.

---

### Law 9 — Events Describe Reality
Canonical events describe **business reality changes**, not user interface interactions.

**Correct:** `InvoiceIssued`, `TaskCompleted`, `EmployeeOnboarded`, `TrustEstablished`

**Forbidden:** `ButtonClicked`, `FormSubmitted`, `PageLoaded`, `DropdownChanged`

Events are the shared signal vocabulary between the Execution Plane and the Observability, Intelligence, and AI planes.

---

### Law 10 — The Ontology Is Additive
The Canonical Business Ontology grows. It never forks. New entities, relationships, traits, and lifecycle profiles may be introduced through the ODR governance process. Existing canonical definitions may not be forked, aliased into incompatible meanings, or removed without a full deprecation period.

---

## Part 2 — The Three Semantic Layers

The ontology is organized into three layers of increasing specificity. Each layer composes the one above it.

```
┌─────────────────────────────────────────────────────────┐
│                     REALITY LAYER                       │
│  Concepts that exist independently of any software.     │
│  Person | Organization | Money | Time | Place | Asset   │
│  Stable for decades.                                    │
├─────────────────────────────────────────────────────────┤
│                     BUSINESS LAYER                      │
│  Compositions of reality created by organizations.      │
│  Customer | Employee | Order | Invoice | Project        │
│  Extended by Industry Packs.                            │
├─────────────────────────────────────────────────────────┤
│                     PLATFORM LAYER                      │
│  Concepts unique to the CHATR operating system.         │
│  Intent | Capability | Package | Execution Plan         │
│  Governed by frozen Kernel and ABI contracts.           │
└─────────────────────────────────────────────────────────┘
```

### Reality Layer Entities
`Person`, `Organization`, `Place`, `Address`, `Location`, `Time`, `Duration`, `Currency`, `Money`, `Asset`, `Event`, `Conversation`, `Document`, `Identity`, `Relationship`, `Product`, `Service`, `Agreement`, `Measurement`, `Quantity`, `Unit`, `Group`, `Credential`

### Business Layer Entities
`Customer`, `Supplier`, `Candidate`, `Employee`, `Manager`, `Patient`, `Student`, `Merchant`, `Partner`, `Lead`, `Opportunity`, `Project`, `Campaign`, `Order`, `Invoice`, `Case`, `Ticket`, `Expense`, `Payroll`, `Contract`, `Reservation`, `Shift`, `Budget`, `Purchase Order`, `Policy`, `Subscription`, `Renewal`

### Platform Layer Entities
`Intent`, `Capability`, `Package`, `Provider`, `Connection`, `Policy`, `Trust`, `Exchange`, `Registry`, `Recommendation`, `Prediction`, `Simulation`, `ExecutionPlan`, `PlannerReport`, `Telemetry`, `IntelligenceArtifact`, `InstallationPlan`

---

## Part 3 — Domain Catalogs

Each domain is a governed view over the ontology organized around an Aggregate Root. Full domain specifications are living documents.

| Domain        | Aggregate Root | Key Entities                                  |
|---------------|----------------|-----------------------------------------------|
| Identity      | Person         | Organization, Team, Role, Permission          |
| Communication | Conversation   | Message, Channel, Meeting, Notification       |
| Knowledge     | Document       | Article, Wiki, Playbook, Policy               |
| Work          | Project        | Task, Workflow, Approval, Milestone, Goal     |
| Commerce      | Order          | Lead, Opportunity, Customer, Contract         |
| Finance       | Invoice        | Payment, Expense, Budget, Transaction         |
| Product       | Catalog        | Product, SKU, Bundle, Service, Price          |
| Scheduling    | Calendar       | Event, Booking, Shift, Availability           |
| Resource      | Asset          | Equipment, Facility, Room, Vehicle            |
| Human Capital | Employee       | Candidate, Manager, Skill, Resume             |
| Cust. Success | Case           | Ticket, Incident, SLA, Feedback               |
| Marketing     | Campaign       | Audience, Segment, Journey, Lead Source       |
| AI            | Intent         | Goal, Memory, Recommendation, Prompt, Agent   |
| Automation    | Capability     | Provider, Trigger, Action, Rule               |
| Platform      | Package        | Exchange, Registry, Policy, Trust             |
| Analytics     | Dashboard      | Metric, KPI, Chart, Alert, Threshold          |
| Security      | Identity       | Authentication, Authorization, Secret, Audit  |
| Experience    | Screen         | Component, Widget, Voice Command, Shortcut    |

---

## Part 4 — The Semantic Relationship Engine

Relationships are governed, first-class semantic objects.

### Standard Predicates (Governed Vocabulary)
`works_for`, `reports_to`, `belongs_to`, `manages`, `member_of`, `owns`, `created_by`, `places`, `contains`, `produces`, `executes`, `uses`, `authenticated_by`, `derived_from`, `associated_with`, `assigned_to`, `scheduled_for`, `resolves`, `invoices`, `contracted_with`, `endorses`, `trusts`

### Relationship Object Schema
```json
{
  "id": "rel_abc123",
  "subject": "prin_john_smith",
  "predicate": "works_for",
  "object": "org_acme_corp",
  "direction": "unidirectional",
  "multiplicity": "many_to_one",
  "confidence": 1.0,
  "evidence": ["hr_record_001"],
  "validity": { "from": "2023-01-01", "until": null },
  "provenance": "HRSystem:Import",
  "policyConstraints": ["hr.data.access"]
}
```

---

## Part 5 — The Trait System

Objects compose traits from eight governed categories instead of implementing bespoke behaviors.

### Governance Traits
`Auditable`, `Versioned`, `PolicyAware`, `PermissionAware`, `Classified`, `Compliant`

### Collaboration Traits
`Commentable`, `Mentionable`, `Shareable`, `Assignable`, `Watchable`, `Subscribable`

### Knowledge Traits
`Searchable`, `VectorSearchable`, `Summarizable`, `Embeddable`, `Referenceable`, `Indexable`

### Platform Traits
`Observable`, `EventProducing`, `Packageable`, `Federated`, `ExchangeReady`

### Operational Traits
`LifecycleManaged`, `HistoryEnabled`, `Taggable`, `Localizable`, `TimeAware`, `Archivable`

### AI Traits
`AIDiscoverable`, `AIReasonable`, `EmbeddingEnabled`, `ContextAware`, `ExplainabilitySupported`

### Security Traits
`EncryptionAtRest`, `AccessControlled`, `SecretAware`, `DataClassified`

### Experience Traits
`Renderable`, `FormGeneratable`, `DashboardReady`, `ExportFormattable`

---

## Part 6 — The Lifecycle Library

Lifecycle is a reusable profile, not a per-entity definition.

| Profile            | States                                                      |
|--------------------|-------------------------------------------------------------|
| Content Lifecycle  | Draft → Review → Approved → Published → Archived            |
| Business Lifecycle | Created → Active → Suspended → Closed → Archived            |
| Financial Lifecycle| Draft → Issued → Paid → Settled → Cancelled                 |
| Identity Lifecycle | Invited → Active → Suspended → Disabled → Archived          |
| Resource Lifecycle | Acquired → Available → In-Use → Maintenance → Retired       |
| Workflow Lifecycle | Draft → Published → Running → Paused → Completed → Archived |
| Package Lifecycle  | Draft → Validated → Certified → Signed → Published → Revoked|
| Trust Lifecycle    | Proposed → Verified → Negotiated → Active → Revoked         |
| Execution Lifecycle| Queued → Running → Paused → Completed → Failed              |
| AI Lifecycle       | Generated → Reviewed → Accepted → Applied → Expired         |
| Federation Lifecycle| Proposed → Negotiated → Active → Suspended → Revoked       |

---

## Part 7 — The Canonical Event Library

Events describe business reality changes. They are the shared signal vocabulary between all 7 OS planes.

### Identity Events
`PersonCreated`, `PersonUpdated`, `OrganizationJoined`, `RoleAssigned`, `CredentialVerified`, `IdentitySuspended`

### Work Events
`TaskAssigned`, `TaskCompleted`, `WorkflowStarted`, `WorkflowCompleted`, `ApprovalRequested`, `ApprovalGranted`, `ApprovalDenied`, `MilestoneReached`

### Commerce Events
`LeadCreated`, `OpportunityWon`, `OrderPlaced`, `OrderFulfilled`, `ContractSigned`, `SubscriptionRenewed`

### Finance Events
`InvoiceIssued`, `PaymentReceived`, `ExpenseSubmitted`, `BudgetExceeded`, `TransactionSettled`

### Knowledge Events
`DocumentCreated`, `DocumentPublished`, `DocumentVersioned`, `KnowledgeIndexed`

### AI Events
`IntentCaptured`, `RecommendationGenerated`, `PredictionProduced`, `SimulationCompleted`, `LearningArtifactCreated`

### Platform Events
`PackageInstalled`, `PackageRevoked`, `TrustEstablished`, `TrustRevoked`, `FederationSessionOpened`, `CapabilityInvoked`

---

## Part 8 — The Semantic Type System

Without a formal type system the ontology will drift into inconsistency.

### Primitive Types
`String`, `Number`, `Boolean`, `Date`, `Time`, `Timestamp`, `Duration`, `Email`, `Phone`, `URL`, `GeoPoint`, `UUID`, `Percentage`

### Money Types
`Currency` (ISO 4217 code), `Money` (`{ amount: Number, currency: Currency }`)

### Composite Types
`PersonName` (`{ first, middle, last, prefix, suffix }`), `Address` (`{ line1, line2, city, state, country, postal, geo }`), `Price` (`{ money, taxInclusive, pricingRule }`), `Schedule` (`{ start, end, recurrence, timezone }`), `Availability` (`{ slots: Schedule[], blackouts: Schedule[] }`)

### Domain Types
Strongly-typed canonical objects generated from domain catalogs (e.g., `Customer`, `Order`, `Invoice`).

---

## Part 9 — Universal Semantic Metadata

Every canonical object automatically exposes standardized metadata enabling AI reasoning, SDK generation, search, and federation.

```json
{
  "canonicalId": "urn:chatr:entity:commerce:order:ord_12345",
  "ontologyVersion": "15.0",
  "layer": "Business",
  "domain": "Commerce",
  "aggregateRoot": "Order",
  "type": "Order",
  "traits": ["Auditable", "Versioned", "Observable", "AIDiscoverable"],
  "lifecycle": "Business Lifecycle",
  "lifecycleState": "Active",
  "relationships": [...],
  "policies": [...],
  "capabilities": ["commerce.order.fulfill", "commerce.invoice.create"],
  "events": ["OrderPlaced", "OrderFulfilled"],
  "searchIndex": "chatr.commerce.orders",
  "vectorEmbeddingEnabled": true,
  "localization": { "locale": "en-IN", "timezone": "Asia/Kolkata" },
  "schemaVersion": "1.0",
  "extensionPoints": ["IndustryPack.Healthcare", "IndustryPack.Retail"]
}
```

---

## Part 10 — Ontology Governance

### The Ontology Review Board
Any change to canonical entities, relationship predicates, aggregate roots, lifecycle profiles, or primitive types requires a formal **Ontology Decision Record (ODR)**. This mirrors the Architectural Decision Record (ADR) process established for the Kernel.

### ODR Structure
- **Title** — concise name for the change
- **Status** — Proposed | Accepted | Rejected | Deprecated
- **Context** — the business or technical need driving the change
- **Decision** — the exact semantic change being made
- **Consequences** — impact on existing entities, SDK generators, AI models
- **Alternatives Considered** — other semantic approaches evaluated
- **Approval** — governance authority that ratified it

### Constitutional Governance Rules
1. Canonical entities are **additive-only**.
2. Existing semantic meanings **cannot** be redefined.
3. Industry Packs **extend** but never **replace** canonical entities.
4. New relationship predicates require an **ODR**.
5. Lifecycle profiles are **reusable** rather than embedded.
6. All capabilities operate **on** canonical entities.
7. AI models consume **ontology definitions**, not hard-coded schemas.
8. SDKs are **generated from** the ontology, not maintained independently.
