# CHATR Platform — Architecture Decision Record
# ADR-001: Kernel ABI Freeze — v0.9 RC
# Date: 2026-07-16
# Status: ACCEPTED
# Authority: Technical Steering Committee

---

## Context

Platform Milestone P1 is complete. The kernel has a full execution pipeline:
Intent → Discovery → Session → Transaction → Tracking

All five reference experiences (Food, Flight, Train, Utility, Government) exercised
the same kernel pipeline at Reality Level 1 (Mock Connectors) without kernel changes.

## Decision

The following ABIs and interfaces are **FROZEN** at v0.9_rc.

Any change requires:
  1. A new ADR filed in this directory
  2. Explicit TSC approval
  3. Semantic version bump

Frozen interfaces:
  - chatr.discovery_result.v0_9_rc
  - chatr.provider_session.v0_9_rc
  - chatr.transaction.v0_9_rc
  - chatr.workflow_graph.v0_9_rc
  - chatr.provider_manifest.v0_9_rc
  - chatr.connector_interface (BaseConnector — discover/fetch/authenticate/checkout/track/health/capabilities/sla)

## Consequences

- Connector teams can build new providers without kernel review
- Reality Level upgrades (Mock → Sandbox → Production) do not require ADRs
- Bug fixes within existing ABIs are permitted without a new ADR
- New kernel subsystems require a new Platform Milestone proposal

## Permitted Without ADR

- New connectors (extends BaseConnector)
- Ranking weight adjustments
- Cache TTL changes
- Performance optimisations within existing components
- Bug fixes
- Security patches

## Not Permitted Without ADR

- New fields in any frozen ABI
- New IPC channels not in the existing allow-list
- New kernel runtime components
- Changes to state machine transition tables

---
# PLATFORM STATUS: CHATR v0.9 RC
# Architecture: COMPLETE
# Kernel: FEATURE COMPLETE
# ABI: FROZEN
# Platform: READY FOR PRODUCTION INTEGRATION
# Next Milestone: v1.0 (flagship experience at Reality Level 3+)
