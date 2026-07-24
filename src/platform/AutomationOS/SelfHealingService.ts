import { EventBus } from './EventBus';
import { CommandBus } from './CommandBus';
import { ActiveAIProvider } from './AIProvider';
import { OSEvent } from './Types';
import { KernelStore } from './KernelStore';

export class SelfHealingService {
  private retriedNodes: Set<string> = new Set();

  constructor() {
    EventBus.subscribe(this.handleEvent.bind(this));
  }

  private async handleEvent(event: OSEvent) {
    if (event.type === 'NODE_FAILED') {
      const { nodeId, error, workflowId } = event.payload;
      const retryKey = `${workflowId}:${nodeId}`;

      if (this.retriedNodes.has(retryKey)) {
        console.warn('[SelfHealingService] Already retried', retryKey, '- skipping');
        EventBus.publish({ type: 'HEALING_ABANDONED', payload: { nodeId, reason: 'max_retries' }, timestamp: Date.now() });
        return;
      }

      console.log('[SelfHealingService] NODE_FAILED intercepted. Healing node:', nodeId);
      const failure = { nodeId, error, context: event.payload };

      try {
        const recommendation = await ActiveAIProvider.heal(failure, {} as any);
        console.log('[SelfHealingService] AI confidence:', recommendation.confidence);

        CommandBus.dispatch({ type: 'RECOMMEND_FIX', payload: { nodeId, recommendation }, timestamp: Date.now() });

        if (recommendation.confidence >= 0.85 && recommendation.patch) {
          const state = KernelStore.getState();
          const node = state.nodes.find((n: any) => n.id === nodeId);

          if (node) {
            EventBus.publish({
              type: 'NODE_PATCHED',
              payload: { nodeId, patch: recommendation.patch, confidence: recommendation.confidence },
              timestamp: Date.now()
            });

            this.retriedNodes.add(retryKey);

            if (recommendation.confidence >= 0.9) {
              console.log('[SelfHealingService] High confidence - auto-retrying workflow');
              setTimeout(() => {
                CommandBus.dispatch({
                  type: 'RUN_WORKFLOW',
                  payload: { workflowId, nodes: state.nodes, edges: state.edges, _healed: true },
                  timestamp: Date.now()
                });
              }, 2000);
            }
          }
        }
      } catch (err) {
        console.error('[SelfHealingService] Healing pipeline failed:', err);
        EventBus.publish({ type: 'HEALING_FAILED', payload: { nodeId, error: String(err) }, timestamp: Date.now() });
      }
    }

    if (event.type === 'EXECUTION_COMPLETED') {
      this.retriedNodes.clear();
    }
  }
}

export const ActiveSelfHealingService = new SelfHealingService();
