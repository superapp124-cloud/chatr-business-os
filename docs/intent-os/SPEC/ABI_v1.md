# ABI_v1

**Document ID**: CHATR-SPEC-010
**Status**: Active
**Version**: 1.0.0
**Supersedes**: None

---

## 1. Purpose

This document defines the interface contracts (Application Binary Interfaces, broadly construed) for the CHATR Intent OS runtimes and core kernel components. 

The ABI principle is that internal implementation is hidden; only the contract (inputs, outputs, event signatures, and error codes) is exposed. This ensures that runtimes can be replaced or upgraded (e.g., replacing `PlannerV2` with `PlannerV3`, or deploying a new `ObservationRuntime`) without breaking dependent systems, provided they adhere to the ABI defined here.

---

## 2. ABI Stability Promise

- **MINOR** version increments of this spec may add optional fields to schemas or introduce new methods. Existing runtimes will not break.
- **MAJOR** version increments may break existing contracts (e.g., changing a required field or method signature). All MAJOR version breaks require a documented migration path in `CHANGELOG.md`.

---

## 3. Execution Runtime ABI

The Execution Runtime is responsible for interacting with external capabilities.

### 3.1 Methods

- `execute(capabilityId: string, parameters: object, context: ExecutionContext) -> Promise<ExecutionResult>`
- `executeParallel(capabilityId: string, parameters: object, context: ExecutionContext) -> Promise<ExecutionResult>`

### 3.2 Schemas

**ExecutionContext**:
```json
{
  "intent_id": "UUID",
  "policy_id": "UUID",
  "approved": boolean,
  "background": boolean,
  "correlation_id": "UUID"
}
```

**ExecutionResult**:
```json
{
  "status": "completed" | "failed",
  "output": object,
  "duration_ms": number,
  "connector": "string"
}
```

### 3.3 Error Codes

- `CAPABILITY_NOT_FOUND`: The requested capability is not registered.
- `POLICY_DENIED`: Execution violates the active policy.
- `EXECUTION_FAILED`: The capability failed during execution (provider error).
- `APPROVAL_REQUIRED`: Execution requires explicit user approval before proceeding.

---

## 4. Observation Runtime ABI

The Observation Runtime is passive and event-driven. It exposes no callable methods to other runtimes.

### 4.1 Contract Guarantees

- Must emit a `world.changed` event within **1000ms** of detecting a qualifying external signal.
- Must not buffer observations internally for more than **5000ms** under any circumstances.
- Must normalize all raw signals into the canonical `world.changed` event schema defined in `OBSERVATION_SPEC_v1`.

---

## 5. Stewardship Runtime ABI

The Stewardship Runtime manages the lifecycle of persistent intents.

### 5.1 Methods

- `restore() -> Promise<void>` (Called by the kernel at boot to reload active stewarded intents).
- `accept(intentId: string, policy: Policy) -> Promise<void>` (Transitions an intent to the `STEWARDED` phase).
- `retire(intentId: string) -> Promise<void>` (Transitions an intent to the `ARCHIVED` phase, halting stewardship).
- `updatePolicy(intentId: string, policy: Policy) -> Promise<void>` (Replaces the active policy for an intent).
- `getMetrics() -> StewardshipMetrics`

### 5.2 Schemas

**StewardshipMetrics**:
```json
{
  "active_count": number,
  "triggered_count": number,
  "recovered_count": number,
  "money_saved": number,
  "deadlines_avoided": number,
  "policy_compliance_rate": number (0.0-1.0)
}
```

---

## 6. Verification Runtime ABI

The Verification Runtime confirms that an execution produced the expected real-world outcome.

### 6.1 Methods

- `verify(executionResult: ExecutionResult, capabilityId: string, context: VerificationContext) -> Promise<VerificationResult>`

### 6.2 Schemas

**VerificationContext**:
```json
{
  "intent_id": "UUID",
  "capability_class": "string",
  "policy": object
}
```

(VerificationResult schema is defined in `VERIFICATION_SPEC_v1`).

---

## 7. Planner ABI (Kernel Component)

The Planner is a core kernel component, not a distinct runtime. It translates user text into an intent representation.

### 7.1 Contract Guarantee

The `plan()` method must be a **pure function**. It must perform zero I/O, have zero side effects, and be completely deterministic for identical inputs.

### 7.2 Methods

- `plan(userText: string) -> PlannerOutput`

### 7.3 Schemas

**PlannerOutput**:
```json
{
  "intent": "string",
  "constraints": object,
  "stewardship_hint": StewardshipHint | null
}
```

**StewardshipHint**:
```json
{
  "can_be_stewarded": boolean,
  "suggested_lifecycle": "string",
  "suggested_policy": Policy,
  "prompt_text": "string"
}
```
