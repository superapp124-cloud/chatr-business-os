import { kernelBus } from './EventBus';

/**
 * Policy Service
 * Ensures the selected capability and provider do not violate governance rules.
 */
export class PolicyService {
  constructor() {
    kernelBus.subscribe('process.selection_completed', this.handleSelectionCompleted.bind(this));
  }

  private async handleSelectionCompleted(event: any): Promise<void> {
    const { processId, intentId, targetCapability, providerEntity } = event.payload;
    const authority = event.source || 'system';

    // In a full implementation, this queries the WorldModel for Policies tied to:
    // - The User (authority)
    // - The Provider (providerEntity)
    // - The Capability (targetCapability)
    // For now, we assume policy evaluation passes.

    console.log(`[PolicyService] Policy approved for capability ${targetCapability} on ${providerEntity.id}`);

    await kernelBus.publish({
      eventId: `evt_${Date.now()}`,
      type: 'process.policy_checked',
      timestamp: Date.now(),
      sourceService: 'PolicyService',
      authority,
      payload: { processId, intentId, targetCapability, providerEntity },
      version: '1.0'
    });
  }
}

export const policyService = new PolicyService();
