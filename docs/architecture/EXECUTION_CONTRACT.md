# CHATR OS Kernel: The Execution Contract v1.0

### Preface
The CHATR OS Kernel Execution Contract is the constitutional document governing the Kernel. Its purpose is to preserve a stable, domain-agnostic enterprise execution platform while allowing unlimited business innovation through metadata. This document intentionally favors long-term architectural stability over short-term implementation convenience. Any change that alters an Immutable Contract requires an Architectural Decision Record (ADR) and evidence from real implementation that the change improves the platform without compromising its domain independence.

### Document Precedence
When resolving conflicts, the following priority order applies:
`Execution Contract v1.0` → `Architectural Decision Records (ADR)` → `EDL Specification` → `Kernel API Specification` → `Capability Pack Specification` → `Operational Documentation` → `Implementation`

### Execution Contract Versioning
*   **v1.0**: Architecture Freeze
*   **v1.1**: Clarifications only
*   **v1.2**: Operational updates
*   **v2.0**: Breaking architectural changes (ADR required)

The goal of Phase 2 is to prove that the Kernel can support and completely replace a real enterprise application while remaining operationally invisible to the end user.

> [!CAUTION]
> **The Prime Directive:** The Kernel executes metadata. It never executes business domains.

### Scope of the Kernel
The Kernel provides generic enterprise execution capabilities: `identity`, `objects`, `events`, `relationships`, `policies`, `processes`, `projections`, `queries`, `evidence`, and `time`. 
It does not define business domains. Business domains are expressed exclusively through EDL and Capability Packs.

---

## Part 1: Immutable Contracts (Requires ADR)
These rules are constitutional. They may only be changed through a formal Architectural Decision Record (ADR). This section uses RFC 2119 terminology (MUST, MUST NOT, SHOULD, SHOULD NOT).

### Governance Enforcement Rules
To make this contract enforceable in practice, the following rules apply:
**Runtime changes:** MUST require an ADR, updated conformance tests, benchmark comparison, and evidence that the change benefits multiple domains.
**EDL changes:** MUST require version review, validator updates, and compatibility verification.
**Capability Pack changes:** MUST require schema validation, conformance tests, and migration verification if applicable.

### Architectural Invariants
Every engineer MUST mentally check these before merging code:
1. Every business capability MUST be represented as metadata.
2. Every state change MUST originate from an immutable event.
3. Every read MUST come from a projection.
4. Every decision MUST be governed by policies.
5. Every explanation MUST be backed by deterministic evidence.
6. Every capability MUST be portable as a Capability Pack.
7. Every Runtime change MUST benefit multiple domains.
8. The Kernel MUST NOT contain domain knowledge.

### Definition of Platform Stability
The Kernel is considered stable when:
*   New enterprise capabilities are introduced exclusively through Capability Packs.
*   Runtime changes become exceptional rather than routine.
*   EDL evolves more frequently than the Runtime.
*   Kernel releases are infrastructure releases, not business releases.
*   Business innovation occurs through metadata rather than code.

### Core Engineering Principles
1. **No Special Cases:** The Runtime MUST NOT become "smart" or contain domain heuristics or AI behavior.
2. **Metadata First, Code Last:** The decision hierarchy for future contributors:
    1. Can this be expressed in existing EDL?
    2. If not, SHOULD EDL evolve?
    3. If not, SHOULD the Kernel evolve?
    4. *Only then* SHOULD new code be written.

### Runtime Evolution Criteria
A Runtime change is justified **only if ALL of the following are true:**
1. The problem cannot be expressed in existing EDL.
2. Extending EDL would create unreasonable complexity.
3. Multiple Capability Packs require the same behavior.
4. The change improves the Runtime without introducing domain knowledge.

### Frozen Runtime Public API
The Object Runtime API is separated by intent and strictly frozen. Domain-specific methods are prohibited.
*   **Commands:** `create()`, `update()`, `archive()`, `restore()`, `delete()`, `executeProcess()`
*   **Queries:** `query()`, `snapshot()`, `relationships()`
*   **Evaluation:** `evaluatePolicies()`

### Explicit Non-Goals
The Kernel is **not** responsible for:
*   UI composition or Visual design
*   Prompt engineering
*   Vendor-specific SDK behavior
*   Business-specific heuristics
*   Workflow authoring UX
*   Data import tooling

### EDL Compatibility Policy
*   **Patch:** Must be backward compatible.
*   **Minor:** May add metadata but cannot invalidate existing capability packs.
*   **Major:** May introduce breaking changes and require migration tooling.

### Capability Pack Contract
Every capability must contain a strict directory structure (`manifest.edl`, `objects/`, `relationships/`, etc.). They must validate against the EDL schema, pass Conformance Suites, and declare EDL dependencies.

### Migration Gates
We will strictly enforce the following gates. We do not move between phases automatically:
*   **Gate A (Kernel Ready):** Conformance passes, SLOs met, Replay verified.
*   **Gate B (Recruitment Complete):** Strangler Pattern applied. UI/API unchanged. No domain logic remains.
*   **Gate C (Studio Ready):** Studio emits valid EDL that runs without manual edits.
*   **Gate D (Platform Ready):** A brand-new application is created entirely from EDL with zero runtime/schema/frontend changes.

---

## Part 2: Operational
These guidelines naturally evolve based on production workloads and implementation feedback.

### Performance SLOs (P95 Targets)
*   **Event append:** `≤ 50 ms`
*   **Object load:** `≤ 20 ms`
*   **Query Engine:** `≤ 50 ms`
*   **Relationship traversal:** `≤ 30 ms`
*   **Evidence construction:** `≤ 100 ms`
*   **Policy evaluation:** `≤ 20 ms`
*   **Projection update:** `≤ 100 ms`
*   **Aggregate replay:** `≤ 200 ms`

### Define Explainability
Every AI and Runtime decision must be deterministic. An explanation must be traceable to a combination of:
*   `Events`
*   `Policies`
*   `Relationships`
*   `Object State`
*   `Time`
*   `Knowledge`
If an explanation cannot point back to those sources, it is incomplete.

### Capability Pack Lifecycle
Packs follow a strict lifecycle, managed by the platform:
`Draft` → `Validated` → `Certified` → `Published` → `Installed` → `Deprecated` → `Retired`

---

## Part 3: Vision
The vision defines the long-term vector of the platform. It can evolve without implying the Kernel itself has changed.

### Long-Term Platform Roadmap
After Phase 2 (Recruitment Migration), work is structured by platform phases, not modules:
*   **Phase 3 (Metadata Platform):** Studio, Studio2, Pack tooling, Marketplace packaging.
*   **Phase 4 (Enterprise Intelligence):** Universal Conversation Engine, Evidence Builder enhancements, Cross-domain reasoning.
*   **Phase 5 (Enterprise Ecosystem):** Marketplace, Public SDK, Connector framework, Multi-tenant governance.

### The Ultimate Milestone
> [!NOTE]
> The ultimate milestone is not when Recruitment migrates. We will celebrate when this sequence happens:
> 1. A customer describes a new enterprise application.
> 2. Studio2 generates a Capability Pack (EDL).
> 3. The Capability Pack validates successfully.
> 4. The Runtime executes it unchanged.
> 5. Business OS renders it.
> 6. AI understands it.
> 7. The Conformance Suite passes.
>
> **No Runtime modifications. No new module. No new business logic.** This validates that CHATR OS is a platform for enterprise systems, not just another enterprise application.

---

## Part 4: Architectural Validation Criteria
Every architectural claim in this document will be demonstrable through implementation. This table serves as the executable specification for the platform itself.

| Claim | Automated Validation |
| :--- | :--- |
| **Kernel executes metadata** | `recruitment_kernel_migration.test.ts` |
| **Runtime is generic** | `cross_domain_runtime.test.ts` |
| **EDL is expressive** | `studio_roundtrip.test.ts` |
| **Studio2 works** | `nl_to_edl_validation.test.ts` |
| **Capability Packs are portable** | `pack_installation.test.ts` |
| **Explainability** | `evidence_traceability.test.ts` |
| **Platform stability** | `runtime_unchanged_validation.test.ts` |
