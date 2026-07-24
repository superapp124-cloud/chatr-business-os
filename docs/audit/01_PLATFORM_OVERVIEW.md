# 01 Platform Overview

## Scope

This report documents the current CHATR Workflow Studio implementation as found in the repository on 2026-07-17. It is a read-only architecture audit. No product code was changed.

Primary route audited: `/desktop/studio`.

Primary evidence:

- `src/App.tsx:481` routes `/desktop/studio` to `LazyPages.WorkflowStudio`.
- `src/routes/lazyPages.tsx:384` lazy-loads `src/pages/desktop/WorkflowStudio.tsx`.
- `src/pages/desktop/WorkflowStudio.tsx` contains the main Studio UI, static demo data, React Flow canvas, local run UI, AI builder modal, publish menu, logs, versions, and optimizer panel.
- `src/platform/AutomationOS/*` contains a separate client-side command bus, kernel store, compiler, runtime adapter, approval/version helpers, and AI provider abstractions.
- `src/hooks/useBusinessWorkflows.ts` persists workflow lists through Supabase table `business_workflows`.
- `supabase/functions/business-workflow-engine/index.ts` contains an Edge Function workflow runner, but this is not the runtime used by the Studio route.
- Electron has a separate kernel/workflow execution stack under `electron/chatr-core/*`.

## Executive Finding

CHATR has many of the ingredients of a universal automation platform: a desktop Studio route, a React Flow canvas, Supabase workflow persistence, AI workflow generation, workflow version tables, approval tables, queue tables, policy tables, Electron execution services, provider manifests, capability registries, and an event bus.

The current `/desktop/studio` product, however, is not yet wired as a durable enterprise workflow platform. It behaves as a visually rich Studio shell with partial persistence and a local browser runtime. Important enterprise controls exist in adjacent modules or migrations, but the Studio route mostly does not invoke them.

## Current Architecture

The current system is split across five major layers:

| Layer | Current role | Status |
| --- | --- | --- |
| React desktop app | Routes, Studio UI, canvas, panels, local state | Production route exists |
| AutomationOS frontend runtime | Command bus, kernel state, compiler, local runtime, AI planning | Partial and mostly in-memory |
| Supabase | Auth, `business_workflows`, workflow runs/version/approval/queue/policy migrations, Edge Functions | Partial and schema-drift risk |
| Electron CHATR core | IPC, local execution graph, provider discovery, execution ledger, credential vault | Separate runtime, not Studio route |
| Provider/capability layer | Capabilities, AI service, provider manifests, integrations UI | Fragmented and partially wired |

## How Studio Loads

1. The app enters the desktop route tree in `src/App.tsx`.
2. `src/App.tsx:481` registers `<Route path="studio" ...>`.
3. `src/routes/lazyPages.tsx:384` lazy-loads `WorkflowStudio`.
4. `WorkflowStudio` calls `useBusinessWorkflows()` from `src/hooks/useBusinessWorkflows.ts`.
5. If Supabase returns workflows, the first workflow becomes `activeProject`.
6. Studio also initializes local display state such as selected tab, selected node, AI modal state, workflow name, and local execution cards.
7. The route renders the left project pane, central React Flow canvas, bottom logs/executions/analytics pane, and right optimizer/team/version pane.

The audited in-app browser could not inspect the authenticated page because it redirected to `/auth`. The user-provided screenshot confirms an authenticated Studio view at `http://localhost:8086/desktop/studio`.

## Component Hierarchy

The `/desktop/studio` route is mostly a single large component:

- `WorkflowStudio`
  - top Studio shell and quick stats
  - left project/library/agent pane
  - AI Builder modal
  - publish menu
  - React Flow canvas
    - `HeaderNode`
    - `StartNode`
    - `CustomReactFlowNode`
    - `EndNode`
  - bottom tabs: Live Logs, Executions, Errors, Queue, Analytics
  - right panel: AI Optimizer, Team Live, Recent Versions

There is a second workflow builder at `src/components/business/automation/WorkflowBuilder.tsx` that uses React Flow editing handlers and saves both nodes and edges. It is more editor-like than `WorkflowStudio`, but it is not the implementation behind `/desktop/studio`.

## Data Flow

Current Studio data flow:

1. `useBusinessWorkflows()` fetches `business_workflows` rows for the current Supabase user.
2. `WorkflowStudio` selects the first workflow or a clicked workflow.
3. It places `workflow.nodes` into local React state.
4. It dispatches `LOAD_WORKFLOW` to `CommandBus`, but with edges synthesized from node order instead of persisted `workflow.edges`.
5. The React Flow canvas is generated from local `nodes` state.
6. The canvas edges are generated sequentially from `start -> node[0] -> node[1] -> ... -> end`.
7. `handleSave` updates only `{ nodes }` through Supabase. It does not save edges.
8. `handleTestRun` dispatches `RUN_WORKFLOW`, but `CommandBus` runs the graph in `KernelStore`, not the payload passed by the click handler.
9. Runtime events are published through a local EventBus and reflected in local UI state.

## Business Logic

Most business logic lives directly inside `WorkflowStudio.tsx`:

- Demo data: projects, team members, nodes, logs, versions, templates, integrations.
- React Flow serialization for the publish/export menu.
- AI generation button behavior.
- Project selection behavior.
- Test run button behavior.
- Save behavior.
- Live stat calculations.
- Bottom panel rendering.

Workflow execution logic lives outside the component in `src/platform/AutomationOS/RuntimeAdapter.ts`, but the route does not persist execution history through the richer Supabase workflow run schema.

## Backend Interaction

Backend interaction is mixed:

- Supabase client direct table access:
  - `useBusinessWorkflows.ts` reads and writes `business_workflows`.
  - `RuntimeAdapter.ts` writes to `email_queue`, `notifications`, and arbitrary configured database tables.
  - Approval/version helpers write to `workflow_approvals`, `workflow_versions`, and `business_workflows`.
- Supabase Edge Function:
  - `business-workflow-engine` reads `business_workflows` and simulates workflow execution.
  - It is not called by the Studio route.
- Electron IPC:
  - Electron has its own kernel execution flow, approvals, provider sessions, and execution ledger.
  - This is separate from the browser Studio route audited here.
- Vite proxy:
  - `vite.config.ts` proxies `/api` to `localhost:8787`, but Studio does not rely on a central workflow API service.

## Persistence

Current persistence is incomplete:

- Workflows: partially persisted in `business_workflows`.
- Nodes: persisted by `handleSave`.
- Edges: fetched by the hook type and used by the separate `WorkflowBuilder`, but ignored or regenerated in `WorkflowStudio`.
- Runs: rich `workflow_runs` migrations exist, but Studio local runs are not persisted there.
- Versions: `workflow_versions` migrations and `WorkflowVersionManager` exist, but Studio publish menu does not call the manager.
- Logs: Studio log panel uses static `LOGS` demo data and local EventBus updates.
- Analytics: Studio analytics are hard-coded or computed from local in-memory event history.

## State Management

The route uses several state mechanisms:

- React local state inside `WorkflowStudio` for selected project, nodes, panels, modals, filters, and executions.
- `useBusinessWorkflows` for remote workflow rows.
- `CommandBus` for workflow commands.
- `KernelStore` for AutomationOS graph state.
- `EventBus` for runtime events.

There is no single source of truth. Local Studio state, `KernelStore`, Supabase rows, and React Flow generated nodes can diverge.

## API Layer

There is no unified Workflow Studio API layer. The product uses direct Supabase table calls, local browser runtime calls, Edge Functions, Electron IPC, and a separate local server.

For enterprise use, the missing API boundary is a major architectural gap: validation, authorization, version locking, publish semantics, execution start, run history, audit, and queueing should be mediated by one coherent service contract.

## Authentication

Authentication primarily comes from Supabase:

- `useBusinessWorkflows.ts` calls `supabase.auth.getUser()`.
- If no user is present, the hook returns without workflows.
- Supabase session persistence is configured in `src/integrations/supabase/client.ts`.

The in-app browser redirected to `/auth` during audit, which confirms the route is auth-gated in that context.

## Permissions

Permissions are partially represented:

- `business_workflows` archived migration has owner-based RLS.
- New workflow tables include RLS for versions, runs, approvals, secrets, and policies.
- `WorkflowStudio` UI does not expose or enforce workspace/team sharing, node-level permissions, credential scopes, publish approval permissions, or execution permissions.
- The runtime uses frontend code for powerful actions such as webhook fetches and database table operations.

## Execution Engine

The audited Studio starts execution through:

- `handleTestRun` in `WorkflowStudio.tsx`.
- `CommandBus.dispatch({ type: 'RUN_WORKFLOW', ... })`.
- `CommandBus` compiles `KernelStore.getState()`.
- `RuntimeAdapter.execute()` runs tasks in the browser and publishes EventBus events.

This is a local runtime, not a distributed queue-backed workflow engine. It has no durable run row, no persisted checkpoints, no retry orchestration, no worker model, and no enterprise-grade failure recovery.

## Publishing and Versioning

The codebase contains versioning infrastructure:

- `supabase/migrations/20260709000007_phase4_workflow_versioning.sql`
- `src/platform/AutomationOS/WorkflowVersionManager.ts`

The Studio route publish menu currently compiles or logs a plan for options such as `Publish v13` and `Export`, but does not call `WorkflowVersionManager.publish()`, does not persist a published immutable version, and does not export a file.

## Monitoring, Logging, and Analytics

Current Studio monitoring is mostly display-only:

- Bottom logs use static `LOGS`.
- Execution cards are local state from EventBus events.
- Queue view is static.
- Analytics view is hard-coded.
- AI Optimizer recommendations are static.

The repository has richer observability-oriented services such as `PerformanceAnalyzer`, `FailureAnalyzer`, and workflow metrics migrations, but these are not wired into the visible Studio panels.

## Overall Assessment

CHATR Studio is a promising shell for a universal automation platform, but today the durable enterprise contract is incomplete. The strongest parts are visual workflow presentation, broad adjacent platform investment, Supabase schema direction, AI provider experimentation, and Electron execution infrastructure. The highest-risk parts are fragmented sources of truth, non-durable runs, edge loss, schema drift, static monitoring, and unconnected version/approval/security infrastructure.
