# Provider Manifest ABI v0.9 Release Candidate

Date: 2026-07-15
Status: release candidate manifest ABI for CHATR Architecture v1.0

## Purpose

Provider manifests declare what an external or local provider can do. The kernel uses manifests to resolve capabilities dynamically.

Provider manifests must not be used to create new runtime domains. A provider may support ontology entities such as `Dish`, `Bill`, `Accommodation`, `Appointment`, or `Ticket`, but the kernel treats those as data.

## Required Shape

```json
{
  "abi": "chatr.provider_manifest.v0_9_rc",
  "provider_id": "provider.example",
  "provider_version": "1.0.0",
  "display_name": "Example Provider",
  "manifest_version": "1.0.0",
  "capabilities": [],
  "trust": {},
  "resource_profile": {},
  "health_check": {},
  "compatibility": {}
}
```

## Capability Declaration

Each provider capability declares a universal capability primitive plus entity support.

```json
{
  "capability": "DISCOVER",
  "capability_contract_version": "1.0.0",
  "supported_entities": ["MerchantItem", "Appointment", "Bill"],
  "input_schema": {
    "type": "object",
    "properties": {}
  },
  "output_schema": {
    "type": "object",
    "properties": {}
  },
  "execution_modes": ["api", "native_app", "browser_runtime", "human_assist"],
  "strategy_support": ["fastest", "cheapest", "most_trusted", "privacy_first"],
  "authentication": {
    "type": "oauth2",
    "required": true
  },
  "permissions": ["location.read"],
  "rate_limits": {
    "requests_per_minute": 60,
    "burst": 10
  },
  "latency": {
    "p50_ms": 800,
    "p95_ms": 2400
  },
  "reliability": {
    "declared_success_rate": 0.95,
    "last_verified_at": "2026-07-15T00:00:00Z"
  },
  "cost": {
    "model": "free"
  },
  "policies": {
    "requires_user_approval": false,
    "allowed_regions": ["*"]
  },
  "observation": {
    "supports_polling": true,
    "supports_webhooks": false,
    "poll_interval_ms": 60000,
    "terminal_states": ["completed", "failed", "cancelled"]
  },
  "recovery": {
    "retryable_errors": ["timeout", "rate_limited", "temporary_unavailable"],
    "supports_idempotency_key": true,
    "supports_cancellation": false
  },
  "resource_profile": {
    "requires": ["network"],
    "optional": ["browser_session"],
    "max_concurrency": 4
  },
  "audit": {
    "emits_action_receipts": true,
    "emits_state_transitions": true
  }
}
```

## Field Rules

| Field | Rule |
| --- | --- |
| `abi` | Must equal `chatr.provider_manifest.v0_9_rc`. |
| `provider_id` | Stable unique provider identifier. |
| `provider_version` | Semver provider implementation version. |
| `manifest_version` | Semver manifest version. |
| `capabilities[].capability` | Must exist in Capability Catalog v0.9 RC. |
| `capabilities[].capability_contract_version` | Must be a supported contract version for that capability. |
| `strategy_support` | Declares which generic strategies the provider can support with evidence. |
| `supported_entities` | Must be ontology entity IDs. |
| `execution_modes` | Only `api`, `native_app`, `browser_runtime`, `human_assist`. |
| `authentication` | Must declare auth type and whether it is required. |
| `permissions` | Must be explicit and least-privilege. |
| `rate_limits` | Must be present for API/native execution modes. |
| `latency` | Must include at least `p50_ms` and `p95_ms`. |
| `reliability` | Must include declared or measured success signal. |
| `policies` | Must declare approval and region constraints. |
| `observation` | Must declare how external state can be observed after execution. |
| `recovery` | Must declare retry, idempotency, cancellation, and compensation support. |
| `resource_profile` | Must declare scarce resources, concurrency limits, and background execution needs. |
| `audit` | Must declare action receipt and transition evidence support. |

Provider manifests may provide trust evidence, but they do not assign their own trust score. The kernel Trust Service computes `TrustAssessment`.

## Bootstrap Validation

On kernel boot:

1. Load manifests from configured provider directories.
2. Validate ABI version.
3. Validate each declared capability against the capability catalog.
4. Validate capability contract versions.
5. Validate entity names against ontology registry.
6. Validate schemas.
7. Validate execution modes and required auth fields.
8. Validate strategy support declarations.
9. Validate observation and recovery declarations.
10. Validate resource profile and audit declarations.
11. Reject providers with missing policies, rate limits, latency, reliability, observation, recovery, resources, or audit metadata.
12. Register provider candidates into Provider Intelligence.

Invalid manifests fail closed. They must not partially register.

## Legacy Migration

Current connector fields should migrate as follows:

| Current | ABI v0.9 RC |
| --- | --- |
| `id` | `provider_id` |
| `version` | `provider_version` |
| `capabilities: ["food.search"]` | `capabilities[].capability = "DISCOVER"` plus `supported_entities` |
| `category` | Marketplace metadata only, not kernel routing |
| `executor` | `execution_modes` |
| `estimatedLatency` | `latency.p50_ms` and `latency.p95_ms` |
| `priority` | Replaced by Provider Intelligence score inputs |
| `selectors` | Browser runtime adapter metadata |
| `workflowTemplates` | Provider adapter metadata, never kernel workflow graph |

## Execution Mode Policy

Provider Intelligence must evaluate modes in this order:

1. `api`
2. `native_app`
3. `browser_runtime`
4. `human_assist`

If an earlier mode is unavailable, the selection record must explain why.
