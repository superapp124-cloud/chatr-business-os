'use strict';

/**
 * CHATR Kernel — Capability Strategy Interface
 * 
 * The stable interface that every Execution Strategy must implement.
 * Whether it's Local Code, Database, REST, MCP, Browser Automation, or LLM,
 * the Capability Runtime interacts with them uniformly through this contract.
 */

class CapabilityStrategy {
  /**
   * Called once when the strategy is loaded into the registry.
   */
  async initialize() {
    throw new Error('initialize() must be implemented by strategy');
  }

  /**
   * Validates that the provider manifest and parameters are compatible with this strategy.
   * @param {object} providerManifest
   * @param {object} parameters
   * @returns {boolean}
   */
  validate(providerManifest, parameters) {
    throw new Error('validate() must be implemented by strategy');
  }

  /**
   * Executes the capability via the provider.
   * @param {object} provider - The instantiated provider or connection
   * @param {object} parameters - The resolved capability inputs
   * @param {object} context - Execution context (timeout, identity, etc)
   * @returns {Promise<object>} - Raw execution result
   */
  async execute(provider, parameters, context) {
    throw new Error('execute() must be implemented by strategy');
  }

  /**
   * Cancels a running execution.
   */
  async cancel(executionId) {
    throw new Error('cancel() must be implemented by strategy');
  }

  /**
   * Retries an execution based on policy.
   */
  async retry(provider, parameters, context, attemptCount) {
    throw new Error('retry() must be implemented by strategy');
  }

  /**
   * Compensates (rolls back or reverses) a completed or failed execution.
   */
  async compensate(provider, executionReceipt, compensationPolicy) {
    throw new Error('compensate() must be implemented by strategy');
  }

  /**
   * Transforms raw execution output into standard Kernel Evidence blocks.
   * @param {object} rawResult
   * @returns {Array<object>}
   */
  collectEvidence(rawResult) {
    throw new Error('collectEvidence() must be implemented by strategy');
  }

  /**
   * Called when the kernel shuts down.
   */
  async shutdown() {
    throw new Error('shutdown() must be implemented by strategy');
  }
}

module.exports = { CapabilityStrategy };
