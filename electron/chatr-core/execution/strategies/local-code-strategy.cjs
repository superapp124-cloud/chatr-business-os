'use strict';

const { CapabilityStrategy } = require('./CapabilityStrategy.cjs');
const crypto = require('crypto');

/**
 * Strategy for executing local JavaScript classes/modules.
 */
class LocalCodeStrategy extends CapabilityStrategy {
  async initialize() {
    // Nothing required to initialize local code engine
  }

  validate(providerManifest, parameters) {
    if (providerManifest.executionStrategy !== 'Local Code') return false;
    return true; // We could add schema validation here based on CapabilityProfile
  }

  async execute(providerInstance, capabilityId, parameters, context = {}) {
    if (!providerInstance || typeof providerInstance.execute !== 'function') {
      throw new Error(`Local provider missing execute(capabilityId, parameters, context) method`);
    }
    
    // Support timeout natively
    const timeoutMs = context.timeoutMs || 30000;
    
    return Promise.race([
      providerInstance.execute(capabilityId, parameters, context),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Local execution timed out')), timeoutMs))
    ]);
  }

  async cancel(executionId) {
    // Local code usually runs synchronously or in a tight async loop. 
    // True cancellation requires AbortController passed in context.
    return { status: 'cancellation_requested' };
  }

  async retry(providerInstance, capabilityId, parameters, context, attemptCount) {
    // Simple pass-through. The CapabilityRuntime handles the loop.
    return this.execute(providerInstance, capabilityId, parameters, context);
  }

  async compensate(providerInstance, executionReceipt, compensationPolicy) {
    if (typeof providerInstance.compensate === 'function') {
      return providerInstance.compensate(executionReceipt, compensationPolicy);
    }
    return { status: 'no_compensation_supported' };
  }

  collectEvidence(rawResult) {
    return [{
      type: 'local_code_execution',
      timestamp: new Date().toISOString(),
      payloadHash: crypto.createHash('sha256').update(JSON.stringify(rawResult || {})).digest('hex'),
      raw: rawResult
    }];
  }

  async shutdown() {}
}

module.exports = { LocalCodeStrategy };
