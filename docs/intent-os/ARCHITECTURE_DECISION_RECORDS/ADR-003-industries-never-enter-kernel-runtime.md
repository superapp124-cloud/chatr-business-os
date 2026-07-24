# ADR-003: Why Industries Never Enter Kernel Runtime

Date: 2026-07-15
Status: Accepted

## Context

Food, travel, banking, healthcare, government, shopping, hotels, and flights are useful product concepts, but encoding them as runtime branches makes the kernel grow by industry.

## Decision

Industries never enter kernel runtime. Industry labels may appear as ontology data, provider metadata, UI payload labels, fixtures, or documentation examples, but not as kernel routing concepts.

## Consequences

The planner extracts intent and entity. Entity Resolver maps entities through ontology. Runtime logic operates on goals, capabilities, providers, context, policy, execution, observation, reconciliation, and verification.

## Migration Notes

Architecture lint must reject forbidden industry terms in kernel/runtime code except in migration comments, tests, fixtures, or docs that explicitly describe the rule.
