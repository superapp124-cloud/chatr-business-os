# ADR-001: Event Sourcing

## Status
Accepted

## Reason
The UI layer historically accumulated massive complexity by trying to manage the state of multiple simultaneous intents (e.g., creating a meeting while moving a task). React components were interpreting backend logic, leading to race conditions and phantom state mutations.

## Decision
We decided to adopt pure Event Sourcing for the UI. The React application will no longer contain any business state. Instead, the backend `Intent Journal` emits a stream of immutable events (e.g., `KERNEL.OBSERVATION.CREATED`, `KERNEL.CONTEXT.RESOLVED`). 

## Consequences
- **Pros:** The UI is purely deterministic (`UI = f(Event Stream)`). It eliminates synchronization bugs entirely. Replay and Time Travel debugging become natively supported simply by changing the event cursor.
- **Cons:** It requires a robust `Projection Store` in the frontend to reduce the event stream into readable UI state. Capability developers must never attempt to build React UI directly; they must only emit Events.
