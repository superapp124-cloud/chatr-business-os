'use strict';

const { CapabilityStrategy } = require('./CapabilityStrategy.cjs');
const crypto = require('crypto');

/**
 * Strategy for executing local SQLite Database providers.
 */
class DatabaseStrategy extends CapabilityStrategy {
  async initialize() {}

  validate(providerManifest, parameters) {
    if (providerManifest.executionStrategy !== 'Database') return false;
    return true;
  }

  async execute(providerInstance, capabilityId, parameters, context = {}) {
    if (!providerInstance || typeof providerInstance.execute !== 'function') {
      throw new Error(`Database provider missing execute(capabilityId, parameters, context) method`);
    }
    
    // Database calls are usually synchronous in better-sqlite3, but we wrap in Promise
    // to match the asynchronous strategy interface.
    return new Promise((resolve, reject) => {
      try {
        const result = providerInstance.execute(capabilityId, parameters, context);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  }

  async cancel(executionId) {
    return { status: 'cannot_cancel_sync_db_call' };
  }

  async retry(providerInstance, capabilityId, parameters, context, attemptCount) {
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
      type: 'database_execution',
      timestamp: new Date().toISOString(),
      payloadHash: crypto.createHash('sha256').update(JSON.stringify(rawResult || {})).digest('hex'),
      raw: rawResult
    }];
  }

  async shutdown() {}
}

module.exports = { DatabaseStrategy };
