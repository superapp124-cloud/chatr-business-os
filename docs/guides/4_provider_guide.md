# Provider Guide

## Integrating New Providers
All external integrations (Calendar, HRMS, CRM, ERP, AI) must expose the same stable interface. 
Applications depend on the Workflow Platform, which depends on the Provider Adapter, which talks to the Vendor API.

## Provider Certification Scorecard (Gate 5)
Before a provider can be merged to production, it must pass:
1. **Contract compliance**: Implements `IProvider` correctly.
2. **Fault tolerance**: Survives injected timeouts and 500s.
3. **Performance**: Meets P95 latency thresholds.
4. **Security**: Passes the `SecurityManager.validateProviderSandbox` checks.
5. **Observability**: Emits standard `API_CALL` telemetry to the `EventBus`.
6. **Documentation**: Documented fully in this directory.

Run `IntegrationCertification.evaluateProvider('ProviderName')` in the test suite to verify.
