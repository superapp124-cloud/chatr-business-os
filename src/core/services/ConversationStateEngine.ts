import { Commitment } from '../capabilities/types';
import { playbookEngine } from './PlaybookEngine';
import { capabilityRegistry } from '../capabilities/CapabilityRegistry';
import { eventBus } from '../runtime/EventBus';
import { kernelAPI } from '../runtime/KernelAPI';

/**
 * Conversation State Engine (Sprint 1)
 * 
 * Manages active multi-turn conversations.
 * Intercepts user input to fulfill missing fields of suspended commitments 
 * before falling back to global intent detection.
 */
class ConversationStateEngine {
  private activeCommitmentId: string | null = null;
  private stateLock = false;

  constructor() {
    // Listen for commitments that enter needs_input state
    eventBus.subscribe('chatr:commitment-state-changed', (commitment: Commitment) => {
      if (commitment.status === 'needs_input') {
        this.activeCommitmentId = commitment.id;
      } else if (['completed', 'canceled', 'results_ready', 'preview_ready'].includes(commitment.status)) {
        if (this.activeCommitmentId === commitment.id) {
          this.activeCommitmentId = null;
        }
      }
    });
  }

  /**
   * Attempts to process incoming text against the active conversation state.
   * Returns true if the input was absorbed (preventing normal intent detection).
   */
  public async processInput(text: string): Promise<boolean> {
    if (!text || text.trim().length === 0) return false;
    if (this.stateLock) return false;

    // Check if we have an active commitment waiting for input
    if (!this.activeCommitmentId) return false;

    // Fetch the active commitment from the Kernel
    const runtime = kernelAPI.state.get('runtime');
    const commitments = runtime.commitments || [];
    const commitment = commitments.find((c: Commitment) => c.id === this.activeCommitmentId);

    if (!commitment || commitment.status !== 'needs_input' || !commitment.missingFields || commitment.missingFields.length === 0) {
      this.activeCommitmentId = null;
      return false; // Stale state
    }

    this.stateLock = true;
    try {
      // For now, we take the text and apply it to the first missing field.
      // A more advanced resolver would use an LLM to map the text to the correct field.
      const targetField = commitment.missingFields[0];
      
      console.log(`[ConversationStateEngine] Intercepted input for missing field '${targetField.key}':`, text);
      
      const capability = capabilityRegistry.getCapability(commitment.capability);
      if (capability) {
        // Resume the playbook directly
        await playbookEngine.resumeWithInput(commitment, capability, targetField.key, text);
        
        // Return true to indicate the input was handled inline
        return true;
      }
    } catch (e) {
      console.error('[ConversationStateEngine] Failed to process input:', e);
    } finally {
      this.stateLock = false;
    }

    return false;
  }

  /**
   * Clears the active conversation state.
   */
  public clearActiveState(): void {
    this.activeCommitmentId = null;
  }

  public getActiveCommitmentId(): string | null {
    return this.activeCommitmentId;
  }
}

export const conversationStateEngine = new ConversationStateEngine();
