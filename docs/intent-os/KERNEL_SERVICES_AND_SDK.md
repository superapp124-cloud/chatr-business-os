# Kernel Services, Strategy, and Extension SDK

Date: 2026-07-15
Status: CHATR Architecture v1.0 frozen service contract; Kernel ABI v0.9 RC

## Purpose

The autonomous kernel needs shared operating-system services in addition to execution components. These services must not be scattered across Provider Intelligence, provider adapters, workflow nodes, or UI code.

Provider Intelligence ranks providers. Kernel services govern identity, security, policy, resources, secrets, permissions, audit, telemetry, cache, trust, and extension boundaries.

## Kernel Services

| Service | Responsibility | Must Not Do |
| --- | --- | --- |
| Identity Service | Resolve the user, account, organization, passkey, OAuth subject, enterprise SSO subject, or government identity reference. | Choose providers or classify industries. |
| Security Service | Enforce execution safety, isolation, data handling, and high-risk action gates. | Store provider credentials directly. |
| Policy Service | Evaluate approval, region, privacy, risk, spend, compliance, and automation policies. | Encode domain-specific workflows. |
| Resource Manager | Allocate scarce resources such as browser sessions, native app sessions, model calls, device sensors, network budget, storage, and scheduler slots. | Let providers reserve resources implicitly. |
| Secrets Manager | Store and retrieve tokens, keys, passkeys, payment instrument references, and provider credentials. | Expose raw secrets to workflow nodes. |
| Permission Manager | Track user-granted, device, provider, organization, and policy permissions. | Assume permission from provider availability. |
| Audit Service | Record durable action, approval, policy, identity, provider, and verification trails. | Replace telemetry or analytics. |
| Telemetry Service | Measure latency, reliability, errors, recovery paths, resource use, and user-visible outcomes. | Decide goal completion. |
| Cache Manager | Cache provider, ontology, schema, and observation data with freshness and invalidation rules. | Treat cached state as verified reality. |
| Trust Service | Compute provider, agent, adapter, and execution-mode trust from evidence. | Accept trust as a static provider self-claim. |

## Capability, Strategy, Provider

The runtime selection chain is:

```text
Capability -> Strategy -> Provider -> Execution Mode
```

A capability states what must be done. A strategy states how the kernel should pursue it. A provider is only one possible executor.

Example strategies:

- fastest
- cheapest
- highest_rated
- most_trusted
- local_first
- privacy_first
- energy_efficient
- offline_first
- user_preferred
- policy_required

Strategy selection uses context, preferences, policy, trust, resource pressure, execution memory, and provider manifest data. Users may state strategy directly, but the kernel can infer strategy when the user says things like "best", "quickest", "near me", "trusted", "private", or "low cost".

## Strategy Selection Record

```json
{
  "abi": "chatr.strategy_selection.v0_9_rc",
  "goal_id": "goal_123",
  "capability": "DISCOVER",
  "strategy": "most_trusted",
  "reason": "high user preference for trusted providers and medium action risk",
  "inputs": {
    "policy_refs": ["policy_1"],
    "context_refs": ["ctx_1"],
    "memory_refs": ["mem_1"]
  }
}
```

Provider Intelligence must consume `StrategySelection`; it must not invent strategy as an unlogged side effect.

## Trust Model

Provider trust is kernel-computed from evidence. It is not a static manifest label.

Trust inputs:

- provider identity verification
- manifest signature and provenance
- historical success rate
- historical recovery rate
- policy compliance
- permission scope
- security posture
- user preference
- organization approval
- telemetry and audit history
- marketplace or enterprise attestation

Trust gates:

```text
Provider Trust Score -> Risk -> Policy Decision -> Approval Requirement -> Execution Permission
```

Example:

```text
Unknown website -> browser_runtime -> low trust -> approval required
Verified government API -> api -> high trust -> policy may allow automatic execution
```

## Identity Layer

Provider sessions are implementations of identity, not the identity model itself.

Identity Service must support:

- local CHATR user identity
- passkeys
- OAuth and OIDC subjects
- Google, Microsoft, Apple, and enterprise SSO
- government identity references
- bank identity references
- delegated organization identities
- user-to-provider account bindings

Workflow and provider code receive scoped identity references, not raw credentials.

## Resource Manager

The Resource Manager is required before CHATR can operate like an OS under load.

Resources include:

- browser sessions
- native app sessions
- provider rate-limit budget
- model calls
- scheduler slots
- network budget
- device sensors
- storage
- cache capacity
- background execution budget

Resource allocation must use leases:

```json
{
  "abi": "chatr.resource_lease.v0_9_rc",
  "lease_id": "lease_123",
  "goal_id": "goal_123",
  "resource": "browser_session",
  "quantity": 1,
  "priority": "normal",
  "expires_at": "2026-07-15T00:10:00Z"
}
```

No provider may allocate scarce resources without a lease.

## Knowledge Separation

These stores are separate:

| Store | Purpose |
| --- | --- |
| Ontology | Defines entity types, relationships, and classification vocabulary. |
| Knowledge | Stores validated facts and graph relationships. |
| Memory | Stores user preferences, execution outcomes, and learned provider behavior. |
| World State | Stores current observed reality for active or historical goals. |

Ontology is not memory. Memory is not World State. World State is not a knowledge graph.

## Agent Boundary

Agents may assist planning, observation, verification, recovery, and policy analysis, but they never execute directly.

Required agent flow:

```text
Agent -> Observation/Proposal -> Policy Check -> Kernel Decision -> Execution
```

Agent proposal shape:

```json
{
  "abi": "chatr.agent_proposal.v0_9_rc",
  "agent_id": "agent.recovery",
  "goal_id": "goal_123",
  "proposal_type": "recovery_strategy",
  "recommended_action": "switch_provider",
  "confidence": 0.82,
  "evidence_refs": ["obs_1", "receipt_1"],
  "requires_policy_check": true
}
```

The kernel owns final transitions, resource leases, provider execution, policy decisions, and goal completion.

## CHATR Extension SDK

The SDK should let third parties add providers, policies, schema renderers, observers, agents, and enterprise adapters without changing kernel runtime code.

SDK packages may declare:

- provider manifests
- provider adapters
- policy modules
- observer adapters
- UI schema extensions
- agent proposals
- enterprise identity adapters
- ontology packs
- test fixtures

SDK packages must not:

- register domain runtimes
- bypass Capability Resolver
- execute outside kernel policy
- write directly to GoalRuntimeState
- mark goals complete directly
- access secrets without scoped grants

## Versioning Policy

Every public contract is versioned independently.

| Contract | Version Example |
| --- | --- |
| Kernel ABI | `chatr.kernel.v0_9_rc` |
| Context Frame | `chatr.context.v0_9_rc` |
| Intent Frame | `chatr.intent.v0_9_rc` |
| Entity Graph | `chatr.entity_graph.v0_9_rc` |
| Ontology Schema | `chatr.ontology.v0_9_rc` |
| Knowledge Schema | `chatr.knowledge.v0_9_rc` |
| Memory Schema | `chatr.memory.v0_9_rc` |
| World State | `chatr.world_state.v0_9_rc` |
| Goal Plan | `chatr.goal_plan.v0_9_rc` |
| Goal Runtime State | `chatr.goal_runtime_state.v0_9_rc` |
| Capability Contract | `chatr.capability_contract.v0_9_rc` |
| Capability Catalog | `chatr.capability_catalog.v0_9_rc` |
| Provider Manifest | `chatr.provider_manifest.v0_9_rc` |
| Workflow Graph | `chatr.workflow_graph.v0_9_rc` |
| UI Schema | `chatr.ui_schema.v0_9_rc` |
| Policy Schema | `chatr.policy.v0_9_rc` |
| Event Schema | `chatr.event.v0_9_rc` |
| Observation Schema | `chatr.observation.v0_9_rc` |
| Verification Report | `chatr.verification_report.v0_9_rc` |
| Agent Proposal | `chatr.agent_proposal.v0_9_rc` |
| Resource Lease | `chatr.resource_lease.v0_9_rc` |
| Trust Assessment | `chatr.trust_assessment.v0_9_rc` |
| Strategy Selection | `chatr.strategy_selection.v0_9_rc` |

Compatibility rules:

- Patch versions may add optional fields.
- Minor versions may add capabilities, strategies, event types, or optional services.
- Major versions may break contracts only through explicit migration adapters.
- Kernel ABI v1.0 requires implementation evidence, not additional architecture documents.

## v1.0 Evidence Gate

Architecture is complete enough to begin implementation as v0.9 RC. ABI v1.0 should freeze only after:

- durable `GoalRuntimeState` survives process restart
- Event Bus carries typed lifecycle events
- Observer Loop and Reconciliation Engine recover from at least one provider failure
- schema-driven UI renders multiple domains without domain widgets
- at least four distinct intents traverse the same kernel pipeline with only ontology entities and provider manifests changing
- kernel services enforce identity, policy, trust, resource leases, permissions, secrets, audit, telemetry, and cache boundaries
