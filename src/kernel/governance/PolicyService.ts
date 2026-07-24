import { kernelBus } from '../core/EventBus';
import { worldModel } from '../world/WorldModel';

export class PolicyService {
  constructor() {
    kernelBus.subscribe('process.spawned', this.evaluatePolicies.bind(this));
  }

  private async evaluatePolicies(event: any): Promise<void> {
    const { processId, intentId, targetCapability } = event.payload;

    try {
      // Basic mock evaluation: 
      // In a full implementation, this checks the `targetCapability` against
      // active Policy constraints (e.g., "no external API calls for sensitive intents").
      
      const isApproved = true; // Always true for MVP
      
      if (isApproved) {
        console.log(`[PolicyService] Process ${processId} approved by governance.`);
        await kernelBus.publish({
          eventId: `evt_${Date.now()}`,
          type: 'policy.approved',
          timestamp: Date.now(),
          sourceService: 'PolicyService',
          authority: 'system',
          payload: { processId, intentId, targetCapability },
          version: '1.0'
        });
      } else {
        console.warn(`[PolicyService] Process ${processId} rejected by governance.`);
        await kernelBus.publish({
          eventId: `evt_${Date.now()}`,
          type: 'process.failed',
          timestamp: Date.now(),
          sourceService: 'PolicyService',
          authority: 'system',
          payload: { processId, intentId, error: 'Policy check failed' },
          version: '1.0'
        });
      }
    } catch (err: any) {
      console.error(`[PolicyService] Evaluation error: ${err.message}`);
    }
  }
}

export const policyService = new PolicyService();
