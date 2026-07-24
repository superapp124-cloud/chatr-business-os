'use strict';

/**
 * CHATR OS Connector SDK
 * 
 * Every dynamic connector must export a class that extends this BaseConnector.
 * This standardizes execution, health checks, and metadata.
 */
class BaseConnector {
  /**
   * @param {object} manifest - The parsed manifest.json
   * @param {object} context - Execution context (e.g., vault, logger, filesystem access)
   */
  constructor(manifest, context) {
    this.manifest = manifest;
    this.context = context;
    this.id = manifest.id || 'unknown';
  }

  /**
   * Defines the capabilities this connector supports natively.
   * Format: ['transport.search', 'transport.book']
   */
  capabilities() {
    return this.manifest.capabilities || [];
  }

  /**
   * Health Check implementation. Should ping the service or check session validity.
   * @returns {Promise<{ healthy: boolean, reason?: string, latencyMs?: number }>}
   */
  async healthCheck() {
    return { healthy: true, reason: 'Not implemented' };
  }

  /**
   * Authenticate logic.
   * If OAuth/API keys, check the vault. If browser, inject cookies.
   * @returns {Promise<object>} session details or tokens
   */
  async authenticate() {
    throw new Error(`[${this.id}] authenticate() not implemented.`);
  }

  /**
   * Executes a specific capability.
   * @param {string} capabilityId - e.g., 'transport.search'
   * @param {object} parameters - Intent parameters
   * @param {object} session - Authenticated session data
   * @param {function} onStep - Callback for streaming browser steps/status updates
   * @returns {Promise<any>}
   */
  async execute(capabilityId, parameters, session, onStep = () => {}) {
    throw new Error(`[${this.id}] execute() not implemented for ${capabilityId}`);
  }

  /**
   * Verifies an execution after it has completed (e.g. check ride status).
   * @param {string} executionId 
   */
  async verify(executionId) {
    throw new Error(`[${this.id}] verify() not implemented.`);
  }

  /**
   * Rolls back an execution if possible (e.g. cancel booking).
   * @param {string} executionId 
   */
  async rollback(executionId) {
    throw new Error(`[${this.id}] rollback() not implemented.`);
  }
}

module.exports = { BaseConnector };
