# CHATR OS — Engineering Constitution

Date: 2026-07-15
Status: Active. Supersedes all prior agent instructions.

This document serves as the absolute law for all engineering efforts, human or AI, working on the CHATR OS repository. **Read this before writing any code.**

1. **Architecture is frozen.**
2. **Kernel ABI is authoritative.**
3. **Providers never change kernel.**
4. **Industries never enter runtime.**
5. **Goals own execution.**
6. **Capabilities are universal.**
7. **Strategies are separate.**
8. **Providers execute.**
9. **Verification gates completion.**
10. **Every architectural change requires an ADR.**
11. **No new kernel subsystem may be introduced until a Hero Experience exposes a concrete limitation that cannot be solved in the connector, manifest, or browser runtime.**

## Core Pipeline Constraint

All workflows and pipelines MUST strictly adhere to the following execution model. Any deviation or shortcutting of this flow (e.g., injecting industry-specific logic into the core) is an architectural violation.

```
Intent
  ↓
Context
  ↓
Entity
  ↓
Goal
  ↓
Capability
  ↓
Strategy
  ↓
Provider
  ↓
Execution
  ↓
Verification
```

## AI Agent Directives

- **Implementation agents write code.**
- **Architecture changes require review against the frozen ABI and ADRs.**
- **Do not introduce new runtime concepts** (e.g., `FoodRuntime`, `TravelRuntime`, `ShoppingRuntime`).
- **Do not introduce industry-specific actions** (e.g., `food.search`, `travel.book`).
- **Prove implementation cannot satisfy the existing ABI** before proposing *any* architectural changes.
- **Every ABI-affecting change requires an ADR** filed in `ARCHITECTURE_DECISION_RECORDS/` before merging.

---

## Program Milestones

Development is organized into Program Milestones. Each milestone has fixed deliverables and must pass the Kernel Certification Checklist before it is considered complete.

| Platform Milestone | Name | Status | Key Deliverables |
| --- | --- | --- | --- |
| Platform Milestone A | Kernel Core | ✅ Certified | Goal Runtime, Event Bus, Context Engine, Entity Resolver, Goal Planner, Architecture Lint |
| Platform Milestone B | Resolution Layer | 🔲 Current | Capability Resolver, Strategy Resolver, Provider Intelligence, Provider Manifest Loader, Trust Service, Policy Service, Resource Manager |
| Platform Milestone C | Autonomous Runtime | 🔲 Pending | Workflow Generator, Observer Loop, World State, Reconciliation Engine, Verification Engine, Scheduler |
| Platform Milestone D | Provider Platform | 🔲 Pending | Provider SDK, Manifest SDK, Provider Validator, Provider Marketplace, Extension SDK |
| Platform Milestone E | Intent Platform | 🔲 Pending | Desktop, Android, iOS, Web, Enterprise Runtime |

One kernel. Different front ends. **Same pipeline for every milestone.**

Kernel version advances with each certified milestone: `0.9.0-rc → 0.9.1 → 0.9.2 → 0.9.3 → 1.0`.

---

## Operational Documents

These documents govern how software is **shipped and certified**. They are not architecture documents.

- [`PLATFORM_LIFECYCLE.md`](./PLATFORM_LIFECYCLE.md) — Program roadmap: Architecture through ABI Evolution. Platform Health SLOs. Kernel v1.0 Readiness Review.
- [`RELEASE_PROCESS.md`](./RELEASE_PROCESS.md) — How code moves from developer to production.
- [`KERNEL_CERTIFICATION_CHECKLIST.md`](./KERNEL_CERTIFICATION_CHECKLIST.md) — What “kernel certified” means. Produces a machine-readable Certification Artifact.

---

By adhering to this constitution, the repository will drive the agents, preventing architectural drift and ensuring the CHATR OS Kernel remains coherent, stable, and universal.

### Article 6: Goal Runtime Supremacy
GoalRuntimeState is the single source of truth for execution progress. Everything else is Input, Observation, Proposal, or Evidence. Only Goal Runtime owns execution truth.
