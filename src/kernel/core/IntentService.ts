import { kernelBus } from './EventBus';
import { kernel } from '../abi';
import { EntityId, Priority } from '../abi/v1';

export class IntentService {
  constructor() {
    kernelBus.subscribe('IntentSubmitted', this.handleIntentSubmitted.bind(this));
  }

  private async handleIntentSubmitted(event: any): Promise<void> {
    const rawInput = event.payload.input;
    const authority = event.authority || 'system';

    // 1. Submit intent directly to the Kernel ABI
    const intentId = await kernel.submitIntent({
      source: authority as EntityId,
      goal: { rawInput },
      constraints: [],
      priority: 0.5 as Priority,
      context: {
        entityId: authority as EntityId,
        timestamp: Date.now(),
        metadata: {}
      }
    });

    // 2. Spawn a Process for this Intent
    // This establishes the execution backbone for tracking and managing the work
    await kernel.spawnProcess(intentId, 'Workflow');
  }
}

export const intentService = new IntentService();
