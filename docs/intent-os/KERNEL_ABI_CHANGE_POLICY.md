# Kernel ABI Change Policy

Date: 2026-07-15
Status: mandatory governance policy for CHATR Architecture v1.0

## Executive Decision

CHATR Architecture v1.0 is approved and frozen.

Kernel ABI remains v0.9 RC until validation evidence satisfies the Kernel ABI v1.0 freeze gate.

Current program phase: Kernel Validation and Implementation.

## Scope

This policy applies to changes that affect:

- Kernel ABI objects
- capability contracts
- provider manifest ABI
- event schema
- workflow schema
- UI schema
- policy schema
- observation schema
- verification schema
- kernel services
- extension SDK contracts
- compatibility rules

## Required Approval

Any change in scope requires:

1. An accepted ADR.
2. A migration strategy.
3. Backward compatibility analysis, or explicit major-version justification.
4. Updated validation tests.
5. Approval from the Architecture Board.

## Versioning Rules

Patch versions may:

- add optional fields
- clarify documentation
- add non-breaking validation warnings

Minor versions may:

- add optional ABI objects
- add optional schema fields
- add capability contract versions
- add event types
- add provider manifest fields that fail open only when explicitly optional

Major versions may:

- remove fields
- rename fields
- change required semantics
- change lifecycle states
- change provider compatibility rules
- change kernel service ownership boundaries

Major-version changes require an accepted ADR and a migration plan before implementation begins.

## Compatibility Requirements

Every ABI change must state:

- previous version
- proposed version
- affected objects
- affected providers
- affected workflow graphs
- affected UI schemas
- affected stored state
- migration path
- rollback path
- validation tests

## Architecture Board Gate

The Architecture Board may approve an ABI change only when:

- the issue cannot be solved within the frozen architecture
- the change does not introduce domain-specific runtime concepts
- the change preserves `Capability -> Strategy -> Provider -> Execution`
- the change preserves durable Goal Runtime ownership
- the change preserves verification-gated completion
- the change preserves kernel-owned trust, policy, resources, identity, permissions, secrets, audit, telemetry, and cache boundaries

## Prohibited Shortcuts

Do not:

- add a new runtime domain to solve one provider problem
- hardcode a provider route to ship faster
- bypass capability contracts
- mark provider dispatch as goal completion
- expose secrets to workflow nodes
- let agents execute directly
- mutate Kernel ABI without ADR approval
- use implementation urgency as architecture justification

## Pull Request Requirement

Any pull request changing ABI or contract surfaces must include:

```text
ADR:
Migration strategy:
Backward compatibility:
Validation tests:
Architecture Board approval:
```

Pull requests without these fields must fail review.
