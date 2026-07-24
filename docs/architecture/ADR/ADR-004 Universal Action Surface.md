# ADR-004: Universal Action Surface

## Status
Accepted

## Reason
Historically, each capability (e.g., Calendar, Tasks) implemented its own bespoke confirmation modals or chat widgets. This led to fragmented UX and forced the user to relearn interaction paradigms for every feature.

## Decision
We established a single `Universal Action Surface`. The UI layer is completely ignorant of business domain objects. Capability modules push generic `Entities` (Who, When, Where) and an `Action` to the Kernel. The Kernel dictates exactly how these are rendered to the user.

## Consequences
- **Pros:** A perfectly uniform user experience across the entire product ecosystem (Tasks, Meetings, Documents). It also establishes a central choke point where the `Policy Engine` can universally enforce rules like "Confirm before execution".
- **Cons:** Constrains capability developers. They cannot build highly custom UI workflows. They must map their domain problems into generic Entities and Actions.
