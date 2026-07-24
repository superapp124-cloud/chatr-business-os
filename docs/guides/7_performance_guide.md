# Performance Guide

## Defining Success
Performance isn't "fast enough". It is strictly defined by our Performance Certification (Gate 4) thresholds.

## Acceptance Thresholds
- **Workflow Startup Time:** P95 < 100ms
- **Event Publish Latency:** P99 < 5ms
- **Memory Recovery:** +/- 5MB of baseline after the 24-hour endurance test.
- **Throughput:** Zero performance degradation over sustained load.

## Memory Budgets
If you are developing a new component, it must fit inside the aggregated budgets (`EngineHealthStore.ts`):
- Workflow Runtime: 50MB
- Event Runtime: 25MB
- AI Runtime Cache: 256MB
- Replay Buffer: 20MB
- Provider Metadata: 5MB

When budgets are breached, the system emits `MEMORY_WARNING` and begins forcefully evicting cache and scaling down worker pools.
