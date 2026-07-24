# ADR-002: Why Capabilities are Universal

Date: 2026-07-15
Status: Accepted

## Context

Domain-specific capability IDs such as `food.search`, `flight_booking`, or `healthcare.book_appointment` require kernel changes whenever CHATR enters a new real-world domain.

## Decision

Capabilities are universal primitives such as `DISCOVER`, `COMPARE`, `SELECT`, `PAY`, `EXECUTE`, `OBSERVE`, `RECONCILE`, and `VERIFY`.

Each capability has an independently versioned capability contract.

## Consequences

The kernel can execute new domains through ontology entities, provider manifests, strategies, and schemas without adding new runtime branches.

## Migration Notes

Domain capability IDs migrate to universal capability sequences plus ontology entity constraints and provider manifest metadata.
