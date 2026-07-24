# Production Operator Runbook

## 1. Restarting a Stalled Workflow
If a workflow is stalled (stuck in `RUNNING` for > 15 minutes):
1. **Locate:** Use the Engine Health Dashboard to find the stalled workflow ID.
2. **Pause:** Dispatch a `WORKFLOW_PAUSE` command via the CommandBus.
3. **Resume:** Dispatch a `WORKFLOW_RESUME` command. The DAG will hydrate its last checkpoint from the `StateStore` and automatically enqueue pending tasks to the `TaskRuntime`.

## 2. Inspecting the Dead Letter Queue (DLQ)
When the DLQ count exceeds zero on the dashboard:
1. Extract the DLQ from `EventRuntime.dlq`.
2. Review the `error` property of the `DeadLetterEntry`.
3. If it is a transient failure (e.g., Provider timeout), trigger `EventRuntime.replay(dlq)`.
4. If it is a fatal schema failure, manually discard the event or patch the publisher.

## 3. Replaying Events Safely
To replay events without triggering duplicate notifications:
1. Re-publish the events using the `Analytics` or `Replay` scope context in the `EventBus`.
2. Subscribers marked with `once: true` will safely ignore the replayed events.

## 4. Investigating Provider Failures
1. Check the `ProviderLatencyMs` and `errorRate` in `EngineHealthStore`.
2. Inspect the audit logs via `SecurityManager.getAuditLog({ action: 'API_CALL' })` for detailed error codes.
3. If the AI Provider is failing, the platform will attempt BYOAI fallback. If local Ollama fails, workflows will stall until resolved.
