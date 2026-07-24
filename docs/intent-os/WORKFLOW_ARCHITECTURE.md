# Workflow Architecture v0.9 Release Candidate

Date: 2026-07-15
Status: CHATR Architecture v1.0 frozen workflow contract; Kernel ABI v0.9 RC

## Rule

Never generate workflows directly from raw planner output.

Required sequence:

```text
IntentFrame -> EntityGraph -> GoalPlan -> GoalRuntimeState -> CapabilityRequests -> StrategySelections -> ProviderSelections -> WorkflowGraph -> Observation -> Reconciliation
```

The Workflow Generator composes graph nodes from capability primitives. It must not branch on industries. A workflow is an execution attempt owned by a durable goal; it is not the durable goal itself.

## Workflow Generator Responsibilities

- Convert `GoalPlan` steps into executable graph nodes.
- Attach strategy selections from Strategy Resolver.
- Attach provider selections from Provider Intelligence.
- Attach input/output schemas.
- Attach approval, retry, timeout, cancellation, and verification policies.
- Attach trust, policy, identity, permission, and resource lease references.
- Emit UI schema events for required user interaction.
- Persist execution receipts and verification reports.
- Emit observation requirements.
- Return control to the Goal Runtime after each observation/reconciliation checkpoint.

## Workflow Generator Non-Responsibilities

- It does not classify domains.
- It does not resolve ontology.
- It does not choose providers by hardcoded category.
- It does not choose strategies.
- It does not compute provider trust.
- It does not allocate resources directly.
- It does not access secrets directly.
- It does not render UI components.
- It does not treat acceptance examples as special cases.
- It does not own long-running goal state.

## Workflow Graph Shape

```json
{
  "abi": "chatr.workflow_graph.v0_9_rc",
  "workflow_id": "wf_123",
  "goal_id": "goal_123",
  "nodes": [
    {
      "id": "node_discover",
      "capability": "DISCOVER",
      "strategy_selection": {
        "strategy": "most_trusted",
        "ref": "strategy_123"
      },
      "provider_selection": {
        "provider_id": "provider.example",
        "execution_mode": "api"
      },
      "policy_decision_ref": "policy_123",
      "trust_assessment_ref": "trust_123",
      "resource_lease_refs": ["lease_123"],
      "input": {},
      "output_schema": {},
      "requires_approval": false,
      "depends_on": [],
      "retry": {
        "max_attempts": 2
      }
    },
    {
      "id": "node_observe",
      "capability": "OBSERVE",
      "provider_selection": {},
      "input": {
        "receipt_ref": "node_discover"
      },
      "depends_on": ["node_discover"]
    },
    {
      "id": "node_reconcile",
      "capability": "RECONCILE",
      "input": {
        "world_state_ref": "world_123"
      },
      "depends_on": ["node_observe"]
    }
  ],
  "verification": {
    "required": true,
    "node": "node_verify"
  }
}
```

## Universal Goal Templates

Goal templates are generic and parameterized by entity graph.

### Get/Order/Reserve With Fulfillment

```text
DISCOVER -> COMPARE -> SELECT -> AUTHENTICATE -> AUTHORIZE? -> PAY? -> EXECUTE -> OBSERVE -> RECONCILE -> TRACK? -> VERIFY
```

### Pay Known Obligation

```text
DISCOVER -> AUTHENTICATE -> FETCH -> AUTHORIZE -> PAY -> OBSERVE -> RECONCILE -> VERIFY
```

### Transfer Value

```text
AUTHENTICATE -> COLLECT_INPUT? -> AUTHORIZE -> TRANSFER -> OBSERVE -> RECONCILE -> VERIFY
```

### Renew or Submit Application

```text
DISCOVER -> AUTHENTICATE -> FETCH? -> COLLECT_INPUT -> AUTHORIZE -> PAY? -> EXECUTE -> OBSERVE -> RECONCILE -> TRACK -> VERIFY
```

### Schedule Appointment

```text
DISCOVER -> COMPARE -> SELECT -> COLLECT_INPUT? -> SCHEDULE -> OBSERVE -> RECONCILE -> VERIFY
```

## Dynamic UI Events

Workflow nodes emit UI schema events only when needed:

| Node Need | UI primitive |
| --- | --- |
| Missing structured input | form |
| Multiple options | selection/comparison |
| Irreversible action | approval |
| Payment action | payment |
| Long-running execution | timeline/tracking |
| Suspended goal | timeline/notification |
| Recovery path | approval/selection/result |
| Final state | result/verification |

The schema payload may contain entity labels. Renderer code must stay generic.

## Verification

Every workflow must produce a verification report before completion.

```json
{
  "abi": "chatr.verification_report.v0_9_rc",
  "workflow_id": "wf_123",
  "status": "verified",
  "evidence": [
    {
      "type": "provider_receipt",
      "ref": "receipt_123"
    }
  ],
  "completed_at": "2026-07-15T00:00:00Z"
}
```

If verification fails:

- mark workflow as `unverified`, not `completed`
- trigger recovery or human assist if policy allows
- record the outcome in execution memory

## Suspension and Resume

Long-running workflows can suspend back to the Goal Runtime.

```json
{
  "abi": "chatr.goal_suspend.v0_9_rc",
  "goal_id": "goal_123",
  "workflow_id": "wf_123",
  "reason": "waiting_provider",
  "wake_condition": {
    "type": "time_or_provider_event",
    "after": "2026-07-16T00:00:00Z",
    "event": "ObservationRecorded"
  }
}
```

The Kernel Scheduler owns wakeup. On wake, the Goal Runtime resumes at `OBSERVE` or `RECONCILE`, not from the beginning.

## Migration From Current Workflow Engine

Current `electron/chatr-core/execution/workflow-engine.cjs` hardcodes domain branches. Replace it in three steps:

1. Add a new graph composer that accepts `GoalPlan`.
2. Run old and new graph generation in shadow mode for existing demo flows.
3. Delete domain branches once acceptance tests pass on primitive-only graphs.

Current outcome templates such as `travel.outcome.json` can become non-kernel examples or fixtures, but they must not determine kernel runtime behavior.
