
import { OSCommand } from './Types';
import { EventBus } from './EventBus';
import { WorkflowCompiler } from './Compiler';
import { BrowserExecutionEngine } from '../execution/BrowserExecutionEngine';
import { ActiveSchemaAnalyzer } from './SchemaAnalyzer';
import { AutomationIntentService } from './IntentService';
import { KernelStore } from './KernelStore';
import { GraphValidator } from '../execution/GraphValidator';

class Bus {
  async dispatch(command: OSCommand) {
    console.log(`[CommandBus] Received: ${command.type}`, command.payload);
    
    switch (command.type) {
      case 'MOVE_NODE':
        EventBus.publish({ type: 'NODE_MOVED', payload: command.payload, timestamp: Date.now() });
        break;
      case 'CREATE_NODE':
        EventBus.publish({ type: 'NODE_CREATED', payload: command.payload, timestamp: Date.now() });
        break;
      case 'CREATE_EDGE':
        const rawEdge = command.payload.edge;
        ActiveSchemaAnalyzer.analyzeEdge(rawEdge, {}, {}).then(edge => {
          EventBus.publish({ type: 'EDGE_CREATED', payload: { edge }, timestamp: Date.now() });
          EventBus.publish({ type: 'SCHEMA_MAPPED', payload: { edgeId: edge.id, metadata: edge.metadata }, timestamp: Date.now() });
        });
        break;
      case 'LOAD_WORKFLOW':
        EventBus.publish({ type: 'WORKFLOW_LOADED', payload: command.payload, timestamp: Date.now() });
        break;
      case 'GENERATE_WORKFLOW':
        AutomationIntentService.processIntent(command.payload.intent, {} as any).then(plan => {
          EventBus.publish({ type: 'WORKFLOW_GENERATED', payload: { plan }, timestamp: Date.now() });
        });
        break;
      case 'RECOMMEND_FIX':
        // The Kernel receives the recommendation and emits an event for the UI to ask for approval
        EventBus.publish({ type: 'FIX_RECOMMENDED', payload: command.payload, timestamp: Date.now() });
        break;
      case 'COMPILE_WORKFLOW':
        try {
          // Phase A fix: prefer the graph from the dispatched payload.
          // Fall back to KernelStore only for display-only compilation (not execution).
          const compileGraph = command.payload?.graph ?? {
            nodes: KernelStore.getState().nodes,
            edges: KernelStore.getState().edges,
          };
          const executionGraph = WorkflowCompiler.compile(compileGraph);
          console.log('[Compiler] Generated Execution Graph:', executionGraph);
          EventBus.publish({ type: 'WORKFLOW_COMPILED', payload: { plan: executionGraph }, timestamp: Date.now() });
        } catch (e: any) {
          console.error('[Compiler] Failed:', e.message);
        }
        break;
      case 'RUN_WORKFLOW':
        // Phase A fix (Invariant I-03, I-04):
        // Execute the canonical graph from the dispatched payload — NEVER from KernelStore.
        // The caller (WorkflowStudio.handleTestRun) is responsible for dispatching the
        // correct WorkflowGraph. If no graph is provided in the payload, execution is blocked.
        try {
          let graph = command.payload?.graph;
          const workflowId = command.payload?.workflowId || 'session-1';

          // Phase C: Autonomous Execution
          // If the caller requests production execution, load the active published manifest
          if (command.payload?.useActiveVersion) {
            // Lazy load the version store dependencies using dynamic import
            const { VersionStore } = await import('../execution/VersionStore');
            const { SupabaseVersionRepository } = await import('../execution/SupabaseVersionRepository');
            const versionStore = new VersionStore(new SupabaseVersionRepository());
            
            const activeManifest = await versionStore.getActive(workflowId);
            if (!activeManifest) {
              throw new Error(`Cannot run workflow ${workflowId} in autonomous mode: No active published version found.`);
            }
            graph = activeManifest.graph;
            console.log(`[CommandBus] Autonomous Execution: Loaded version ${activeManifest.versionNumber} for ${workflowId}`);
          }

          if (!graph || !Array.isArray(graph.nodes)) {
            console.error('[CommandBus] RUN_WORKFLOW: no canonical graph in payload. Execution blocked. ' +
              'Caller must dispatch { graph: WorkflowGraph } — do not rely on KernelStore for execution.');
            EventBus.publish({
              type: 'EXECUTION_FAILED',
              payload: { workflowId, error: 'No canonical graph provided in RUN_WORKFLOW payload.' },
              timestamp: Date.now()
            });
            break;
          }

          // Phase B fix: Validate structural integrity of the graph before attempting to execute
          try {
            GraphValidator.validate(graph);
          } catch (validationError: any) {
            console.error('[CommandBus] Graph validation failed:', validationError.message);
            EventBus.publish({
              type: 'EXECUTION_FAILED',
              payload: { workflowId, error: validationError.message },
              timestamp: Date.now()
            });
            break;
          }

          // Authoritative runtime: BrowserExecutionEngine
          // Phase A.5 update: Replaces the old LocalBrowserRuntime and delegates to the modular engine
          BrowserExecutionEngine.execute(graph, {
            triggerType: command.payload?.useActiveVersion ? 'autonomous' : 'manual',
            triggeredBy: 'studio_user', // Mocked user for Studio runs
          }, workflowId).catch(e => {
            console.error('[Runtime] Execution halted due to node failure:', e);
          });
        } catch (e: any) {
          console.error('[Runtime] Cannot run invalid graph:', e.message);
        }
        break;
    }
  }
}

export const CommandBus = new Bus();
