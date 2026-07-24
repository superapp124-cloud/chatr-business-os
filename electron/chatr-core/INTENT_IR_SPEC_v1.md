# Intent IR Specification v1.0

The Intent Intermediate Representation (IR) is the foundational contract for the CHATR Intent Composer. It is a canonical, normalized syntax tree that all authoring methods (UI, AI, Voice, API, Templates) must compile into before the Planner can generate an Execution Plan.

## 1. The Normalized IR Envelope
Every Intent IR document must adhere to this schema:
```json
{
  "irVersion": "1.0",
  "metadata": {
    "authoringSource": "ai_generator",
    "timestamp": "ISO8601",
    "id": "uuid"
  },
  "variables": [],
  "blocks": []
}
```

## 2. Variables & Type System
Variables are first-class, strictly typed objects. The compiler understands Primitives and Composition Rules. Domain specific schemas are contributed dynamically by capabilities.

**Primitive Types:** `String`, `Number`, `Boolean`, `Date`, `Duration`, `Binary`, `Object`.

**Variable Declaration:**
```json
{
  "name": "candidateData",
  "type": "Composite",
  "domainType": "recruitment.Candidate",
  "scope": "global",
  "source": "input",
  "validation": { "required": true }
}
```

## 3. Semantic Blocks
Semantic Blocks represent business intent and domain operations.
1. `Intent`: Executes a specific Capability (e.g., `hr.job.application`).
2. `Wait`: Blocks execution pending a specific Observation from the world.
3. `Human`: Explicitly escalates execution to a human approval/intervention process.

## 4. Control Blocks
Control Blocks represent orchestration logic and are optimized by the Planner.
1. `Decision`: Branching based on policy evaluations or variable values.
2. `Parallel`: Executes multiple branches concurrently.
3. `Repeat`: Loops a branch based on a lifecycle condition.
4. `End`: Terminal node for a branch.

## 5. Compatibility & Version Negotiation
The IR must declare the expected `irVersion` (e.g. `1.0`). The Planner evaluates this against its known support matrix. An IR version mismatch triggers an immediate Structural Validation rejection before compilation passes begin.
