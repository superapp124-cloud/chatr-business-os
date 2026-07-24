/**
 * CHATR Kernel 1.0 — Policy Engine
 *
 * Sits between Context Runtime and Entity Graph.
 * Enforces permissions, privacy, confirmation requirements, and enterprise rules.
 * Governs WHAT may happen, distinct from Context (which governs what the user likely means).
 */

const { bus } = require('../events/bus.cjs');

class PolicyEngine {
  constructor() {
    this.rules = [
      this.requireConfirmationRule,
      this.financialBiometricRule,
      this.destructiveActionRule
    ];
  }

  /**
   * Evaluates an understanding against all kernel policies.
   * Returns a modified understanding with policy flags (e.g. requiresConfirmation).
   */
  async evaluate(understanding, contextAnchor) {
    bus.publish('KERNEL.POLICY.EVALUATION_STARTED', { id: understanding.id });

    // Base policy flags
    understanding.policy = {
      requiresConfirmation: false,
      requiresBiometric: false,
      blocked: false,
      reason: null
    };

    for (const rule of this.rules) {
      try {
        await rule(understanding, contextAnchor);
      } catch (err) {
        console.error('[PolicyEngine] Rule failed', err);
      }
    }

    bus.publish('KERNEL.POLICY.VERIFIED', { 
      id: understanding.id, 
      policy: understanding.policy 
    });

    return understanding;
  }

  // --- Rules ---

  async requireConfirmationRule(understanding) {
    // Law 4: Confirm before execution. 
    // Almost everything requires explicit user confirmation via Universal Action Surface.
    understanding.policy.requiresConfirmation = true;
  }

  async financialBiometricRule(understanding) {
    if (understanding.type === 'PAYMENT' || understanding.type === 'TRANSFER') {
      understanding.policy.requiresBiometric = true;
      understanding.policy.requiresConfirmation = true;
    }
  }

  async destructiveActionRule(understanding) {
    if (understanding.type === 'DELETE' || understanding.type === 'CANCEL') {
      understanding.policy.requiresConfirmation = true;
    }
  }
}

module.exports = new PolicyEngine();
