import { kernelBus } from '../core/EventBus';
import { worldModel } from '../world/WorldModel';
import { EntityId, HealthStatus } from '../abi/v1';

export class HealthEngine {
  constructor() {
    kernelBus.subscribe('execution.succeeded', this.handleExecutionOutcome.bind(this));
    kernelBus.subscribe('execution.failed', this.handleExecutionOutcome.bind(this));
  }

  private async handleExecutionOutcome(event: any): Promise<void> {
    const { entityId, error } = event.payload;
    if (!entityId) return;

    const node = worldModel.findEntity(entityId);
    if (!node) return;

    const entity = node.properties as any;
    let newHealth: HealthStatus = entity.health || 'ONLINE';

    if (event.type === 'execution.succeeded') {
      newHealth = 'ONLINE';
    } else if (event.type === 'execution.failed') {
      if (error && error.includes('TIMEOUT')) {
        newHealth = 'QUARANTINED';
      } else if (error && error.includes('429')) {
        newHealth = 'RATE_LIMITED';
      } else {
        newHealth = 'DEGRADED';
      }
    }

    if (newHealth !== entity.health) {
      console.log(`[HealthEngine] Entity ${entityId} health changed to ${newHealth}`);
      // Emit event to update World Model
      await kernelBus.publish({
        eventId: `evt_${Date.now()}`,
        type: 'entity.updated',
        timestamp: Date.now(),
        sourceService: 'HealthEngine',
        authority: 'system',
        payload: { ...entity, health: newHealth },
        version: '1.0'
      });
    }
  }
}

export const healthEngine = new HealthEngine();
