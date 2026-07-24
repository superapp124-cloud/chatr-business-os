# ADR-005: Why Goal Runtime Exists

Date: 2026-07-15
Status: Accepted

## Context

Autonomous execution requires goals to survive process restarts, user delays, provider delays, retries, and external state changes.

## Decision

Goal Runtime is a first-class kernel component that owns durable goal lifecycle state.

## Consequences

Goal Runtime coordinates Workflow Generator, Event Bus, Kernel Scheduler, Observer Loop, Reconciliation Engine, Verification Engine, and Execution Memory. It owns suspend, resume, recover, verify, complete, cancel, block, and fail transitions.

## Migration Notes

Workflow engines must stop treating workflow completion as goal completion. Long-running state must persist before external execution.
