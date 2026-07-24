# CHATR Kernel ABI v1.0

This document defines the strict Application Binary Interface (ABI) for the CHATR Intent Kernel. It specifies the stable boundaries between the Kernel, Kernel Services, and the Capability Platform.

## 1. ABI Namespaces
The CHATR Kernel ABI is divided into two strict namespaces:

### Stable ABI
Guaranteed across all `v1.x` releases. Any breaking change requires a major version bump (`v2.0`).
- **Intent Object Schema**: The core primitive, including the Lifecycle Clock.
- **Canonical Event Schema**: The structure of `createEventEnvelope`.
- **Artifact Schemas**: Facts, Evaluations, Checkpoints, Decisions.
- **Lifecycle Semantics**: Phases (`Draft`, `Active`, `Executing`, `Stewarded`, `Retired`, `Archived`) and Conditions (`Sleeping`, `WaitingPolicy`, etc.).
- **Kernel Service Contracts**: The interfaces for Observation, Verification, Policy, Execution, and Stewardship.

### Experimental ABI
May evolve rapidly to support ecosystem innovation. Does not guarantee backward compatibility.
- **Learning APIs**: Data collection and suggestion models.
- **Marketplace Metadata**: Fields in the capability manifest not required for runtime execution.
- **Developer Tooling**: Analytics, profiling, and debugging interfaces.

## 2. Version Negotiation
Capabilities and Kernel components negotiate compatibility during registration.
- **Compatibility Rule**: A capability declaring `minKernelVersion: "1.0"` can be loaded by Kernel `v1.x` and `v2.x` (if backward compatibility is maintained), but not `v0.9`.
- **Rejection**: If a capability requests an ABI version newer than the Kernel supports, the Capability Platform must cleanly reject loading it.

## 3. Capability Contract Schema (Manifest)
Capabilities are declarative contracts defined in three sections.

### Identity
```yaml
id: domain.action
version: 1.0.0
displayName: "Human Readable Name"
author: "Author Name"
license: "MIT"
category: "Productivity"
```

### Runtime Contract
```yaml
intentTypes: ["domain.action"]
permissions: ["location", "calendar"]
inputs: ["param1"]
outputs: ["result1"]
verification:
  strategy: default@1.0
stewardship:
  renewable: false
policies: ["default"]
events: ["domain.action.started"]
```

### Operational Metadata
```yaml
minKernelVersion: "1.0"
dependencies: []
securityClassification: "standard"
profile: "Transaction" # Profile defining lifecycle subset
```

## 4. Capability Profiles
Capabilities can declare a Profile to simplify their implementation footprint:
- **Transaction Profile**: Plan -> Execute -> Verify -> Steward
- **Information Profile**: Discover -> Observe
- **Monitoring Profile**: Observe -> Steward
- **Automation Profile**: Plan -> Execute -> Steward

## 5. Artifact Schemas
The following durable artifacts are guaranteed by the Stable ABI:

### Observation Fact
Produced by Observation Service. Records raw reality signals.

### Confirmed Fact
Produced by Verification Service. Confirms reality against execution attempts.

### Policy Evaluation
Produced by Policy Service. `authorizationState` (permitted/prohibited).

### Lifecycle Checkpoint
Produced by Stewardship Service. Contains `beforePhase`, `triggerType`, `afterPhase`, `transitionReason`.

### Kernel Decision
Produced by Intent Kernel. Links all the above artifacts to a central, authorized state mutation.

## 6. Architecture Freeze Governance
As of `v1.0`, the Kernel Architecture is formally frozen. The addition of new capabilities, providers, adapters, and UI experiences happens *above* the Kernel and does not require ABI changes.
