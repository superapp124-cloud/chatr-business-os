import { Commitment, CommitmentStatus } from './types';
import { capabilityRegistry } from './CapabilityRegistry';
import { eventBus } from '@/core/runtime/EventBus';
import { dummyProvider } from '../providers/DummyProvider';
import { playbookEngine } from '../services/PlaybookEngine';
import { telemetry } from '../services/TelemetryService';
import { securityEngine } from '../services/SecurityEngine';
import { policyEngine } from '../services/PolicyEngine';

export class CommitmentRuntimeImpl {
  private static instance: CommitmentRuntimeImpl;

  private constructor() {
    eventBus.subscribe('chatr:commitment-planned', this.handlePlannedCommitment.bind(this));
    eventBus.subscribe('chatr:commitment-observed', this.handleCommitmentObserved.bind(this));
    eventBus.subscribe('chatr:reality-verified', this.handleRealityVerified.bind(this));
    eventBus.subscribe('chatr:approval-granted', this.handleApprovalGranted.bind(this));
  }

  public static getInstance(): CommitmentRuntimeImpl {
    if (!CommitmentRuntimeImpl.instance) {
      CommitmentRuntimeImpl.instance = new CommitmentRuntimeImpl();
    }
    return CommitmentRuntimeImpl.instance;
  }

  private async handleApprovalGranted(event: any): Promise<void> {
    const { commitmentId } = event.payload;
    console.log(`[CommitmentRuntime] Approval granted for ${commitmentId}`);
    
    // In a real system, we would fetch the commitment from a store.
    // For the demo, we publish an event to let the UI know to update, 
    // but we can also just let the UI handle calling a resume method.
    // Wait, the UI has the full commitment object, we can have it send it!
    const commitment = event.payload.commitment;
    if (commitment) {
      const updated = await this.transitionState(commitment, 'suggested');
      
      const capability = capabilityRegistry.getCapability(updated.capability);
      const policy = capability?.manifest.executionPolicy || 'confirmation_required';
      
      if (policy === 'immediate') {
        await this.executeCommitment(updated);
      } else {
        eventBus.publish('chatr:commitment-suggested', { commitment: updated }, 'CommitmentRuntime');
      }
    }
  }

  private async handlePlannedCommitment(event: any): Promise<void> {
    const { commitment } = event.payload;
    await this.processCommitment(commitment);
  }

  private async handleCommitmentObserved(event: any): Promise<void> {
    const { commitment } = event.payload;
    await this.transitionState(commitment, 'observed');
  }

  private async handleRealityVerified(event: any): Promise<void> {
    const { commitment, reality } = event.payload;
    const verifiedCommitment = await this.transitionState(commitment, 'reality_verified');
    const completedCommitment = await this.transitionState(verifiedCommitment, 'completed');

    // Telemetry: record completion
    telemetry.track({
      commitmentId: commitment.id,
      capability: commitment.capability,
      event: 'completed',
      provider: reality?.provider,
    });

    // Inject a rich success card into the conversation thread + premium toast
    window.dispatchEvent(new CustomEvent('chatr:outcome-executed', {
      detail: {
        type: commitment.capability?.split('.').pop()?.toUpperCase() || 'COMMITMENT',
        text: `✅ ${commitment.title}`,
        raw: {
          title: commitment.title,
          capability: commitment.capability,
          entities: commitment.entities,
          verifiedAt: new Date().toISOString(),
          transactionId: reality?.transactionId || `TXN-${commitment.id}`,
        }
      }
    }));
  }

  public async processCommitment(commitment: Commitment): Promise<void> {
    console.log(`[CommitmentRuntime] Processing commitment: ${commitment.id} (${commitment.capability})`);

    const capability = capabilityRegistry.getCapability(commitment.capability);
    if (!capability) {
      console.error(`[CommitmentRuntime] Capability not found: ${commitment.capability}`);
      return;
    }

    // 1. Validation
    commitment = await this.transitionState(commitment, 'validated');
    const validation = await capability.validate(commitment);
    if (!validation.isValid) {
      console.warn(`[CommitmentRuntime] Validation failed for ${commitment.id}:`, validation.errors);
      telemetry.track({
        commitmentId: commitment.id,
        capability: commitment.capability,
        event: 'error',
        error: validation.errors?.join(', '),
      });
      eventBus.publish('chatr:commitment-validation-failed', { commitment, errors: validation.errors }, 'CommitmentRuntime');
      return;
    }

    // 2. Identity & Permission (Security Engine)
    // We assume the user is 'user-123' for the purpose of the demo
    const currentUser = await securityEngine.authenticate('user-123');
    if (!currentUser) {
       commitment = await this.transitionState(commitment, 'permission_denied');
       commitment.error = 'User not authenticated.';
       eventBus.publish('chatr:commitment-permission-denied', { commitment }, 'CommitmentRuntime');
       return;
    }

    const authResult = await securityEngine.authorize(currentUser, capability.manifest.id);
    if (!authResult.authorized) {
      commitment = await this.transitionState(commitment, 'permission_denied');
      commitment.error = authResult.reason || 'Permission denied.';
      eventBus.publish('chatr:commitment-permission-denied', { commitment }, 'CommitmentRuntime');
      return;
    }

    // 3. Enterprise Policy Engine
    const policyResult = await policyEngine.evaluatePolicy(commitment, currentUser);
    if (policyResult.action === 'block') {
      commitment = await this.transitionState(commitment, 'policy_blocked');
      commitment.error = policyResult.reason;
      eventBus.publish('chatr:commitment-policy-blocked', { commitment }, 'CommitmentRuntime');
      return;
    } else if (policyResult.action === 'require_approval') {
      commitment = await this.transitionState(commitment, 'approval_required');
      commitment.error = policyResult.reason; // Reusing error field for the reason temporarily
      // TODO: Track approverRole
      eventBus.publish('chatr:commitment-approval-required', { commitment }, 'CommitmentRuntime');
      return;
    }

    // 4. Proceed to Suggestion
    commitment = await this.transitionState(commitment, 'suggested');
    
    telemetry.track({
      commitmentId: commitment.id,
      capability: commitment.capability,
      event: 'suggested',
    });
    
    const policy = capability.manifest.executionPolicy;
    if (policy === 'immediate') {
      await this.executeCommitment(commitment);
    } else {
      eventBus.publish('chatr:commitment-suggested', { commitment }, 'CommitmentRuntime');
    }
  }

  public async confirmCommitment(commitment: Commitment): Promise<void> {
    const capability = capabilityRegistry.getCapability(commitment.capability);
    if (!capability) return;

    if (commitment.status === 'suggested') {
      telemetry.track({
        commitmentId: commitment.id,
        capability: commitment.capability,
        event: 'confirmed',
      });
      await playbookEngine.run(commitment, capability);
      return;
    } else if (commitment.status === 'preview_ready') {
      commitment = await this.transitionState(commitment, 'confirmed');
      telemetry.track({
        commitmentId: commitment.id,
        capability: commitment.capability,
        event: 'confirmed',
      });
      await this.executeCommitment(commitment);
    }
  }

  private async executeCommitment(commitment: Commitment): Promise<void> {
    const capability = capabilityRegistry.getCapability(commitment.capability);
    if (!capability) return;

    commitment = await this.transitionState(commitment, 'executing');
    telemetry.track({
      commitmentId: commitment.id,
      capability: commitment.capability,
      event: 'executed',
    });

    try {
      const result = await capability.executor(commitment, dummyProvider);

      if (result.success) {
        console.log(`[CommitmentRuntime] Execution successful: ${commitment.id}`);
        commitment = await this.transitionState(commitment, 'waiting');
        // Notify UI to refresh the schedule immediately
        window.dispatchEvent(new CustomEvent('chatr:schedule-updated', { detail: { commitment } }));
      } else {
        throw new Error(result.message || 'Execution failed');
      }
    } catch (err: any) {
      console.error(`[CommitmentRuntime] Execution error for ${commitment.id}:`, err);
      telemetry.track({
        commitmentId: commitment.id,
        capability: commitment.capability,
        event: 'execution_failed',
        error: err.message,
      });
      eventBus.publish('chatr:commitment-error', { commitment, error: err.message }, 'CommitmentRuntime');
    }
  }

  private async transitionState(commitment: Commitment, newState: CommitmentStatus): Promise<Commitment> {
    console.log(`[CommitmentRuntime] Transitioning ${commitment.id}: ${commitment.status} → ${newState}`);
    const updatedCommitment = { ...commitment, status: newState, updatedAt: Date.now() };
    eventBus.publish('chatr:commitment-state-changed', updatedCommitment, 'CommitmentRuntime');
    return updatedCommitment;
  }
}

export const commitmentRuntime = CommitmentRuntimeImpl.getInstance();
