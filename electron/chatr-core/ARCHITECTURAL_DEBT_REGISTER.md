# Architectural Debt Register (ADR)
This register tracks intentional trade-offs where a recommended or informational constitutional rule has been bypassed to meet an immediate need, preventing undocumented technical debt.

| Identifier | Description | Impact | Risk | Accepted By | Review Date | Planned Resolution |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ADR-001** | Stage 16 initial certification suite evaluates structure rather than invoking full Node runtime engines due to placeholder SDKs. | Prevents full end-to-end performance latency tests (Domain 8). | Low | Core Architecture Team | 2026-12-01 | Upgrade test suite once Node/V8 Execution Engine is finalized. |
| **ADR-002** | Security Domain currently validates RBAC policy schemas, but does not yet validate full KMS encryption at rest. | Does not verify encryption keys. | Medium | Security Council | 2026-09-01 | Add KMS provider stubs to test suite. |
