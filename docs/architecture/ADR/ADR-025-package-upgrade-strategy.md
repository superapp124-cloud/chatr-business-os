# ADR 025: Package Upgrade Strategy

## Status
Accepted

## Date
2026-07-17

## Context
Workflows break if packages upgrade incompatibly.

## Decision
Upgrade lifecycle requires SemVer checks. The flow is: Download New -> Certify -> Run Migrations (if provided) -> Swap Active pointer in Registry -> Activate. If any step fails, roll back to Previous Version. Downgrades are blocked unless forced.

## Consequences
Ensures zero workflow disruption. Missing nodes map gracefully to degradation errors.
