# ADR 023: Package Permissions

## Status
Accepted

## Date
2026-07-17

## Context
Packages need to be isolated. Try/catch is not enough to stop abuse (e.g. fs access, network).

## Decision
Implement capabilities-based strings (e.g., `filesystem.read`, `network.http`). A runtime `PermissionEnforcer` intercepts execution and blocks node actions that exceed the permissions declared in the PackageManifest.

## Consequences
Nodes without explicit permissions cannot bypass the enforcer. Execution stops with `PermissionDeniedError`.
