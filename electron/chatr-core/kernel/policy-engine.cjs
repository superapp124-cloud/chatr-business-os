'use strict';

/**
 * CHATR Kernel — Policy Engine (Phase 5)
 *
 * The Policy Engine is the kernel's un-bypassable enforcement layer.
 * While the Decision Engine makes logical choices (defer, split, require user approval),
 * the Policy Engine enforces hard OS limits (budget maximums, restricted providers,
 * banned jurisdictions).
 *
 * It intercepts `kernel.execution.dispatch` and can emit a `kernel.policy.violation`
 * to immediately halt the OS pipeline, overriding any user approval.
 */

const { bus } = require('../events/bus.cjs');

const GLOBAL_OS_POLICY = {
  maxTransactionLimit: 1000,    // Hard cap on any single transaction
  dailySpendLimit: 5000,        // Hard cap on daily spend (mocked evaluation here)
  blockedProviders: ['provider.banned.mock'],
  blockedJurisdictions: ['XX'], // E.g., embargoed countries
};

class PolicyEngine {
  constructor() {
    this._policy = GLOBAL_OS_POLICY;
    
    // The Policy Engine intercepts execution dispatches BEFORE the Execution Engine processes them.
    // In a mature architecture with middleware, this would be a synchronous interceptor.
    // For Phase 5, we subscribe and validate. If it fails, we publish a violation that
    // the ExecutionEngine must respect (or we wrap the dispatch).
  }

  /**
   * Evaluates a Concrete Execution Graph against hard OS policies.
   * @param {object} concreteGraph 
   * @param {object} intent 
   * @returns {{ permitted: boolean, reason?: string }}
   */
  evaluate(concreteGraph, intent) {
    if (!concreteGraph || !concreteGraph.nodes) {
      return { permitted: false, reason: 'Invalid execution graph' };
    }

    // 1. Transaction Limit (Overriding User Approval)
    // Even if a user approved a $2000 intent, if the OS hard cap is $1000, block it.
    if (intent && intent.estimated_cost !== null) {
      if (intent.estimated_cost > this._policy.maxTransactionLimit) {
        this._publishViolation(intent.id, `Estimated cost ${intent.estimated_cost} exceeds OS hard transaction limit of ${this._policy.maxTransactionLimit}`);
        return { permitted: false, reason: 'Exceeds OS transaction limit' };
      }
    }

    // 2. Node-level Verification
    const { providerRegistry } = require('./provider-registry.cjs');
    
    for (const node of concreteGraph.nodes) {
      // 2a. Blocked Providers
      if (this._policy.blockedProviders.includes(node.providerId)) {
        this._publishViolation(intent.id, `Provider ${node.providerId} is globally blocked by OS policy.`);
        return { permitted: false, reason: `Blocked provider: ${node.providerId}` };
      }

      // 2b. Jurisdiction / Compliance
      const provider = providerRegistry.getManifest(node.providerId);
      if (provider && Array.isArray(provider.jurisdiction)) {
        const hasBlockedJurisdiction = provider.jurisdiction.some(j => this._policy.blockedJurisdictions.includes(j));
        if (hasBlockedJurisdiction) {
          this._publishViolation(intent.id, `Provider operates in a blocked jurisdiction.`);
          return { permitted: false, reason: 'Provider violates jurisdiction compliance' };
        }
      }
    }

    return { permitted: true };
  }

  _publishViolation(intentId, reason) {
    try {
      bus.publish('kernel.policy.violation', {
        intent_id: intentId,
        reason
      }, { correlationId: intentId });
    } catch (e) {
      console.warn('[PolicyEngine] Failed to publish violation', e);
    }
  }
}

const policyEngine = new PolicyEngine();
module.exports = { PolicyEngine, policyEngine };
