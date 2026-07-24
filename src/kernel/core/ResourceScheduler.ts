import { kernelBus } from './EventBus';
import { worldModel } from '../world/WorldModel';
import { Capability } from '../abi/v1';

export class ResourceScheduler {
  constructor() {
    kernelBus.subscribe('policy.approved', this.handlePolicyApproved.bind(this));
  }

  private async handlePolicyApproved(event: any): Promise<void> {
    const { processId, intentId, targetCapability, providerEntity } = event.payload;

    try {
      const capNode = worldModel.findCapability(targetCapability);
      let requiredResources = [];
      if (capNode) {
        requiredResources = (capNode.properties as Capability).requiredResources || [];
      }

      // Mock resource check: evaluate requiredResources against system capacity
      const resourcesAvailable = true;

      if (resourcesAvailable) {
        console.log(`[ResourceScheduler] Resources allocated for process ${processId}.`);
        await kernelBus.publish({
          eventId: `evt_${Date.now()}`,
          type: 'process.resources_allocated',
          timestamp: Date.now(),
          sourceService: 'ResourceScheduler',
          authority: 'system',
          payload: { processId, intentId, targetCapability, providerEntity },
          version: '1.0'
        });
      } else {
        console.warn(`[ResourceScheduler] Insufficient resources for process ${processId}. Suspending.`);
        await kernelBus.publish({
          eventId: `evt_${Date.now()}`,
          type: 'process.suspended',
          timestamp: Date.now(),
          sourceService: 'ResourceScheduler',
          authority: 'system',
          payload: { processId, intentId, reason: 'Insufficient resources' },
          version: '1.0'
        });
      }
    } catch (err: any) {
      console.error(`[ResourceScheduler] Allocation error: ${err.message}`);
    }
  }
}

export const resourceScheduler = new ResourceScheduler();
