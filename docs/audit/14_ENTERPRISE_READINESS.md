# 14 Enterprise Readiness

## Intent OS Framing

The readiness scores in this report measure enterprise deployment readiness for the current `/desktop/studio` implementation. They do not fully measure CHATR's long-term Intent Operating System assets.

The repository contains platform-level foundations that are stronger than a typical early workflow builder:

- Capability Registry work in frontend and Electron core.
- Provider manifest architecture and provider manifest ABI documents.
- Intent IR, Kernel ABI, and Runtime Contract specifications under `docs/intent-os`.
- Frozen ABI and ADR governance policies.
- Electron execution infrastructure, execution ledger, provider discovery, and credential vault.
- AI planning layer and local-first AI service direction.
- Enterprise control-plane direction in platform architecture documents.

These assets do not raise today's production-readiness score by themselves because they are not fully wired into Workflow Studio. They do, however, reduce the amount of redesign needed if the next phase consolidates around them.

## Scorecard

| Area | Score 0-10 | Why |
| --- | ---: | --- |
| Architecture | 5 | Many strong modules exist, but workflow responsibility is split across Studio, AutomationOS, Supabase functions, and Electron core. |
| Scalability | 3 | Studio execution is browser-local and not queue/worker backed. |
| Security | 4 | Auth/RLS/secrets foundations exist, but node execution and permissions are not enterprise hardened. |
| Maintainability | 3 | `WorkflowStudio.tsx` is large and mixes UI, static data, business logic, runtime dispatch, and analytics. |
| Observability | 4 | Schemas and analyzer services exist, but Studio panels mostly use static/local data. |
| Developer Experience | 5 | React/Vite/Supabase stack builds successfully and modules are discoverable; workflow APIs are fragmented. |
| Workflow Engine | 3 | Visual graph and compiler exist; durable graph semantics and publish lifecycle are incomplete. |
| Execution | 3 | Local execution works for a small core set; queues, retries, persistence, workers, and recovery are missing. |
| Node SDK | 2 | No central node registry or SDK. |
| Plugin SDK | 4 | Provider manifests and capability registry exist, but not integrated as Studio plugin nodes. |
| Marketplace | 3 | Integration surfaces exist, but no production connector marketplace for Studio. |
| API | 4 | Supabase and Edge Functions exist; no unified workflow API. |
| Versioning | 4 | Schema and manager exist; Studio publish menu does not use them. |
| Documentation | 2 | Architecture docs were missing before this audit. |
| Testing | 3 | Unit tests exist for parts of runtime/policy/capabilities; Studio E2E and integration coverage are missing. |

## Readiness by Enterprise Requirement

| Requirement | Current state | Readiness |
| --- | --- | --- |
| Multi-tenant isolation | `tenant_id` appears in schemas; Studio does not surface it | Partial |
| Workspace sharing | Not found in Studio | Missing |
| Workflow version locks | Schema/manager exists; not wired to Studio publish | Partial |
| Durable execution | Schema exists; Studio local runtime only | Partial/Missing |
| Worker scaling | Not found for Studio | Missing |
| Queueing | Schema exists; not used by Studio | Partial |
| Retry/backoff | Metadata exists; runtime missing | Partial |
| Audit trail | Tables/ledger exist; Studio does not write | Partial |
| Connector marketplace | Manifests exist; no Studio SDK | Partial |
| Secrets management | Vaults exist; node binding missing | Partial |
| RBAC | RLS/admin helpers exist; no complete Studio model | Partial |
| Monitoring | Static/local panels | Partial |
| Compliance export | Not found | Missing |
| SLA/escalation | Approval schema exists; not runtime-wired | Partial |
| Approval workflows | Schema/service exists; not runtime-wired | Partial |
| High-volume events | Not found for Studio | Missing |

## Strengths

- Clear product ambition and strong visual Studio shell.
- Build succeeds with Vite.
- React Flow is already present.
- Supabase backend direction includes versions, runs, approvals, secrets, queue, policies, metrics, and audit.
- AI workflow generation and AI action runtime exist.
- Electron core includes execution ledger, credential vault, provider discovery, and runtime execution abstractions.
- Provider manifests show early connector thinking.

## Major Enterprise Blockers

1. No single authoritative runtime across Studio, AutomationOS, Supabase, and Electron.
2. No canonical workflow graph shared by UI, React Flow, KernelStore, Supabase, AI Builder, Runtime, Publish, and Templates.
3. Studio ignores persisted edges and regenerates sequential edges.
4. Test run can execute stale `KernelStore` state.
5. Runs are not durable in `workflow_runs`.
6. Queue, checkpoint, retry, and worker infrastructure are not used by Studio.
7. Publish menu does not publish immutable versions.
8. Approval nodes do not call ApprovalEngine.
9. Secrets and credential scopes are not bound to nodes.
10. Runtime database/webhook/condition actions lack enterprise policy controls.

## Recommended Milestones

### Phase A - Establish a Single Runtime

Create one authoritative runtime. Desktop, Web, Mobile, AI Builder, Test Run, Publish, and future industry packs should execute through the same engine. Avoid adding new node types until this is true.

### Phase B - Canonical Workflow Graph

Create one canonical graph object that owns nodes, edges, variables, metadata, layout, version, permissions, and execution hints. Studio, AI Builder, Runtime, Publish, and Templates should all consume this object.

### Phase C - Enterprise Lifecycle

Wire save, draft, version, publish, rollback, archive, audit, and execution history into the existing lifecycle infrastructure after runtime and graph contracts are unified.

### Phase D - Node Platform

Introduce a Node SDK with manifest, schema, UI contract, validator, executor, serializer, permissions, policies, and tests.

### Phase E - Industry Packs

Build recruitment, sales, CRM, marketing, support, procurement, healthcare, and banking as templates and connector packs on top of the same runtime, graph, lifecycle, and node platform.

## Enterprise Readiness Score

Enterprise readiness score: 31/100.

CHATR Studio is strong enough for internal demos and architectural exploration. It is not yet ready for enterprise customers to run critical automations. The correct next step is not UI redesign or industry feature expansion; it is runtime, graph, lifecycle, and node-platform consolidation.
