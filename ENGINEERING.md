# CHATR Engineering Guidance

This document governs how the CHATR Kernel operates, how capabilities are certified, and the mandatory standards every pull request must meet.

*Note: `GENESIS.md` is the immutable constitution. `ENGINEERING.md` is the evolving engineering guide.*

## Capability Certification Levels

Capabilities are no longer "certified" manually. The system automatically awards certification levels based on tested compliance.

1. **Bronze**
   - ✓ Detect (Mapped from Intent)
   - ✓ Execute (Dispatched successfully)
2. **Silver**
   - ✓ Verify (Reality Engine integration)
   - ✓ Undo (Rollback supported)
3. **Gold**
   - ✓ Offline (Operates without network)
   - ✓ Replay (Event reconstructable)
   - ✓ Retry (Fails gracefully with retry logic)
   - ✓ Telemetry (Emits rich operational metrics)
4. **Genesis Certified**
   - ✓ Dogfooded (Tested by founders)
   - ✓ Tests (Automated assertions passing)
   - ✓ Production (Verified in real-world use)

## The 5-Stage Capability Rollout Sequence

We do not build capabilities based on user requests; we build them to systematically stress the runtime.

- **Stage 1 — Local deterministic**
  *(Proves Planner, Runtime, Local Provider, Reality Engine)*
  - `core.reminder` (Reference Implementation)
  - `core.task`
  - `core.note`
  - `core.checklist`

- **Stage 2 — Human interaction**
  *(Proves Entity extraction, Time resolver, Contact resolver)*
  - `core.meeting`
  - `core.contact`
  - `core.call`

- **Stage 3 — External providers**
  *(Proves Provider abstraction)*
  - `core.email`
  - `core.calendar_event`
  - `core.document`

- **Stage 4 — Multi-step commitments**
  *(Proves retries, waiting, provider failures, reality verification)*
  - `core.expense`
  - `core.flight_booking`
  - `core.hotel_booking`

- **Stage 5 — Workflow**
  *(Proves chained commitments)*
  - `core.candidate_interview`
  - `core.follow_up`

## The Mandatory PR Checklist

Every future capability PR must answer **YES** to exactly this checklist:
1. Does it use the **Commitment Planner**?
2. Does it use the **Commitment Runtime**?
3. Does it use a **Provider**?
4. Does it use the **Reality Engine**?
5. Does it publish **Events**?
6. Does it support **Replay** (Visual timeline reconstruction)?

If any answer is "No", do not merge.

## Operational Readiness Dashboard

All engineering observation is done passively via the Event Store, Journal, and Runtime Snapshot.
The `/desktop/kernel` dashboard **must never** execute active logic or trigger Providers. It is strictly for read-only timeline reconstruction and telemetry.
