# Developer Runbook

## 1. Debugging a Capability
When building a new capability:
1. Wrap your workflow definition in `WorkflowSDK.createCapability`.
2. Inspect the returned DAG using `WorkflowSDK.inspect(capability)`.
3. If dependencies are incorrect, execution will fail during the `.plan()` phase before any code is run.

## 2. Inspecting the Execution Runtime
To see the internal state of the `TaskRuntime`:
1. Call `taskRuntime.getMetrics()`.
2. This returns real-time data on `activeWorkers`, `queueDepth`, and worker pool saturation.
3. If `queueDepth` is high but `activeWorkers` is 0, check if the engine has scaled down due to a `MEMORY_WARNING`.

## 3. Benchmarking a Provider
Before merging a new provider:
1. Implement the provider against the required `IProvider` interface.
2. Ensure you run the Provider Certification Scorecard via `IntegrationCertification.evaluateProvider(name)`.
3. The provider must pass the Performance Thresholds (P50, P95, P99) tested in `benchmarks.ts`.

## 4. Certifying a New Capability
To push a new workflow to production:
1. Ensure the capability relies *only* on the `WorkflowSDK`. Do not import Kernel classes directly (e.g., do not import `PipelineEngine`).
2. Run `certifications.ts` to generate the consolidated JSON certification report.
3. The capability is certified once the report reads `PASS` with zero warnings.
