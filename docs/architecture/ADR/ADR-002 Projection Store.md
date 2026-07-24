# ADR-002: Projection Store

## Status
Accepted

## Reason
With the adoption of Event Sourcing (ADR-001), the React frontend needed a way to translate raw kernel events (`OBSERVATION.CREATED`, `CONTEXT.RESOLVED`) into concrete state that components could render (e.g. `Current Understanding`).

## Decision
We implemented a `Projection Store` (`src/core/intent/projectionStore.ts`). It sits between the Event Router and React. It acts as a deterministic reducer: it ingests the stream of events and calculates the active `Understanding` and `Action Surface`. 

## Consequences
- **Pros:** React components become entirely stateless ("dumb"). They simply subscribe to `projectionStore.getState()`. Testing UI logic becomes trivial as it reduces to testing plain TypeScript reducer functions. Time-travel debugging is natively supported by caching events and re-running the projection.
- **Cons:** Any new Kernel Event requires updating the Projection Store's reducer logic so the UI understands how to map it.
