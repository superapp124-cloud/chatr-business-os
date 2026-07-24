# ADR-001: Why CHATR is Goal-Oriented instead of Workflow-Oriented

Date: 2026-07-15
Status: Accepted

## Context

Workflows are execution plans. Real user outcomes may require retries, waiting, provider callbacks, recovery, verification, or days of observation after an initial workflow attempt.

If workflow state is treated as the durable source of truth, the system cannot reliably resume long-running goals or distinguish an attempted action from a completed user objective.

## Decision

CHATR is goal-oriented. The kernel owns durable `GoalRuntimeState`. Workflows are execution attempts owned by a goal.

## Consequences

Goal Runtime becomes the durable owner of state, suspension, resume, recovery, and completion. Workflow Generator composes attempts and returns control to Goal Runtime after observation and reconciliation checkpoints.

## Migration Notes

Existing workflow state must become attempt state. Callers must track goal IDs separately from workflow IDs.
