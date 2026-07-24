# ADR-007: Why Strategy is Separate from Capability

Date: 2026-07-15
Status: Accepted

## Context

A capability states what must be done, but users often express how they want it done: fastest, cheapest, best, most trusted, privacy first, local first, or offline first.

Mixing strategy into capability names or provider ranking hides an important decision.

## Decision

The runtime selection chain is `Capability -> Strategy -> Provider -> Execution Mode`.

Strategy Resolver emits explicit `StrategySelection` records before Provider Intelligence ranks providers.

## Consequences

Provider choice becomes explainable and auditable. Strategies evolve independently from capabilities and providers.

## Migration Notes

Provider ranking must accept strategy as an input and stop deriving strategy as an unlogged side effect.
