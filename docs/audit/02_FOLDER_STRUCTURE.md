# 02 Folder Structure

## Scope

This folder audit focuses on the workflow platform and surrounding CHATR OS repository structure. Generated dependency/build directories are identified but not expanded file-by-file because `node_modules`, `dist`, Android extraction outputs, and build artifacts are not source architecture.

Legend:

- Production: active source or configuration used by app/runtime/builds.
- Partial: source exists but is incompletely wired.
- Experimental: prototype, sandbox, local experiment, or capability not clearly productionized.
- Legacy: archived or older implementation kept for reference.
- Duplicate: overlapping implementation of a similar concept.
- Generated: build/dependency/output.
- Missing: expected source artifact is absent or empty.

## Top-Level Tree

```text
C:\Users\Arshid.Wani\chatrchat
|-- .agents/                         Partial, agent metadata
|-- .github/                         Production, CI/repository automation if configured
|-- .idea/                           Local IDE metadata
|-- .lovable/                        Legacy or generated project metadata
|-- .vault/                          Experimental/local secret or note storage
|-- .vite-nocache/                   Generated or local Vite cache
|-- .vscode/                         Local editor settings
|-- android/                         Production mobile shell and native Android project
|-- backend-mock/                    Experimental/mock backend
|-- backups/                         Legacy/generated backups
|-- certifications/                  Partial, certification/test materials
|-- CHATR/                           Legacy or duplicate product folder
|-- data/                            Local data and runtime artifacts
|-- dist/                            Generated Vite build output
|-- dist-desktop/                    Generated desktop build output
|-- dist-electron/                   Generated Electron build output
|-- docs/                            Documentation
|-- docs/audit/                      New read-only audit deliverables
|-- electron/                        Production desktop runtime and CHATR core
|-- experience/                      Experimental UX/experience assets
|-- fastlane/                        Production/partial mobile release automation
|-- ios/                             Production mobile iOS project
|-- ios-native/                      Duplicate or experimental iOS native layer
|-- jadx/                            Generated reverse-engineering/decompile output
|-- native-call-audio/               Experimental or platform-specific audio module
|-- node_modules/                    Generated dependencies
|-- postman/                         Partial API collections
|-- provider-manifests/              Partial provider integration manifests
|-- public/                          Production static assets
|-- scratch/                         Experimental workspace
|-- scripts/                         Production and utility scripts
|-- server/                          Partial local API/retrieval server
|-- src/                             Production React app and platform source
|-- store/                           Partial/local data store assets
|-- supabase/                        Production/partial database migrations and Edge Functions
|-- temp_apk*/                       Generated APK extraction/build temp folders
|-- test-results/                    Generated test output
|-- tests/                           Production/partial test suites
|-- tools/                           Utility tooling
```

## `src/` Tree

```text
src
|-- assets/                          Production static app assets
|-- chatr-os/                        Partial OS layer
|-- components/                      Production React components
|   |-- business/automation/         Partial alternate workflow builder
|   |-- calling/                     Production calling UI
|   |-- outcomes/                    Production/partial outcome widgets
|   |-- ui/                          Production shared UI primitives
|   |-- workflow-ui/                 Partial workflow UI widgets
|-- config/                          Production app config
|-- contexts/                        Production React context providers
|-- core/                            Production/partial CHATR OS core
|   |-- ai/                          Partial AI providers
|   |-- auth/                        Production/partial identity/session/OAuth
|   |-- capabilities/                Production capability registry and many capability folders
|   |-- document/                    Partial document engine
|   |-- engines/                     Partial AI/memory engines
|   |-- intelligence/                Partial performance/failure/optimization analyzers
|   |-- os/                          Production/partial global intent layer
|   |-- providers/                   Production/partial providers
|   |-- runtime/                     Production/partial EventBus, health, inspector
|   |-- services/                    Production/partial OS services
|   |-- workflow-ui/                 Partial runtime UI support
|-- data/                            Static/mock data
|-- hooks/                           Production hooks including useBusinessWorkflows
|-- integrations/                    Production/partial Supabase client and external integration helpers
|-- layouts/                         Production layout components
|-- lib/                             Shared utilities
|-- mock/                            Mock data/services
|-- packages/                        Partial internal package code
|-- pages/                           Production route pages
|   |-- desktop/                     Production desktop pages including WorkflowStudio
|   |-- business/                    Production/partial business pages
|-- platform/                        Production/partial platform modules
|   |-- AutomationOS/                Partial workflow runtime and Studio-adjacent engine
|   |-- Infrastructure/              Partial infrastructure abstractions
|   |-- Domain/                      Partial domain services
|   |-- events/                      Partial platform event bus
|-- providers/                       Production React providers
|-- routes/                          Production lazy route registry
|-- scripts/                         Utility scripts
|-- services/                        Production/partial app services including AI service
|-- tests/                           Local source tests
|-- types/                           Shared TS types
|-- utils/                           Production utilities
|-- workers/                         Web worker code
```

## `electron/` Tree

```text
electron
|-- main.cjs                         Production Electron main process
|-- preload.cjs                      Production IPC bridge
|-- chatr-core/                      Production/partial local CHATR runtime
|   |-- automation/                  Partial automation helpers
|   |-- browser-runtime/             Partial browser automation
|   |-- capabilities/                Partial capability definitions
|   |-- config/                      Runtime config
|   |-- conformance/                 Tests and conformance materials
|   |-- connectors/                  Provider connector code
|   |-- context/                     Runtime context
|   |-- db/                          Local SQLite persistence
|   |-- discovery/                   Provider discovery
|   |-- entities/                    Domain entities
|   |-- events/                      Event bus/helpers
|   |-- execution/                   Workflow engine, execution runtime, ledger
|   |-- executors/                   Browser/API/local executor implementations
|   |-- health/                      Runtime health
|   |-- identity/                    Identity helpers
|   |-- kernel/                      Execution graph and kernel runtime
|   |-- kernel-sdk/                  SDK-like kernel interfaces
|   |-- manifests/                   Provider manifests
|   |-- memory/                      Execution memory
|   |-- middleware/                  Runtime middleware
|   |-- modules/                     Module registry
|   |-- outcomes/                    Outcome templates
|   |-- providers/                   Provider intelligence
|   |-- registry/                    Provider registry
|   |-- server/                      Local server pieces
|   |-- services/                    Runtime services
|   |-- tests/                       Electron core tests
|   |-- transport/                   Transport helpers
|   |-- world-model/                 World model abstractions
```

## `supabase/` Tree

```text
supabase
|-- functions/                       Production/partial Edge Functions
|   |-- business-workflow-engine/    Partial workflow runner
|   |-- orchestration-event-router/  Partial event router
|   |-- process-scheduled-notifications/
|   |-- ai-*/                        AI-related Edge Functions
|   |-- send-sms, send-push, etc.    Notification/provider functions
|-- migrations/                      Production/partial schema migrations
|   |-- 20260709000006_*             execution_queue
|   |-- 20260709000007_*             workflow_versions
|   |-- 20260709000008_*             workflow_runs and audit_logs
|   |-- 20260709000009_*             workflow_approvals and secrets_vault
|   |-- 20260709000010_*             org_policies
|   |-- 20260710000001_*             platform_events and workflow state
|   |-- archive/old-migrations/      Legacy schemas including original business_workflows
```

## Workflow-Specific Folder Status

| Folder/File | Status | Notes |
| --- | --- | --- |
| `src/pages/desktop/WorkflowStudio.tsx` | Production route, partial platform | Main Studio UI; large single file; many static panels and local state. |
| `src/platform/AutomationOS/` | Partial | Compiler/runtime/version/approval pieces exist but not fully wired to Studio. |
| `src/components/business/automation/` | Duplicate/partial | Alternate React Flow builder saves nodes and edges, unlike Studio. |
| `src/hooks/useBusinessWorkflows.ts` | Production/partial | Direct Supabase workflow CRUD; no unified API boundary. |
| `supabase/functions/business-workflow-engine/` | Partial/unused by Studio | Edge Function runner exists but Studio uses frontend runtime. |
| `electron/chatr-core/execution/` | Production/partial duplicate runtime | Local desktop runtime and ledger separate from AutomationOS browser runtime. |
| `provider-manifests/` | Partial | Provider manifests exist for Razorpay, IRCTC, UPI, Swiggy, Zomato. |
| `src/integrations/supabase/types.ts` | Missing/incomplete | Empty file; generated Supabase Database types are absent. |

## Duplicate Workflow Concepts

The repository contains multiple overlapping workflow concepts:

- `WorkflowStudio.tsx`: desktop Studio route and visual shell.
- `WorkflowBuilder.tsx`: business automation builder with editable React Flow nodes/edges.
- `src/platform/AutomationOS`: frontend command/runtime/compiler.
- `supabase/functions/business-workflow-engine`: Edge Function runner.
- `electron/chatr-core/execution/workflow-engine.cjs`: desktop outcome-to-DAG builder.
- `electron/chatr-core/kernel/execution-graph.cjs`: Electron execution graph.
- `src/core/runtime/WorkflowInspectorStore.ts`: pipeline/workflow inspector events.
- `supabase/migrations/20260710000001_stage1_production_validation.sql`: workflow state/checkpoints/provider run schema.

This duplication is the main folder-level architecture smell. The platform has many strong pieces, but no single authoritative workflow engine boundary.

## Missing or Incomplete Artifacts

- Generated Supabase types are missing because `src/integrations/supabase/types.ts` is empty.
- Workflow API documentation is not centralized.
- Node registry documentation is not present before this audit.
- A durable Studio run API is not present.
- A Studio-specific E2E test folder is not evident.
- Edge schemas and runtime assumptions are not reconciled.

## Generated and Legacy Cleanup Candidates

The following should not be treated as active source for enterprise architecture unless proven otherwise:

- `dist/`, `dist-desktop/`, `dist-electron/`
- `node_modules/`
- `test-results/`
- `temp_apk*`
- `jadx/`
- `backups/`
- `supabase/migrations/archive/old-migrations/`
- `.vite-nocache/`

They may still be useful for forensics, but they should not drive the product architecture baseline.
