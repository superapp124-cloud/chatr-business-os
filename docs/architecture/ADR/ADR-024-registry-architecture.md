# ADR 024: Registry Architecture

## Status
Accepted

## Date
2026-07-17

## Context
The OS needs a single source of truth for installed packages, supporting multi-tenant overriding.

## Decision
Authoritative persistence uses JSON state (`registry.json`) for local fallback, synchronized with Supabase for cloud persistence. Scope isolation determines if a package is Global or Tenant-scoped.

## Consequences
Restarting reads authoritative state and re-activates active packages seamlessly.
