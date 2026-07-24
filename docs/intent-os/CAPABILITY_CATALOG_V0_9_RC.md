# Capability Catalog v0.9 Release Candidate

Date: 2026-07-15
Status: release candidate capability catalog for CHATR Architecture v1.0

## Rule

Capability IDs are universal primitives. They must not encode industries, verticals, providers, or entity names.

Allowed: `DISCOVER`, `PAY`, `VERIFY`

Not allowed: `food.search`, `flight_booking`, `healthcare.book_appointment`, `government.apply`, `shopping.purchase`

Capabilities are not strategies. The selection chain is:

```text
Capability -> Strategy -> Provider -> Execution Mode
```

For example, `DISCOVER` is a capability. `fastest`, `cheapest`, `most_trusted`, and `privacy_first` are strategies for pursuing that capability.

## Catalog

| Capability | Contract Version | Inputs | Outputs | Approval Default | Notes |
| --- | --- | --- | --- | --- | --- |
| DISCOVER | 1.0.0 | EntityGraph, ContextFrame, constraints | Candidate options | none | Finds possible providers, records, merchants, services, resources, slots, or artifacts. |
| FETCH | 1.0.0 | Entity reference, provider reference, context | Current state or object | none | Retrieves known data. |
| COMPARE | 1.0.0 | Candidate options, preferences, constraints | Ranked options | none | Ranking is explainable and context-aware. |
| SELECT | 1.0.0 | Candidate options, selection policy | Selected option | user when ambiguous | May be automatic only when policy permits. |
| COLLECT_INPUT | 1.0.0 | JSON Schema, current context | Structured fields | user | Gathers missing required fields. |
| AUTHENTICATE | 1.0.0 | Provider reference, auth requirement | Session or token reference | user | Uses existing identity where available. |
| AUTHORIZE | 1.0.0 | Action summary, risk, policy | Approval receipt | user | Required for irreversible/high-risk actions. |
| PAY | 1.0.0 | Amount, payee, instrument, policy | Payment receipt | user | Covers payment initiation only. |
| TRANSFER | 1.0.0 | Amount/value, source, target, policy | Transfer receipt | user | For value movement between accounts/stores. |
| EXECUTE | 1.0.0 | Selected option, provider, context | Execution receipt | depends on risk | Commits the provider action. |
| OBSERVE | 1.0.0 | Goal state, provider receipt, observation policy | Observation event | none | Reads external reality after or during execution. |
| RECONCILE | 1.0.0 | GoalPlan, WorldState, policy | Reconciliation decision | none | Decides continue, retry, wait, recover, switch, verify, or stop. |
| RECOVER | 1.0.0 | Failure state, recovery policy | Recovery receipt | depends on action | Performs kernel-owned recovery after partial failure. |
| TRACK | 1.0.0 | Execution receipt, provider | Status stream/snapshot | none | Optional if provider supports tracking. |
| VERIFY | 1.0.0 | Execution receipt, expected outcome | Verification report | none | Required before marking real-world goal complete. |
| SUSPEND | 1.0.0 | Goal state, wake condition | Suspended goal receipt | none | Pauses a long-running goal until a condition is met. |
| RESUME | 1.0.0 | Suspended goal receipt, wake event | Resumed goal state | none | Continues a durable goal after time/event/user/provider wakeup. |
| CANCEL | 1.0.0 | Execution receipt, provider policy | Cancellation receipt | user | Must be compensating, not a database rollback. |
| COMMUNICATE | 1.0.0 | Message schema, recipients, channel | Communication receipt | depends on audience | Covers send/receive messaging. |
| SCHEDULE | 1.0.0 | Time object, participants/resources | Schedule receipt | user when external | Creates or updates time-bound commitments. |
| STORE | 1.0.0 | Artifact, destination, retention policy | Storage receipt | none | Writes durable artifacts. |
| NOTIFY | 1.0.0 | Recipient, message, channel | Notification receipt | none | Informs user or actor. |
| LEARN | 1.0.0 | Correction, evidence, validation target | Learning event | none | Records improvement signals after validation. |

## Capability Contract Versioning

Each capability has an independently versioned contract:

```text
Capability -> Contract Version -> Input Schema -> Output Schema -> Policy Requirements -> Strategy Support -> Expected Observations -> Verification Rules
```

Capability contract versions allow the catalog to evolve without changing the Kernel ABI.

## Capability Request

```json
{
  "abi": "chatr.capability_request.v0_9_rc",
  "capability": "DISCOVER",
  "capability_contract_version": "1.0.0",
  "entity_ref": "entity_1",
  "input_schema": {},
  "constraints": {},
  "context_requirements": ["gps", "permissions"],
  "risk": "low"
}
```

## Policy Defaults

| Risk | Examples | Required Gate |
| --- | --- | --- |
| low | search, fetch, compare | no approval |
| medium | external schedule, message send, reservation hold | confirmation |
| high | payment, transfer, irreversible submission, identity action | explicit authorization |
| restricted | regulated/high-value action | policy + explicit authorization + verification |

Risk is determined by policy and provider manifest data, not by industry name.

## Strategy Defaults

| Strategy | Meaning |
| --- | --- |
| fastest | Prefer lower observed latency when policy and trust allow. |
| cheapest | Prefer lower user/provider cost when quality constraints are met. |
| highest_rated | Prefer higher quality signals from provider, memory, or knowledge. |
| most_trusted | Prefer providers with stronger trust evidence and fewer approval gates. |
| local_first | Prefer local device/native execution before remote providers when policy allows. |
| privacy_first | Prefer lower data exposure, smaller permission scopes, and stronger data handling policies. |
| energy_efficient | Prefer lower device, network, or model resource cost. |
| offline_first | Prefer cached, local, or native resources that can continue without network. |
| user_preferred | Prefer providers or methods explicitly chosen by the user. |
| policy_required | Follow an organization, legal, security, or compliance requirement. |

Strategies are versioned policy inputs, not provider IDs.

## Legacy Mapping

| Legacy Capability | New Capability Sequence |
| --- | --- |
| `food.search` | DISCOVER |
| `food.order` | SELECT -> AUTHORIZE -> PAY -> EXECUTE -> OBSERVE -> RECONCILE -> TRACK -> VERIFY |
| `shopping.search` | DISCOVER |
| `shopping.purchase` | SELECT -> AUTHORIZE -> PAY -> EXECUTE -> OBSERVE -> RECONCILE -> TRACK -> VERIFY |
| `transport.search` | DISCOVER -> COMPARE |
| `transport.book` | SELECT -> AUTHORIZE -> PAY -> EXECUTE -> OBSERVE -> RECONCILE -> TRACK -> VERIFY |
| `healthcare.search_doctors` | DISCOVER -> COMPARE |
| `healthcare.book_appointment` | SELECT -> SCHEDULE -> OBSERVE -> VERIFY |
| `jobs.post` | COLLECT_INPUT -> AUTHORIZE -> EXECUTE -> VERIFY |
| `workflow.invoice_processing` | FETCH -> EXECUTE -> STORE -> NOTIFY -> VERIFY |

## CI Guard

The catalog should be rejected if:

- a capability ID contains `.`
- a capability ID contains an industry term
- a capability ID names a provider
- a capability has no input/output contract
- a capability has no contract version
- a high-risk capability lacks an approval policy
