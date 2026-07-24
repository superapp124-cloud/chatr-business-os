import { Commitment, RealityVerificationResult } from '../capabilities/types';
import { capabilityRegistry } from '../capabilities/CapabilityRegistry';
import { eventBus } from '@/core/runtime/EventBus';
import { Provider } from '../capabilities/types'; // Using dummy provider logic elsewhere or injecting it.
import { dummyProvider } from '../providers/DummyProvider'; // We'll create this

export class RealityEngineImpl {
  private static instance: RealityEngineImpl;

  private constructor() {
    // Listen for commitments entering the 'waiting' state
    eventBus.subscribe('chatr:commitment-state-changed', this.handleStateChange.bind(this));
    
    // Listen for asynchronous completion events
    eventBus.subscribe('chatr:timer-fired', this.handleTimerFired.bind(this));
  }

  public static getInstance(): RealityEngineImpl {
    if (!RealityEngineImpl.instance) {
      RealityEngineImpl.instance = new RealityEngineImpl();
    }
    return RealityEngineImpl.instance;
  }

  private async handleStateChange(event: any): Promise<void> {
    const commitment: Commitment = event.payload;
    // RealityEngine attempts verification in waiting or observed states
    if (commitment.status === 'waiting' || commitment.status === 'observed') {
      await this.verify(commitment);
    }
  }

  private async handleTimerFired(event: any): Promise<void> {
    const { commitmentId } = event.payload;
    console.log(`[RealityEngine] Observation received for ${commitmentId}.`);
    
    // We notify the runtime that the commitment was observed
    eventBus.publish('chatr:commitment-observed', {
      commitment: { id: commitmentId, capability: 'core.reminder' } // Normally we fetch the full commitment
    }, 'RealityEngine');
  }

  public async verify(commitment: Commitment): Promise<void> {
    console.log(`[RealityEngine] Verifying reality for commitment: ${commitment.id}`);
    
    const capability = capabilityRegistry.getCapability(commitment.capability);
    if (!capability || !capability.verifier) {
      // If a capability doesn't define a verifier, we assume it's instantaneous or unverifiable (like a Note)
      console.log(`[RealityEngine] No verifier for ${commitment.id}. Assuming verified.`);
      this.markVerified(commitment, { verified: true, message: 'Auto-verified (no verifier)' });
      return;
    }

    try {
      // In a real system, the provider would be fetched from a registry
      const reality = await capability.verifier(commitment, dummyProvider);
      
      if (reality.verified) {
        this.markVerified(commitment, reality);
      } else {
        console.warn(`[RealityEngine] Reality Verification failed for ${commitment.id}: ${reality.message}`);
        eventBus.publish('chatr:commitment-verification-failed', { commitment, reality }, 'RealityEngine');
        
        // Polling logic would go here: e.g. schedule another verification check if supported.
      }
    } catch (err: any) {
      console.error(`[RealityEngine] Error verifying ${commitment.id}:`, err);
      eventBus.publish('chatr:commitment-verification-error', { commitment, error: err.message }, 'RealityEngine');
    }
  }

  private markVerified(commitment: Commitment, reality: RealityVerificationResult) {
    eventBus.publish('chatr:reality-verified', { commitment, reality }, 'RealityEngine');
    
    // The CommitmentRuntime listens to this and advances state to 'completed'
  }
}

export const realityEngine = RealityEngineImpl.getInstance();
