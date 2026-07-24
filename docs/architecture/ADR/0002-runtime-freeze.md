# ADR 0002: Runtime Freeze

## Status
Accepted

## Context
The CHATR OS Kernel architecture is now mature enough to execute enterprise capabilities strictly via metadata (EDL). To prevent the Kernel from accumulating domain-specific logic over time, we must lock down the Runtime contract. The Runtime is intended to be the generic, predictable engine that powers the ecosystem.

## Decision
We are freezing the CHATR OS Runtime architecture and its public API. 

1. **API Changes Require ADR:** The Public Runtime API is frozen. Any changes or additions to this API require a formal Architectural Decision Record (ADR).
2. **Strict Engine Boundaries:** Engine boundaries (e.g. Object Runtime, Query Engine, Policy Engine, Evidence Builder) cannot be bypassed.
3. **No Domain Logic:** Domain-specific runtime methods are strictly prohibited. The Runtime must remain domain-agnostic.
4. **Extension Mechanism:** Capability Packs (EDL) are the sole extension mechanism for business logic.
5. **Conformance Requirement:** Any changes to the Runtime infrastructure require full approval from the Kernel Conformance Suite.

## Consequences
- The Runtime remains "boring" and highly predictable.
- Engineering effort shifts from building kernel infrastructure to defining capability packs and migrating modules.
- New enterprise requirements must be met by evolving the EDL rather than writing bespoke code.
