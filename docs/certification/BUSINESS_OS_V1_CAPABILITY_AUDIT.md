# CHATR Business OS v1.0 Capability Audit

This audit operationalizes the six-stage release gates and the 100-point Capability Maturity Score (CMS) for the Business OS without altering frozen kernel contracts.

The authoritative, machine-readable source is `certifications/business-os-capability-audit.json`. Run `npm run certify:business-os` to verify every score is within its dimension budget, every gate is recognized, and every declared evidence path exists.

## CMS dimensions

| Dimension | Maximum |
| --- | ---: |
| UI | 10 |
| Runtime | 20 |
| Objects | 15 |
| Event Bus | 15 |
| Connectors | 15 |
| Grounded AI | 15 |
| Security | 5 |
| Performance | 5 |

CMS is the sum of the bounded dimension scores, for a maximum of 100.

## Release gates

1. Concept — architecture and domain model only.
2. Prototype — CXS UI with mock data only.
3. Integrated — UI and business objects connected; edge cases remain.
4. Operational — end-to-end data, events, and connectors operate.
5. Production — stable, monitored, and guarded in production conditions.
6. Certified — satisfies the complete Business OS standard, including RBAC, auditability, evidence, and CXS compliance.

## Audit discipline

- A release gate is a certification claim, not a UI label.
- The verifier checks the evidence paths only; it does not claim external OAuth, telemetry, or production connector health has been exercised.
- Update the evidence register and rerun certification whenever a declared capability, source path, or maturity score changes.
