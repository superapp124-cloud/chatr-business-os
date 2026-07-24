# Autonomous Intent Execution OS Migration Strategy

Date: 2026-07-15

## Objective

Migrate CHATR from domain-specific capabilities into a universal Autonomous Intent Execution Operating System using Kernel ABI v0.9 Release Candidate.

The migration should preserve current useful provider work, but it must move domain knowledge out of kernel runtime branches and into ontology, provider manifests, declarative schemas, and provider-specific adapters. ABI v1.0 must not be frozen until autonomous execution layers prove restart-safe goal continuation, external-world observation, state reconciliation, async event handling, and true goal completion.

CHATR Architecture v1.0 is frozen. The architecture is complete enough to begin implementation as Kernel ABI v0.9 RC. Additional redesign should be avoided unless implementation evidence exposes a real kernel boundary failure.

The active implementation milestone is `CHATR Kernel v0.9 RC Validation`.

Architecture Phase is complete. Kernel Validation Phase has begun.

Kernel ABI and contract changes must follow `KERNEL_ABI_CHANGE_POLICY.md`.

## Non-Goals

- Do not add a new food, travel, banking, healthcare, government, or shopping runtime.
- Do not add acceptance examples as special cases.
- Do not train ontology directly from user corrections.
- Do not keep browser automation as the default execution path when API or native app execution is available.

## Phase Plan

### Phase 0: Guardrail and Freeze

Deliverables:

- Add architecture lint for forbidden industry terms in kernel/runtime folders.
- Track Kernel Purity KPIs and keep all targets at zero.
- Adopt `OS_PRINCIPLES.md` as the architectural constitution.
- Require Architecture Decision Records for architectural changes.
- Mark domain runtimes as legacy/adapters.
- Prevent new domain IDs in `capability-catalog.json`, provider schemas, workflow engine branches, and planner outputs.

Files to protect first:

- `electron/chatr-core/kernel`
- `electron/chatr-core/execution`
- `electron/chatr-core/capabilities`
- `electron/chatr-core/connectors/manifest-schema.json`
- `src/core/intent`
- `src/core/services/CommitmentPlanner.ts`
- `src/core/capabilities/init.ts`

### Phase 1: Introduce ABI Types and Contracts

Deliverables:

- `ContextFrame`
- `IntentFrame`
- `EntityGraph`
- `GoalPlan`
- `GoalRuntimeState`
- `WorldState`
- `CapabilityRequest`
- `CapabilityContract`
- `StrategySelection`
- `ProviderManifest`
- `WorkflowGraph`
- `ExecutionReceipt`
- `PolicyDecision`
- `TrustAssessment`
- `ResourceLease`
- `AgentProposal`
- `ReconciliationDecision`
- `VerificationReport`
- `LearningEvent`

Migration:

- Keep old planner path behind compatibility adapter.
- New path runs in shadow mode and logs differences.

### Phase 2: Replace Intent Routing

Current:

- Regex/keyword routing emits domain capability IDs.

Target:

- Intent Engine emits generic intent verb, raw entity, confidence, and constraints.
- Entity Resolver handles ontology mapping.

Breaking changes:

- `intent` is no longer `food.order`, `transport.search`, or `core.flight_booking`.
- UI and IPC consumers must read `intent_frame.intent` and `entity_graph`, not old capability strings.

### Phase 3: Entity Resolver and Ontology Boundary

Deliverables:

- Entity Resolver service.
- Ontology graph store.
- Knowledge graph validation.
- Entity confidence and provenance.

Example:

```text
Raw: "Chicken Biryani"
EntityGraph: Dish -> MerchantItem -> Merchant
Kernel sees: EntityGraph + GoalPlan
Kernel does not branch on: food, restaurant, dish
```

### Phase 4: Universal Goal Planner and Goal Runtime

Current:

- `workflow-engine.cjs` has branches for transport, food, shopping, jobs, healthcare.
- Workflows are treated as the durable unit of execution.

Target:

- Goal Planner emits universal primitives:
  - DISCOVER
  - COMPARE
  - SELECT
  - AUTHENTICATE
  - AUTHORIZE
  - PAY
  - EXECUTE
  - TRACK
  - VERIFY
- Goal Runtime owns durable `GoalRuntimeState` and creates one or more workflow attempts.
- Long-running goals can be suspended, resumed, reconciled, retried, or recovered independently of UI sessions.

Migration:

- Convert existing domain workflows into test fixtures that assert generated goal plans and goal lifecycle transitions.
- Remove branch-per-domain workflow construction.

### Phase 4A: World State, Observer Loop, and Reconciliation

Current:

- Provider results are handled as direct execution responses or simulated outcomes.
- There is no explicit kernel-owned model of the external world.

Target:

- Observer Loop records provider callbacks, polling results, browser/native runtime events, device signals, approval responses, and user messages as observations.
- World State stores current known external state with provenance, freshness, confidence, and linked goal/workflow references.
- Reconciliation Engine compares expected state, observed state, provider receipts, and verification requirements before deciding to continue, retry, recover, suspend, request human assist, or complete.

Migration:

- Wrap current provider responses in observation envelopes.
- Add reconciliation decisions in shadow mode before changing execution behavior.
- Require every long-running capability to declare observation and recovery behavior in its provider manifest.

### Phase 4B: Event Bus and Kernel Scheduler

Current:

- Async events are implicit or provider-specific.
- No scheduler boundary owns delayed checks or restart-safe resume.

Target:

- Kernel Event Bus carries typed events for goal lifecycle, provider observations, approvals, timeouts, retries, policy decisions, and verification.
- Kernel Scheduler persists delayed jobs and resume triggers.
- Suspended workflows resume from durable `GoalRuntimeState`, not from domain code or UI state.

Migration:

- Add event envelopes and persistence behind existing execution calls.
- Move retry timers, tracking polls, and provider callbacks behind scheduler-owned commands.
- Add restart tests that stop the app mid-goal and verify the same goal resumes correctly.

### Phase 4C: Kernel Services

Current:

- Identity, security, policy, permissions, secrets, trust, telemetry, audit, cache, and resource decisions are partial or scattered.
- Provider Intelligence is at risk of becoming a catch-all for OS concerns.

Target:

- Identity Service owns user, provider account, passkey, OAuth/OIDC, enterprise SSO, and external identity references.
- Security Service and Policy Service gate risky or irreversible actions.
- Permission Manager tracks user, device, provider, organization, and policy grants.
- Secrets Manager provides scoped credential references only.
- Trust Service computes provider trust from evidence.
- Resource Manager leases scarce resources before execution.
- Audit Service records durable action evidence.
- Telemetry Service measures reliability, latency, recovery, and user-visible outcomes.
- Cache Manager handles freshness-aware reuse without pretending cache is verified reality.

Migration:

- Extract existing policy, auth, session, telemetry, and cache logic into service interfaces.
- Require service records in workflow attempts before external execution.
- Add resource lease checks before browser/native/model/device use.
- Add audit receipts for policy decisions, provider execution, verification, and recovery.

### Phase 5: Capability Resolver, Strategy Resolver, and Provider Intelligence

Current:

- Capability IDs encode domain.
- Execution runtime statically maps connector categories.
- Strategy engine prioritizes browser sessions before APIs.
- Strategy is mixed into provider choice or user phrasing.

Target:

- Capability Resolver selects universal capability providers based on entity support and context.
- Strategy Resolver emits explicit `StrategySelection` records before provider ranking.
- Provider Intelligence ranks by latency, reliability, cost, policy, API availability, native app availability, browser availability, permissions, user preference, and execution memory.
- Provider Intelligence consumes strategy, trust, policy, identity, permission, and resource records; it does not own those services.
- Execution policy order is API -> Native App -> Browser Runtime -> Human Assist.

Breaking changes:

- Provider manifests must use ABI v0.9 RC.
- Provider categories become display/marketplace metadata, not kernel routing keys.
- `executionMethods` becomes `execution_modes`.
- Long-running provider capabilities must declare observation, timeout, resume, and recovery semantics.
- Providers must declare strategy support, resource profile, and audit evidence support.
- Providers must declare supported capability contract versions.

### Phase 6: Schema-Driven UI

Current:

- Generic widgets exist, but registry and contracts still contain domain widget imports and domain examples.

Target:

- Renderer consumes `chatr.ui_schema.v0_9_rc`.
- Widgets are generic primitives only.
- Domains appear only as labels or entity data in schema payloads.

Migration:

- Remove domain imports from `src/core/workflow-ui/WidgetRegistry.ts`.
- Keep `src/components/workflow-ui/widgets` as generic renderer primitives.
- Replace workflow-specific widget payloads with JSON Schema plus uiSchema.

### Phase 7: Execution Memory and Learning

Current:

- Execution memory exists but is keyed by intent/capability strings.
- Personal preferences include domain categories.

Target:

- Memory keys use provider, entity class, capability primitive, goal pattern, verification result, and user-confirmed preference.
- Learning loop creates validated events and improves resolver/provider ranking.
- Execution memory records preferred provider/mode choices only after reconciliation and verification, not merely after dispatch.

### Phase 8: Acceptance and Removal

Exit criteria:

- Legacy domain planner disabled.
- Legacy domain capabilities removed from kernel registration.
- Architecture lint passes.
- Acceptance examples all use one pipeline.

## Old to New Mapping

| Current | Target |
| --- | --- |
| `food.search` | `DISCOVER` with entity support from provider manifest |
| `food.order` | `EXECUTE` plus optional `PAY`, `TRACK`, `VERIFY` |
| `transport.search` | `DISCOVER` for an ontology entity |
| `transport.book` | `SELECT` -> `AUTHORIZE` -> `EXECUTE` -> `VERIFY` |
| `shopping.search` | `DISCOVER` |
| `shopping.purchase` | `SELECT` -> `PAY` -> `EXECUTE` -> `TRACK` -> `VERIFY` |
| `healthcare.search_doctors` | `DISCOVER` |
| `healthcare.book_appointment` | `SCHEDULE` or `EXECUTE` based on provider manifest |
| `core.flight_booking` | `BOOK` intent plus EntityGraph and GoalPlan |
| `core.hotel_booking` | `BOOK` intent plus EntityGraph and GoalPlan |

## Acceptance Examples in Target ABI

| Request | IntentFrame | EntityGraph examples | Goal primitives |
| --- | --- | --- | --- |
| Order Chicken Biryani | `ORDER`, entity `Chicken Biryani` | `Dish`, `MerchantItem`, `Merchant` | DISCOVER, COMPARE, SELECT, AUTHENTICATE, PAY, EXECUTE, TRACK, VERIFY |
| Book Taj Hotel | `BOOK`, entity `Taj Hotel` | `Accommodation`, `Merchant`, `Reservation` | DISCOVER, COMPARE, SELECT, AUTHENTICATE, PAY, EXECUTE, VERIFY |
| Book Flight to Dubai | `BOOK`, entity `Flight to Dubai` | `TransportLeg`, `Destination`, `Reservation` | DISCOVER, COMPARE, SELECT, AUTHENTICATE, PAY, EXECUTE, TRACK, VERIFY |
| Pay Electricity Bill | `PAY`, entity `Electricity Bill` | `Bill`, `ServiceAccount`, `Payee` | DISCOVER, AUTHENTICATE, FETCH, AUTHORIZE, PAY, VERIFY |
| Renew Passport | `RENEW`, entity `Passport` | `IdentityDocument`, `GovernmentService`, `Appointment` | DISCOVER, AUTHENTICATE, FETCH, COLLECT_INPUT, PAY, EXECUTE, TRACK, VERIFY |
| Transfer INR 5000 | `TRANSFER`, entity `INR 5000` | `Money`, `Account`, `Recipient` | AUTHENTICATE, AUTHORIZE, TRANSFER, VERIFY |
| Book Doctor Appointment | `BOOK`, entity `Doctor Appointment` | `Appointment`, `PersonOrService`, `Merchant` | DISCOVER, COMPARE, SELECT, SCHEDULE, VERIFY |
| Reserve Movie Tickets | `RESERVE`, entity `Movie Tickets` | `Ticket`, `Event`, `Venue` | DISCOVER, COMPARE, SELECT, PAY, EXECUTE, VERIFY |

## Breaking Changes

| Area | Change | Impact |
| --- | --- | --- |
| IPC | `kernel:intent:process` response changes from old `intent` string to ABI frames. | Desktop UI consumers must update parsing. |
| Planner | No domain capability IDs emitted. | Existing tests and fallback UI must stop expecting `core.flight_booking`, `food.order`, etc. |
| Capability catalog | Domain IDs removed. | Providers must declare universal capabilities plus supported entities. |
| Capability contracts | Capabilities gain independent contract versions. | Provider manifests and capability requests must declare supported versions. |
| Workflow engine | Hardcoded domain branches removed. | Existing domain workflows become compatibility adapters or provider fixtures. |
| Provider manifests | Schema version changes to ABI v0.9 RC. | Existing connector folders need migration. |
| UI widgets | Domain widget imports removed. | UI must render schema primitives. |
| Memory | Preference keys change from domain strings to provider/entity/capability keys. | Existing memory migration required. |
| Goal runtime | Workflow state no longer represents the durable goal. | Callers must track `GoalRuntimeState` and workflow attempt IDs. |
| Async events | Provider callbacks, timers, and browser/native observations flow through Event Bus. | Existing direct callbacks need adapter wrappers. |
| Recovery | Execution completion requires observation, reconciliation, and verification where required. | Old "provider returned success" paths may remain pending until observed. |
| Strategy | Provider selection requires `StrategySelection` between capability and provider. | Existing provider ranking must accept explicit strategy inputs. |
| Kernel services | Identity, policy, trust, permissions, secrets, resources, audit, telemetry, and cache move behind service interfaces. | Existing direct session, credential, resource, and policy access must be wrapped. |
| Agents | Agent outputs are proposals only. | Any future agent executor must route through policy and kernel execution. |
| Tests | Regex/planner tests replaced with ABI and acceptance tests. | CI will change shape. |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Regression in current demo flows | High | High | Run old and new planner in shadow mode until parity is understood. |
| Ontology resolver ambiguity | High | Medium | Require confidence, provenance, clarification, and knowledge graph validation. |
| Provider manifest migration churn | Medium | High | Build a manifest migrator and validator before runtime cutover. |
| UI breakage from widget cleanup | Medium | Medium | Keep generic primitives and add schema renderer behind feature flag. |
| Browser execution safety | Medium | High | Enforce execution policy and approval gates before browser runtime. |
| Overfitting acceptance examples | Medium | High | Add architecture lint and randomized entity fixtures. |
| Memory migration loss | Medium | Medium | Keep old memory read-only and migrate progressively. |
| Provider ranking mistakes | Medium | High | Use execution memory, reliability thresholds, and verification feedback. |
| Long-running goal loss after restart | High | High | Persist `GoalRuntimeState`, scheduler jobs, observations, and workflow attempt state before external execution. |
| Provider state disagreement | High | High | Require reconciliation decisions before completion and add provider-specific observation freshness rules. |
| Event ordering bugs | Medium | High | Use monotonic event sequence IDs, idempotency keys, and reconciliation over direct callback mutation. |
| Provider trust mistakes | Medium | High | Compute trust in Trust Service using evidence, not provider self-claims. |
| Resource starvation under concurrent goals | High | High | Require resource leases and scheduler priorities before external execution. |
| Credential leakage | Medium | High | Route all credentials through Secrets Manager and scoped identity references. |
| Agent overreach | Medium | High | Enforce proposal-only agent contract and policy checks before execution. |

## Implementation Roadmap

1. Add architecture lint and CI guard.
2. Add ADR governance check for ABI-affecting changes.
3. Execute `CHATR Kernel v0.9 RC Validation`.
4. Add ABI type definitions and validators.
5. Add capability contract validators.
6. Add provider manifest ABI validator and migration report.
7. Build ContextFrame aggregator.
8. Replace Electron planner with Intent Engine shadow path.
9. Build Entity Resolver boundary and ontology adapter.
10. Build Goal Planner with primitive templates.
11. Build durable Goal Runtime and `GoalRuntimeState` store.
12. Add Event Bus and Kernel Scheduler.
13. Add Observer Loop and World State store.
14. Add Reconciliation Engine and recovery decisions.
15. Build Kernel Services: Identity, Security, Policy, Resource, Secrets, Permission, Audit, Telemetry, Cache, and Trust.
16. Build Capability Resolver, Strategy Resolver, and Provider Intelligence.
17. Replace Workflow Engine domain branches with graph composer.
18. Build schema-driven UI renderer.
19. Migrate execution memory.
20. Add learning event loop.
21. Add extension SDK validators for provider, policy, observer, schema, agent, and ontology packs.
22. Add acceptance suite for the eight required requests.
23. Add restart, suspension, async event, provider disagreement, recovery, service-boundary, and resource-pressure tests.
24. Remove legacy domain runtimes from core registration.

## Required Test Suite

Architecture tests:

- No forbidden domain terms in kernel runtime code.
- No capability IDs with industry prefixes.
- No provider category maps in execution runtime.
- No workflow branches by domain.
- No UI imports of vertical widgets.

ABI tests:

- Intent Engine returns only `IntentFrame`.
- Entity Resolver returns valid `EntityGraph`.
- Goal Planner returns valid primitive-only `GoalPlan`.
- Goal Runtime persists valid `GoalRuntimeState`.
- Capability requests include supported capability contract versions.
- Strategy Resolver returns valid `StrategySelection`.
- Workflow Generator returns primitive-only `WorkflowGraph`.
- Provider manifests validate at bootstrap.
- Event Bus accepts typed envelopes and rejects unknown event shapes.
- Kernel Scheduler persists delayed jobs and resumes them after restart.
- Observer Loop writes observations with provenance, freshness, and goal/workflow links.
- Reconciliation Engine returns explicit continue, retry, recover, suspend, human-assist, verify, or complete decisions.
- Trust Service computes `TrustAssessment` from evidence.
- Resource Manager requires leases before scarce resource use.
- Secrets Manager prevents raw credentials from reaching workflow nodes.
- Policy Service emits `PolicyDecision` before consequential actions.
- Agent proposals cannot execute without kernel policy and execution routing.

Acceptance tests:

- Order Chicken Biryani
- Book Taj Hotel
- Book Flight to Dubai
- Pay Electricity Bill
- Renew Passport
- Transfer INR 5000
- Book Doctor Appointment
- Reserve Movie Tickets

All acceptance tests must assert the same pipeline shape, with variation only in ontology entities, provider candidates, context, and schemas.

Autonomous execution tests:

- Stop and restart during selection, payment, tracking, and verification; the same durable goal resumes.
- Provider returns success but world observation disagrees; reconciliation prevents premature completion.
- Provider callback arrives before scheduled poll; duplicate events remain idempotent.
- User approval is delayed; goal suspends and resumes without domain code.
- Browser runtime fails after API/native providers are unavailable; recovery path follows policy order and records the reason.
- Fifteen concurrent goals contend for browser sessions, providers, model calls, and scheduler slots; Resource Manager prioritizes without domain branches.
- Unknown low-trust provider requires approval while a high-trust verified provider can proceed under policy.
- Four distinct intents traverse the same kernel pipeline with only ontology entities, strategies, context, and provider manifests changing.
