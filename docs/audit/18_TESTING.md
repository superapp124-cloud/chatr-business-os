# 18 Testing

## Summary

The repository has targeted tests for compiler/runtime/policy/capabilities and Electron core conformance. It does not appear to have enough test coverage for the actual `/desktop/studio` route, graph editing, persistence, publish lifecycle, durable execution, approvals, queues, or monitoring.

## Build Verification

During this audit:

```text
npm run build
```

completed successfully.

Full unit/integration/E2E test suites were not executed during this audit. This report inventories available tests from the repository.

## Test Configuration

The project uses Vitest configuration in `vitest.config.ts` and includes tests under:

- `tests/**/*.test.ts`
- `tests/**/*.test.tsx`
- `src/**/*.test.ts`
- `src/**/*.test.tsx`
- Electron conformance `.cjs` tests

## Test Inventory

Discovered workflow/platform-adjacent tests:

```text
electron/chatr-core/conformance/authority.test.cjs
electron/chatr-core/conformance/capability-cert.test.cjs
electron/chatr-core/conformance/events.test.cjs
electron/chatr-core/conformance/lifecycle.test.cjs
electron/chatr-core/conformance/observation.test.cjs
electron/chatr-core/conformance/policy.test.cjs
electron/chatr-core/conformance/provider-platform.test.cjs
electron/chatr-core/conformance/stewardship.test.cjs
electron/chatr-core/conformance/verification.test.cjs
src/core/capabilities/razorpay/executor.test.ts
src/core/capabilities/stripe/executor.test.ts
src/core/capabilities/twilio/executor.test.ts
tests/core/Compiler.test.ts
tests/core/Phase4Runtime.test.ts
tests/core/Phase5Intelligence.test.ts
```

## Unit Tests

Existing unit-style coverage includes:

- Compiler topological behavior and cycle detection.
- Workflow version/runtime utilities.
- Policy/intelligence functions.
- Payment/SMS capability executors.
- Electron core conformance concepts.

## Integration Tests

Partial integration-style tests exist for phase runtime and intelligence services. Missing integration coverage for the Studio route includes:

- load workflow from Supabase
- select project and sync KernelStore
- save nodes and edges
- publish through WorkflowVersionManager
- run workflow and persist `workflow_runs`
- approval node pause/resume
- queue insertion/worker processing
- audit log creation
- secret reference execution

## E2E Tests

No E2E tests were found for `/desktop/studio`.

Critical missing E2E scenarios:

- authenticated Studio load
- add/edit/connect nodes
- drag node and persist layout
- save/reload graph
- test run happy path
- failed node path
- approval path
- publish version path
- export/import path
- collaboration/permission path

## Coverage

Coverage metrics were not generated in this audit. Based on file inventory, workflow platform coverage is partial and skewed toward lower-level services rather than the user-visible Studio workflow lifecycle.

## Critical Test Risks

| Risk | Why it matters |
| --- | --- |
| No Studio E2E | The main product route can regress without detection. |
| No edge persistence test | Current Studio edge loss would have been caught. |
| No run persistence test | Local-only execution can masquerade as enterprise execution. |
| No publish test | Version manager exists but Studio does not call it. |
| No migration compatibility test | Duplicate `workflow_runs` migrations can create schema drift. |
| No security tests for condition/webhook/database nodes | High-risk runtime actions need guardrails. |
| No large graph tests | 1000/5000 node claims cannot be validated. |

## Testing Score

Testing score: 32/100.

The core has useful tests, but the actual Studio enterprise workflow lifecycle is not covered enough for production confidence.
