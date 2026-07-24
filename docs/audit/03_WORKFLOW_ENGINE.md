# 03 Workflow Engine

## Summary

The current `/desktop/studio` workflow engine is a visual and partially executable frontend system, not a complete enterprise-grade workflow engine. Creation, display, local testing, and saving exist in partial form. Durable graph semantics, edge editing, validation, version publishing, run history, retries, approvals, queues, and analytics are either missing from the route or exist in separate modules not yet integrated.

## How a Workflow Is Created

There are three creation paths in the codebase:

1. Manual create through `useBusinessWorkflows.createWorkflow()` in `src/hooks/useBusinessWorkflows.ts:47`.
2. AI generation through `WorkflowStudio.handleAIGenerate()` at `src/pages/desktop/WorkflowStudio.tsx:1015`.
3. Node addition inside Studio through `addNode()` at `src/pages/desktop/WorkflowStudio.tsx:1081`.

`createWorkflow()` inserts a row into Supabase table `business_workflows` with `nodes: []`, `edges: []`, and `status: 'draft'`.

`handleAIGenerate()` dispatches `GENERATE_WORKFLOW` to `CommandBus`. `CommandBus` calls the AI provider plan method and publishes `WORKFLOW_GENERATED`. Studio listens for this event and replaces local node state.

## How Workflows Load

`WorkflowStudio` calls `useBusinessWorkflows()`. When workflows are available, the first workflow is selected. The component:

- Sets `activeProject`.
- Sets `nodes` from `first.nodes`.
- Sets `workflowName`.
- Dispatches `LOAD_WORKFLOW` with nodes and synthetic sequential edges.

Important limitation: persisted `first.edges` are not used in this load path. Studio generates edges from the node order.

## How Nodes Are Stored

Nodes are stored in at least three shapes:

| Shape | Location | Notes |
| --- | --- | --- |
| `WorkflowNode` | `WorkflowStudio.tsx` local UI model | Contains label, type, owner, status, runs, success rate, errors, etc. |
| React Flow nodes | Generated inline in Studio | `type: 'custom'`, `data: WorkflowNode`, fixed positions. |
| `OSNode` | `src/platform/AutomationOS/Types.ts` | Kernel/runtime graph type with `id`, `type`, `position`, `data`. |

This is not yet a stable node contract. The UI node shape and runtime node shape are different.

## How Edges Are Stored

`business_workflows.edges` exists in the hook type and the alternate builder uses it. The `/desktop/studio` implementation does not preserve it:

- Load path synthesizes edges from sequential node order.
- Canvas path generates edges inline from sequential node order.
- Save path updates only `{ nodes }`.
- Test run path maps local nodes to sequential edges before dispatch.

This means branch structure, manual connections, condition outputs, and graph layout edges are not durable in the Studio route.

## Canvas Implementation

`WorkflowStudio.tsx` imports React Flow at line 21 and renders `<ReactFlow>` around line 1457.

The canvas includes:

- A header node.
- A workflow start node.
- One generated custom node per local workflow node.
- A workflow end node.
- `Background`.
- `fitView`.
- `minZoom={0.2}` and `maxZoom={1.5}`.

Positions are deterministic and sequential, not persisted graph layout:

- Header: fixed top position.
- Start: fixed center.
- Custom nodes: `x: 25`, `y: i * 180 + 100`.
- End: after the last custom node.

## Zoom

Zoom is provided by React Flow:

- `fitView`
- `fitViewOptions={{ padding: 0.2 }}`
- `minZoom={0.2}`
- `maxZoom={1.5}`

No custom zoom controls were found in the Studio route. `Controls` is imported but not rendered in the observed section.

## Drag

Studio does not wire `onNodesChange`, `useNodesState`, or persisted position updates for the main canvas. React Flow may allow default visual interaction depending on node configuration, but the route does not persist dragged node positions.

The alternate `WorkflowBuilder.tsx` does support React Flow editing handlers:

- `useNodesState` at line 69.
- `useEdgesState` at line 70.
- `onNodesChange` and `onEdgesChange` at lines 152-153.
- `onConnect` at line 154.
- autosave of `nodes` and `edges` around line 104.

## Selection

Studio has `selectedNode` local state and custom node UI supports opening details. Selection is UI-local and not part of the persisted workflow model.

## Undo and Redo

No undo/redo implementation was found for `/desktop/studio`.

## Clipboard

No copy/paste or clipboard graph support was found for `/desktop/studio`.

## Grouping

No group, subflow, swimlane, or container node support was found in the Studio route.

## Node Serialization

`compileWorkflow()` at `WorkflowStudio.tsx:686` serializes React Flow nodes and edges into a schema:

- `schemaVersion: '1.0'`
- workflow id/name
- empty `variables`
- empty `permissions`
- executable nodes filtered to React Flow type `custom`
- node `retry: 3`
- node `timeout: 30000`
- edges excluding start/end

Validation is minimal. It checks only that executable nodes exist. The comments note further validation such as unreachable nodes or loops, but those checks are not implemented there.

## Import

No Studio import workflow flow was found.

## Export

The publish menu includes `Export`, but the handler compiles and logs/toasts a plan. It does not create or download an export file.

## Versioning

Versioning infrastructure exists:

- `workflow_versions` migration.
- `WorkflowVersionManager.createDraft()`.
- `WorkflowVersionManager.publish()`.
- `WorkflowVersionManager.getPublishedVersion()`.

The Studio route has a static `VERSIONS` list and menu text such as `Publish v13`. It does not call `WorkflowVersionManager` when publishing.

## History

Version history shown in the right panel comes from static `VERSIONS` data. Execution history in the bottom panel is local in-memory state and static logs. Durable run history through `workflow_runs` is not wired to the Studio UI.

## Autosave

No autosave was found in `WorkflowStudio`.

The alternate `WorkflowBuilder.tsx` has a 1 second debounce autosave that updates both `nodes` and `edges`.

## Validation

Current validation layers:

- `compileWorkflow()` validates only non-empty executable nodes.
- `Compiler.ts` performs topological sorting and cycle detection.
- AI-generated plans can be mapped into graph form.

Missing validation:

- Required configuration per node type.
- Credential scopes.
- Invalid branch targets.
- Unreachable nodes.
- Dead-end branches.
- Loop policy.
- Timeout/retry policy validity.
- Data schema compatibility between nodes.
- Unsafe webhook/database targets.
- Publish-readiness checks.

## Publishing

Studio publish behavior is currently not durable publishing. Menu options include:

- `Publish v13`
- `Save as Draft`
- `Schedule Publish`
- `Export`
- `Clone Workflow`

The implemented branch for `Publish v13` or `Export` calls `compileWorkflow()`, logs the result, and shows a toast. It does not lock a version, update lifecycle state, or write an immutable publish record.

## Execution

Execution begins from `handleTestRun()`.

Current path:

1. Build a payload from local nodes.
2. Dispatch `RUN_WORKFLOW`.
3. `CommandBus` compiles `KernelStore.getState()`.
4. `RuntimeAdapter` executes tasks.
5. Events are published through local EventBus.
6. Studio updates local node/execution state from event subscription.

Major mismatch: the payload passed by `handleTestRun()` is not what `CommandBus` compiles. It compiles the `KernelStore` state. If the Studio local state and kernel state diverge, the test run can execute stale or different graph content.

## Workflow Engine Maturity

Current maturity score: 34/100.

Rationale:

- Visual workflow shell exists.
- Basic local graph compilation exists.
- Local execution event flow exists.
- Supabase workflow persistence is partial.
- Durable graph semantics, publish contract, run persistence, recovery, and enterprise controls are not complete.
