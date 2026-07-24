# Production Readiness Checklist

Before any legacy module (e.g., Recruitment) replaces the existing backend and goes live on the CHATR OS Kernel, this checklist must be completed.

## 1. Reliability
- [ ] Event Store backup and restore tested.
- [ ] Projection rebuild tested from an empty database.
- [ ] Recovery after interruption verified.

## 2. Security
- [ ] Server-side authorization enforced via Policy Engine.
- [ ] Tenant isolation verified (for multi-tenant deployments).
- [ ] Immutable audit trail complete and deterministically verifiable.

## 3. Operations
- [ ] Event append metrics collected (P50/P95/P99).
- [ ] Projection lag monitored.
- [ ] Replay duration measured and scales predictably.
- [ ] Query latency monitored.

## 4. Migration
- [ ] Rollback strategy documented.
- [ ] Parallel validation completed (Strangler pattern active).
- [ ] Legacy vs Kernel state comparison successful (States match 100%).
