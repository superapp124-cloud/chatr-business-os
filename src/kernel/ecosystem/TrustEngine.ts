import { kernelBus } from '../core/EventBus';
import { worldModel } from '../world/WorldModel';
import { TrustVector } from '../abi/v1';

export class TrustEngine {
  constructor() {
    kernelBus.subscribe('execution.succeeded', this.handleExecutionOutcome.bind(this));
    kernelBus.subscribe('execution.failed', this.handleExecutionOutcome.bind(this));
  }

  private async handleExecutionOutcome(event: any): Promise<void> {
    const { entityId, latencyMs } = event.payload;
    if (!entityId) return;

    const node = worldModel.findEntity(entityId);
    if (!node) return;

    const entity = node.properties as any;
    const currentTrust: TrustVector = entity.trust;

    // Simple moving average adjustments
    const ALPHA = 0.1; 
    let newReliability = currentTrust.reliability;
    let newLatency = currentTrust.latency;

    if (event.type === 'execution.succeeded') {
      newReliability = newReliability * (1 - ALPHA) + 1.0 * ALPHA;
      // Normalizing latency mock (assuming 1000ms is a baseline, lower is better, up to 1.0)
      const latScore = Math.max(0, 1 - (latencyMs / 2000));
      newLatency = newLatency * (1 - ALPHA) + latScore * ALPHA;
    } else {
      newReliability = newReliability * (1 - ALPHA) + 0.0 * ALPHA;
    }

    const newTrust: TrustVector = {
      ...currentTrust,
      reliability: parseFloat(newReliability.toFixed(3)),
      latency: parseFloat(newLatency.toFixed(3)),
      freshness: 1.0 // Reset freshness on any activity
    };

    console.log(`[TrustEngine] Entity ${entityId} trust updated (Reliability: ${newTrust.reliability})`);
    
    // We update trust by emitting an entity.updated event
    await kernelBus.publish({
      eventId: `evt_${Date.now()}`,
      type: 'entity.updated',
      timestamp: Date.now(),
      sourceService: 'TrustEngine',
      authority: 'system',
      payload: { ...entity, trust: newTrust },
      version: '1.0'
    });
  }
}

export const trustEngine = new TrustEngine();
