# 17 Performance

## Summary

The app builds successfully, but workflow performance readiness for large graphs is not proven. The current Studio canvas renders generated React Flow nodes directly and has no evidence of virtualization, graph windowing, persisted layout optimization, worker-based compilation, or large-workflow test coverage.

## Initial Load

The production build emits many chunks. Notable output from the audit build:

- `WorkflowStudio` chunk: about 78.07 kB, gzip about 19.79 kB.
- `ChatrStudio` chunk: about 316.74 kB, gzip about 95.90 kB.
- `DesktopChat` chunk: about 1,036.89 kB, gzip about 284.13 kB.
- main `index` chunk: about 1,489.51 kB, gzip about 413.21 kB.
- `ort-wasm-simd-threaded` asset: about 21.6 MB.
- main CSS chunk: about 446.62 kB.

The build warns that some chunks are larger than 1200 kB after minification.

## Lazy Loading

Workflow Studio is lazy-loaded through `src/routes/lazyPages.tsx`, which is good. However, shared foundational modules and large app-wide chunks still affect total application performance.

## Canvas Performance

Current Studio canvas behavior:

- Generates React Flow nodes inline on render.
- Generates sequential edges inline on render.
- Uses fixed positioning.
- Does not persist layout.
- Does not use a graph virtualization strategy.

This is fine for small workflows. It is not proven for hundreds or thousands of nodes.

## Rendering

Potential rendering risks:

- Large `WorkflowStudio.tsx` state changes can re-render a large route.
- Inline arrays for React Flow nodes/edges are rebuilt during render.
- Static side panels and bottom panels coexist with the canvas.
- Custom nodes include animated/status UI and popovers.
- EventBus updates can update local node/execution state during runs.

## Memory

Runtime memory risks:

- `RuntimeAdapter` keeps execution context in memory.
- EventBus history/queues are in memory unless a store adapter is used.
- Studio local execution cards are in memory.
- Large workflow outputs could accumulate in the browser session.

No memory cap specific to Studio workflow execution was found.

## Network

Studio uses direct Supabase calls for workflows and direct runtime calls for side effects. There is no batching strategy for workflow graph save/load beyond fetching a row with JSON nodes/edges.

Potential issues:

- Very large JSONB node/edge arrays can become expensive to load/save.
- Autosave is absent in Studio, but a future autosave would need diffing/debouncing.
- Runtime database actions and webhooks execute from browser context.

## API Performance

No dedicated workflow API endpoint was found for graph validation, publish, or execution. Direct table calls are simple but push too much responsibility into the client.

## Large Workflow Support

### 1000 Nodes

Likely risks:

- React Flow DOM/render cost.
- Large inline node/edge array generation on render.
- No layout worker.
- No minimap/viewport strategy in Studio.
- Large JSONB save/load.
- Sequential runtime execution in browser.

Expected readiness: not production-ready without testing and optimization.

### 5000 Nodes

Likely blockers:

- Browser memory and render cost.
- Interaction latency.
- Graph compilation cost in main thread.
- Save payload size.
- No graph paging/subflows.
- No worker-based execution or queue-backed processing.

Expected readiness: not ready.

## Concurrency

Studio runtime does not provide durable concurrent execution. Electron has some connector-level parallel helper logic, but it is not the Studio graph runtime.

## Performance Recommendations

Priority improvements:

1. Establish target workflow sizes and performance budgets.
2. Persist and diff graph layout instead of regenerating everything inline.
3. Move graph compile/validation to a worker or backend service for large workflows.
4. Add large graph tests at 100, 1000, and 5000 nodes.
5. Use queue-backed execution for long-running workflows.
6. Add run output size limits and log retention policies.

## Performance Score

Scalability/performance score: 30/100.

The current implementation is appropriate for small demo workflows. Enterprise-scale automation needs proof and architecture changes.
