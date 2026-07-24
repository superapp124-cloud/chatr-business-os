# 12 Monitoring

## Summary

The visible Studio monitoring experience is mostly static or local. The codebase contains richer observability schemas and analyzer services, but they are not fully connected to `/desktop/studio`.

## Studio Logs

`WorkflowStudio.tsx` defines static `LOGS` data and renders it in the bottom Live Logs and Errors tabs.

Runtime events can update local execution cards and node status, but the log list itself is not sourced from durable `workflow_runs.logs` or `audit_logs`.

## Metrics

Studio top metrics include:

- Runs Today
- Active
- Waiting
- Success Rate
- Avg Time

`runsToday` and `successRate` are partly calculated from EventBus history. `Avg Time` is hard-coded as `18 min` in the visible header.

Risk: `src/platform/AutomationOS/EventBus.ts` tries to access a history property on the event bus facade. The underlying facade does not expose history as a public API, so metrics may be unreliable.

## Execution Monitoring

The Executions tab shows local execution state created when `EXECUTION_STARTED` events arrive. This is useful for a running browser session but is not persisted after reload.

Missing:

- run detail page
- node timeline
- input/output inspection
- retry history
- audit correlation id
- exportable run logs
- durable status polling/subscription

## Error Monitoring

The Errors tab filters static `LOGS` for `error` and `warn`. Runtime `NODE_FAILED` events update node state and local execution state, but no durable error trace is written by the Studio runtime.

## Queue Monitoring

The Queue tab displays static queued items. It does not query `execution_queue`.

## Analytics

The Analytics tab is static/hard-coded. It does not query `workflow_metrics`, `workflow_runs`, `provider_runs`, or actual execution durations.

## Tracing

Trace-related schemas exist:

- `workflow_runs.execution_trace`
- `workflow_runs.correlation_id`
- `provider_runs`
- `ai_traces`
- `platform_events`

Studio does not write these during test execution.

## Alerts

The right panel shows AI Optimizer recommendation cards such as approval SLA and model upgrade suggestions. These are static in the current Studio route. No alert rule engine or notification binding was found for Studio workflow health.

## Performance and Health

The codebase includes health/performance concepts:

- `PerformanceAnalyzer`
- `FailureAnalyzer`
- `OptimizationAdvisor`
- `EngineHealthDashboard`
- EventRuntime metrics
- Electron execution ledger stats

Studio does not use these as live data sources for the visible optimizer and analytics panels.

## Logging and Audit Split

There are multiple logging concepts:

- local EventBus events
- static Studio logs
- Supabase `audit_logs`
- Supabase `workflow_runs.logs`
- Electron `execution_ledger`
- Electron log utilities

These need unification for enterprise observability.

## Monitoring Readiness

Observability score: 38/100.

The product has strong observability intentions, but the Studio route is not yet connected to durable telemetry, run tracing, queue state, or real analytics.
