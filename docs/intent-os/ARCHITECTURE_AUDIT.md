# CHATR Autonomous Intent Execution OS Architecture Audit

Date: 2026-07-15

## Verdict

The current kernel is not domain-agnostic or autonomous yet.

Implementation of the Autonomous Intent Execution OS refactor should not begin until the kernel boundary is cleaned and guarded. The audit found domain-specific runtime concepts in planning, decisioning, workflow construction, capability contracts, policy, provider loading, UI registration, and frontend fallback routing. It also found that the current architecture lacks explicit autonomous execution layers for durable goals, world observation, state reconciliation, scheduling, async events, and restart recovery.

The target line is strict:

- Kernel concepts: Intent, Entity, Goal, Capability, Context, Provider, Execution, Observation, Reconciliation, Verification, Learning.
- Ontology concepts: Dish, Merchant, Accommodation, Flight, Appointment, Bill, Passport, Ticket.
- Provider concepts: Swiggy, Zomato, Amadeus, Booking.com, Practo, bank APIs.
- Runtime concepts must not include industry names such as food, travel, hotel, flight, healthcare, shopping, banking, or government.

## Audit Scope

Audited runtime and kernel surfaces:

- `electron/chatr-core`
- `electron/main.cjs` IPC intent path
- `src/core`
- `src/components/workflow-ui`
- supporting `docs` and `tools` references where they define kernel/provider contracts

Ignored for primary findings:

- generated `dist` and `dist-desktop` assets
- `node_modules`
- archived migrations
- product pages that are outside the kernel boundary

## Critical Findings

| ID | Severity | Finding | Evidence | Why This Blocks Intent OS |
| --- | --- | --- | --- | --- |
| A1 | P0 | Electron planner performs regex domain routing and emits domain capability IDs. | `electron/chatr-core/kernel/planner.cjs:36`, `:44`, `:68`, `:69`, `:79`, `:84`, `:90` | Planner should output `Intent + Entity + Confidence + Constraints`, not `food.order`, `shopping.search`, or transport modes. |
| A2 | P0 | Decision engine owns domain constraints, risk lists, widget selection, and clarification labels. | `electron/chatr-core/kernel/decision-engine.cjs:29`, `:31`, `:35`, `:90`, `:93`, `:231`, `:328`, `:356`, `:362` | Entity resolution, risk, and UI schema selection are mixed with domain semantics inside kernel logic. |
| A3 | P0 | Workflow engine hardcodes vertical DAGs. | `electron/chatr-core/execution/workflow-engine.cjs:90`, `:144`, `:168`, `:216` | Workflows must be generated from reusable goal/capability primitives, not hardcoded `food`, `shopping`, `healthcare`, or `transport` branches. |
| A4 | P0 | Capability catalog and contracts are domain IDs. | `electron/chatr-core/capabilities/capability-catalog.json:5`, `:7`, `:12`, `:14`; `electron/chatr-core/capabilities/capability-contracts.json:34`, `:44`, `:54`, `:74`, `:84` | Capability ABI should expose universal verbs like `SEARCH`, `COMPARE`, `SELECT`, `PAY`, `TRACK`, `VERIFY`; entity support belongs in provider manifests or ontology. |
| A5 | P0 | Execution runtime statically maps connector categories and contains domain simulations. | `electron/chatr-core/execution/execution-runtime.cjs:32`, `:34`, `:36`, `:37`, `:57`, `:66` | Provider dispatch must be manifest-driven. Static category maps make each new domain a runtime change. |
| A6 | P0 | Provider strategy order conflicts with required policy. | `electron/chatr-core/execution/strategy-engine.cjs:9`, `:43`, `:77`, `:89` | Required order is API -> Native App -> Browser Runtime -> Human Assist. Current priority begins with browser sessions and includes simulation as runtime fallback. |
| A7 | P0 | Frontend planners also route by domain keywords. | `src/core/intent/patterns.ts:24`, `:51`, `:376`; `src/core/services/CommitmentPlanner.ts:25`, `:27`, `:47`, `:304` | Even if Electron kernel is refactored, frontend can bypass it by producing `FLIGHT_BOOKING`, `HOTEL_BOOKING`, and `core.flight_booking`. |
| A8 | P0 | Domain-specific runtime capabilities are registered as core capabilities. | `src/core/capabilities/init.ts:24`, `:25`, `:44`, `:45`; directories `src/core/capabilities/travel`, `flight_booking`, `hotel_booking`, `healthcare`, `commerce`, `finance`, `ticketing` | These must become ontology/provider packages or migrated behind the universal capability resolver. |
| A9 | P1 | Context engine exists but is incomplete and not consistently injected before planning. | `electron/main.cjs:526`, `:535`, `:539`, `:542`; `electron/chatr-core/context/system-context-engine.cjs:34`, `:36`; `electron/chatr-core/context/user-context-engine.cjs:51`, `:57` | Required context includes GPS, Device, Time, Wallet, Preferences, Permissions, History, Execution Memory. Current path injects user and personal context but not the full context frame before planning. |
| A10 | P1 | Personal context schema stores domain categories. | `electron/chatr-core/context/personal-context-engine.cjs:67`, `:213`, `:214`, `:215`, `:216`, `:218` | Execution memory and preferences should be keyed by provider/entity/capability outcomes, not food/hotel/airline/shopping buckets. |
| A11 | P1 | Provider manifest schema contains industry enum categories. | `electron/chatr-core/connectors/manifest-schema.json:10`, `:28`, `:30`, `:35`, `:43`, `:73`, `:95` | Provider ABI should declare capabilities, supported entities, execution modes, policies, rate limits, reliability, and validation rules without industry enums. |
| A12 | P1 | UI registration is not purely schema-driven. | `src/core/workflow-ui/WidgetRegistry.ts:16`, `:19`, `:20`; `src/core/workflow-ui/types.ts:18`, `:22`, `:31`, `:116`; `src/components/workflow-ui/index.ts:39`, `:42`, `:48` | UI should render JSON schemas through generic components. Domain widgets and domain-shaped widget types create another routing layer. |
| A13 | P1 | Provider lookup in frontend execution is hardcoded to cab. | `src/core/providers/ExecutionOrchestrator.ts:42`, `:43`; `src/core/providers/types.ts:72` | Provider selection must use capability + entity + context, not a fixed provider type. |
| A14 | P1 | Acceptance examples do not route through one kernel pipeline today. | See acceptance matrix below. | Some examples route through domain runtimes, some route to unknown, and some exist only as marketplace mocks. |
| A15 | P0 | Autonomous execution layers are not represented as first-class kernel runtime concepts. | No durable `GoalRuntimeState`, `WorldState`, `ObserverLoop`, `ReconciliationEngine`, `KernelScheduler`, or kernel `EventBus` boundary found in the audited runtime. | CHATR cannot prove true goal completion, resume suspended workflows after restart, reconcile provider state, react to async events, or recover long-running goals without domain-specific code paths. |
| A16 | P0 | Kernel services are not explicit OS-level boundaries. | Identity, security, policy, resources, secrets, permissions, audit, telemetry, cache, trust, and strategy selection appear as partial or scattered concerns rather than shared kernel services. | Provider Intelligence cannot safely own identity, trust, resources, secrets, and policy internally. A true OS needs explicit services before broad provider/plugin expansion. |

## Domain Leak Inventory

### Electron Kernel

- Planner: `electron/chatr-core/kernel/planner.cjs`
- Decision intelligence: `electron/chatr-core/kernel/decision-engine.cjs`
- Legacy duplicate decision file: `electron/chatr-core/kernel/intent-intelligence-engine.cjs`
- Workflow generator: `electron/chatr-core/execution/workflow-engine.cjs`
- Capability catalog: `electron/chatr-core/capabilities/capability-catalog.json`
- Capability contracts: `electron/chatr-core/capabilities/capability-contracts.json`
- Execution runtime static connector map: `electron/chatr-core/execution/execution-runtime.cjs`
- Trust and approval policy: `electron/chatr-core/kernel/trust-engine.cjs`, `electron/chatr-core/context/policy-engine.cjs`
- Provider manifest schema: `electron/chatr-core/connectors/manifest-schema.json`
- Connector store examples: `electron/chatr-core/connectors/connector-store.cjs`, `electron/chatr-core/discovery/connector-manager.cjs`
- Outcome template: `electron/chatr-core/outcomes/travel.outcome.json`
- Core connector folders: `electron/chatr-core/connectors/food`, `healthcare`, `shopping`, `transport`, `jobs`

### Frontend Core Runtime

- Regex intent observer: `src/core/intent/patterns.ts`, `src/core/intent/types.ts`
- Commitment router: `src/core/services/CommitmentPlanner.ts`
- Capability registration: `src/core/capabilities/init.ts`
- Domain runtime folders: `src/core/capabilities/travel`, `flight_booking`, `hotel_booking`, `healthcare`, `commerce`, `finance`, `ticketing`, `home_services`, `logistics`
- Playbook domain map: `src/core/services/PlaybookEngine.ts`
- Hardcoded provider type execution: `src/core/providers/ExecutionOrchestrator.ts`
- Domain provider stubs: `src/core/providers/FlightProvider.ts`, `HotelProvider.ts`, `MockRideProviders.ts`
- Global intent fallback routing: `src/core/os/GlobalIntentProvider.tsx`
- Knowledge extraction domain patterns: `src/core/os/KnowledgeEngine.ts`

### UI Runtime

- Domain widget imports from nonexistent `src/core/workflow-ui/widgets`: `src/core/workflow-ui/WidgetRegistry.ts`
- Domain examples and identifiers in UI contracts: `src/core/workflow-ui/types.ts`
- Generic widgets exist under `src/components/workflow-ui/widgets`, but they are not yet expressed as a strict JSON Schema renderer.

## Acceptance Matrix

| Request | Current Observed Route | Status |
| --- | --- | --- |
| Order Chicken Biryani | Electron planner emits `food.order` and extracts `cuisine=biryani`. | Fails architecture: domain runtime. |
| Book Taj Hotel | Frontend planners know hotel; Electron kernel planner likely returns `unknown`. | Fails functionality and architecture. |
| Book Flight to Dubai | Electron planner routes to `transport.search` with `mode=flight`; frontend routes to `core.flight_booking`. | Fails architecture: domain/mode routing. |
| Pay Electricity Bill | No universal pay/bill goal path found. | Fails functionality. |
| Renew Passport | Exists as a marketplace mock `gov.passport`, not kernel pipeline. | Fails functionality and architecture. |
| Transfer INR 5000 | Policy code recognizes transfer risk, but no universal transfer execution path found. | Fails functionality. |
| Book Doctor Appointment | Electron planner emits `healthcare.search_doctors`. | Fails architecture: domain runtime. |
| Reserve Movie Tickets | No universal reserve/ticket path found. | Fails functionality. |

## Refactoring Plan

1. Freeze domain runtime additions.
   - No new `food`, `travel`, `shopping`, `hotel`, `flight`, `banking`, `government`, or `healthcare` runtime modules.
   - New use cases must enter through ontology/provider manifests only.

2. Introduce Kernel ABI v0.9 Release Candidate.
   - Add strict objects for `ContextFrame`, `IntentFrame`, `EntityGraph`, `GoalPlan`, `GoalRuntimeState`, `WorldState`, `CapabilityRequest`, `ProviderSelection`, `WorkflowGraph`, `ExecutionReceipt`, `ReconciliationDecision`, `VerificationReport`, and `LearningEvent`.
   - Add an architecture lint that fails when forbidden industry terms appear in kernel/runtime folders.
   - Do not freeze v1.0 until autonomous execution, observation, reconciliation, scheduling, restart recovery, and long-running goal tests pass.

3. Replace planners with an Intent Engine.
   - Remove keyword/regex routing from kernel decision paths.
   - Planner output becomes only `{ intent, entity, confidence, constraints }`.
   - Any regex or LLM extraction must produce entities, not runtime domains.

4. Move ontology logic into Entity Resolver.
   - Entity Resolver maps "Chicken Biryani" -> Dish -> Merchant Item -> Merchant.
   - Kernel consumes only normalized entity graph and capability requirements.

5. Add universal Goal Planner.
   - Convert `IntentFrame + EntityGraph + ContextFrame` into goal primitives.
   - Example primitives: `DISCOVER`, `COMPARE`, `SELECT`, `AUTHENTICATE`, `PAY`, `EXECUTE`, `TRACK`, `VERIFY`.

6. Replace domain capability IDs with capability primitives.
   - Old: `food.search`, `flight_booking`, `healthcare.book_appointment`.
   - New: `SEARCH`, `COMPARE`, `SELECT`, `AUTHENTICATE`, `PAY`, `EXECUTE`, `TRACK`, `VERIFY`.
   - Entity constraints decide what providers can serve.

7. Introduce Capability Resolver and Provider Intelligence.
   - Resolve providers from manifest capabilities, supported entities, context, policies, latency, reliability, cost, API availability, native app availability, browser availability, and user preference.
   - Enforce API -> Native App -> Browser Runtime -> Human Assist.
   - Insert Strategy Resolver between Capability Resolver and Provider Intelligence.
   - Require explicit `StrategySelection` records for fastest, cheapest, most trusted, privacy first, local first, and policy required paths.

8. Replace hardcoded DAG generation.
   - Workflow Generator composes DAGs from goal primitives and resolved capabilities.
   - Outcome templates may remain only as declarative examples outside the kernel, never as vertical branches in kernel code.

9. Add autonomous execution runtime layers.
   - Goal Runtime owns durable goals and their lifecycle.
   - Kernel Scheduler resumes suspended and long-running goals after restart or external events.
   - Observer Loop turns provider callbacks, polling, device signals, and user input into observations.
   - World State stores the kernel's current external-world model.
   - Reconciliation Engine compares expected state, observed state, and provider receipts before continuing, retrying, recovering, or completing.
   - Event Bus carries async provider, device, scheduler, approval, and verification events across kernel components.

10. Add kernel services.
   - Identity Service owns user, provider account, passkey, OAuth/OIDC, enterprise SSO, and external identity references.
   - Security, Policy, Permission, Trust, and Secrets services gate execution before provider calls.
   - Resource Manager leases scarce resources before browser, native app, model, device, storage, or scheduler use.
   - Audit, Telemetry, and Cache services produce evidence, metrics, and freshness-aware reuse.

11. Replace vertical widgets with schema renderer.
   - UI receives JSON Schema plus uiSchema and action schema.
   - Remove domain widgets and widget type names that encode verticals.

12. Re-key execution memory.
    - Store memory by provider, entity class, capability primitive, goal pattern, and verification outcome.
    - Do not key preferences by `food`, `hotel`, `airline`, or similar categories.

13. Add Intent Learning loop.
    - Low confidence -> clarification -> correction -> learning event -> knowledge graph validation -> future resolver improvement.
    - Do not directly mutate ontology from user corrections.

## Go/No-Go Gate

The kernel can be considered domain-agnostic only when all checks pass:

- `electron/chatr-core/kernel`, `execution`, `context`, `capabilities`, `runtimes`, `registry`, and `server` contain no forbidden industry runtime terms except in comments that explicitly discuss audit/migration.
- Planner does not emit capability IDs or domain IDs.
- Workflow Generator has no domain branches.
- Capability Catalog contains only universal capability primitives.
- Provider manifests validate against Provider Manifest ABI v0.9 RC.
- UI renderer accepts schemas and does not import vertical widgets.
- Goal Runtime persists `GoalRuntimeState` and resumes suspended/long-running goals after process restart.
- Observer Loop records observations from provider callbacks, polling, browser/native runtime events, device state, and user input.
- World State and Reconciliation Engine decide whether to continue, retry, recover, suspend, request human assist, or complete.
- Kernel Scheduler handles delayed checks, provider webhooks, timeout retries, and resume triggers without domain-specific branches.
- Event Bus carries async events using typed envelopes instead of direct provider callbacks into domain runtimes.
- Strategy Resolver emits explicit strategy decisions before provider ranking.
- Kernel services own identity, security, policy, resources, secrets, permissions, audit, telemetry, cache, and trust.
- Provider execution requires policy, trust, permission, and resource lease records where applicable.
- Agents produce proposals only; kernel services check policy and kernel execution owns final action.
- Acceptance examples all produce the same pipeline shape.
- Architecture lint and acceptance tests are part of CI.
