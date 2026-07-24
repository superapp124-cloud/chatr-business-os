# Autonomous Intent Execution OS Architecture Diagrams

Date: 2026-07-15
Status: CHATR Architecture v1.0 frozen diagrams; Kernel ABI v0.9 RC

## Kernel Boundary

```mermaid
flowchart TB
  subgraph UserSurface["User Surfaces"]
    Chat["Chat / Voice / Command"]
    UI["Schema Renderer"]
  end

  subgraph Kernel["Autonomous Intent Execution Kernel"]
    Context["Context Engine"]
    Intent["Intent Engine"]
    Entity["Entity Resolver"]
    Goal["Goal Planner"]
    Capability["Capability Resolver"]
    Strategy["Strategy Resolver"]
    ProviderIntel["Provider Intelligence"]
    GoalRuntime["Goal Runtime"]
    Workflow["Workflow Generator"]
    Execution["Execution Runtime"]
    Observer["Observer Loop"]
    World["World State"]
    Reconcile["Reconciliation Engine"]
    Scheduler["Kernel Scheduler"]
    Verification["Verification Engine"]
    Memory["Execution Memory"]
    Learning["Learning Engine"]
    EventBus["Event Bus"]
  end

  subgraph Services["Kernel Services"]
    Identity["Identity Service"]
    Security["Security Service"]
    Policy["Policy Service"]
    Resource["Resource Manager"]
    Secrets["Secrets Manager"]
    Permission["Permission Manager"]
    Audit["Audit Service"]
    Telemetry["Telemetry Service"]
    Cache["Cache Manager"]
    Trust["Trust Service"]
  end

  subgraph DataPlane["Data Plane"]
    Ontology["Ontology / Knowledge Graph"]
    Knowledge["Knowledge Store"]
    Providers["Provider Manifests"]
    Policies["Policy Registry"]
    Receipts["Execution Receipts"]
    DurableGoals["Durable Goal Store"]
    Observations["Observation Log"]
  end

  Chat --> Context
  Context --> Intent
  Intent --> Entity
  Entity --> Goal
  Goal --> Capability
  Capability --> Strategy
  Strategy --> ProviderIntel
  ProviderIntel --> GoalRuntime
  GoalRuntime --> Workflow
  Workflow --> Execution
  Execution --> Observer
  Observer --> World
  World --> Reconcile
  Reconcile --> GoalRuntime
  Reconcile --> Verification
  Verification --> Memory
  Memory --> Learning
  Learning --> Entity
  Workflow --> UI
  Scheduler --> GoalRuntime
  Services -. governs .- ProviderIntel
  Services -. governs .- Execution
  Services -. governs .- GoalRuntime

  Entity <--> Ontology
  Entity <--> Knowledge
  ProviderIntel <--> Providers
  ProviderIntel <--> Policies
  Verification --> Receipts
  GoalRuntime <--> DurableGoals
  Observer --> Observations
  EventBus -. publishes .- Context
  EventBus -. publishes .- GoalRuntime
  EventBus -. publishes .- Execution
  EventBus -. publishes .- Observer
  EventBus -. publishes .- Reconcile
```

## Request Lifecycle

```mermaid
sequenceDiagram
  participant U as User
  participant C as Context Engine
  participant I as Intent Engine
  participant E as Entity Resolver
  participant G as Goal Planner
  participant CR as Capability Resolver
  participant SR as Strategy Resolver
  participant PI as Provider Intelligence
  participant GR as Goal Runtime
  participant W as Workflow Generator
  participant X as Execution Runtime
  participant O as Observer Loop
  participant WS as World State
  participant R as Reconciliation Engine
  participant V as Verification Engine
  participant M as Execution Memory

  U->>C: Raw request
  C->>I: ContextFrame + text
  I->>E: IntentFrame
  E->>G: EntityGraph
  G->>CR: GoalPlan
  CR->>SR: CapabilityRequests
  SR->>PI: StrategySelections
  PI->>GR: ProviderSelections
  GR->>W: Start or resume goal attempt
  W->>X: WorkflowGraph
  X->>O: ExecutionReceipt
  O->>WS: ObservationRecorded
  WS->>R: Derived world state
  R->>GR: Continue / recover / suspend / verify
  R->>V: Verify when goal appears achieved
  V->>M: VerificationReport
  M-->>PI: Future provider preferences
```

## Autonomous Execution Loop

```mermaid
flowchart TD
  Goal["Goal Runtime"] --> Plan["Plan Attempt"]
  Plan --> Execute["Execute"]
  Execute --> Observe["Observe External Reality"]
  Observe --> World["Update World State"]
  World --> Reconcile{"Goal achieved?"}
  Reconcile -- "No" --> Continue["Continue / Retry / Switch Provider"]
  Continue --> Plan
  Reconcile -- "Wait" --> Suspend["Suspend"]
  Suspend --> Scheduler["Kernel Scheduler"]
  Scheduler --> Observe
  Reconcile -- "Blocked" --> Human["Human Assist"]
  Human --> Plan
  Reconcile -- "Appears achieved" --> Verify["Verify"]
  Verify -- "Failed" --> Reconcile
  Verify -- "Passed" --> Complete["Complete Goal"]
```

## Provider Selection

```mermaid
flowchart LR
  Request["CapabilityRequest"] --> Filter["Filter manifests by capability"]
  Filter --> Strategy["Apply StrategySelection"]
  Strategy --> EntityFit["Match supported entities"]
  EntityFit --> PolicyFit["Apply policies and permissions"]
  PolicyFit --> Trust["Apply trust assessment"]
  Trust --> Resources["Acquire resource lease"]
  Resources --> ModeOrder["Enforce API -> Native App -> Browser Runtime -> Human Assist"]
  ModeOrder --> Score["Score latency, reliability, cost, history, preferences"]
  Score --> Select["ProviderSelection"]
```

## Knowledge Separation

```mermaid
flowchart TD
  Ontology["Ontology: entity types and relationships"]
  Knowledge["Knowledge: validated facts"]
  Memory["Memory: user and execution history"]
  World["World State: observed external reality"]

  Ontology --> EntityResolver["Entity Resolver"]
  Knowledge --> EntityResolver
  Memory --> ProviderIntel["Provider Intelligence"]
  World --> Reconcile["Reconciliation Engine"]

  EntityResolver --> GoalPlanner["Goal Planner"]
  ProviderIntel --> GoalRuntime["Goal Runtime"]
  Reconcile --> GoalRuntime
```

Ontology, Knowledge, Memory, and World State are separate stores. The kernel may correlate them, but it must not collapse them into one mutable bucket.

## Agent Boundary

```mermaid
flowchart LR
  Agent["Agent"] --> Proposal["Observation / Proposal"]
  Proposal --> Policy["Policy Check"]
  Policy --> Decision["Kernel Decision"]
  Decision --> Execute["Execution Runtime"]
  Execute --> Observe["Observer Loop"]
  Observe --> Reconcile["Reconciliation Engine"]
```

Agents never execute directly. They propose; the kernel checks policy, leases resources, decides, executes, observes, and reconciles.

## Workflow Composition

```mermaid
flowchart TD
  GoalPlan["GoalPlan"] --> Step1["DISCOVER"]
  Step1 --> Step2["COMPARE"]
  Step2 --> Step3["SELECT"]
  Step3 --> Step4{"Needs auth?"}
  Step4 -- Yes --> Auth["AUTHENTICATE"]
  Step4 -- No --> Approve{"Needs approval?"}
  Auth --> Approve
  Approve -- Yes --> Authorize["AUTHORIZE"]
  Approve -- No --> Pay{"Needs payment?"}
  Authorize --> Pay
  Pay -- Yes --> PayStep["PAY"]
  Pay -- No --> Execute["EXECUTE"]
  PayStep --> Execute
  Execute --> Observe["OBSERVE"]
  Observe --> Reconcile["RECONCILE"]
  Reconcile --> Track{"Needs continued tracking?"}
  Track -- Yes --> TrackStep["TRACK / SUSPEND"]
  Track -- No --> Verify["VERIFY"]
  TrackStep --> Observe
```

## Schema-Driven UI

```mermaid
flowchart LR
  Kernel["Workflow / Capability Node"] --> Schema["UI Schema Event"]
  Schema --> Renderer["Schema Renderer"]
  Renderer --> Primitive["Generic Primitive"]
  Primitive --> Action["WidgetAction"]
  Action --> Kernel
```

No UI layer branches on food, travel, hotels, flights, banking, healthcare, government, or shopping. Those labels can appear inside payload data only.
