'use strict';

/**
 * CHATR Kernel — Execution Adapter Runtime (Phase 5.3)
 *
 * Replaces domain-specific adapters. This is a generic runtime that maps
 * a Capability Contract (e.g. transport.book) into a Provider Manifest's schema,
 * and executes it via the associated Execution Strategy (e.g. Browser, API).
 */

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class ExecutionAdapterRuntime {
  constructor() {}

  /**
   * Execute an intent using the correct provider and strategy based on generic mapping.
   *
   * @param {string} capabilityId e.g. "transport.book"
   * @param {object} provider e.g. IRCTC provider config
   * @param {object} constraints e.g. { from, to, date }
   * @param {object} strategy e.g. BrowserStrategy or ApiStrategy instance
   */
  async execute(capabilityId, provider, constraints, strategy) {
    log.info(`[ExecutionAdapter] Routing capability '${capabilityId}' through provider '${provider.id}'`);

    // 1. Verify Trust & Permissions on the Provider Manifest
    if (provider.trust === 'RESTRICT') {
      log.warn(`[ExecutionAdapter] Provider ${provider.id} is RESTRICTED. Extra validation needed.`);
    }

    // 2. Map constraints into provider's required format
    // This assumes the provider has a "mapping" block, or we pass standard constraints down.
    const mappedPayload = this._mapConstraints(constraints, provider);

    // 3. Delegate to the Strategy Runtime
    // The Strategy executes the declarative workflow definition with the mapped payload
    if (strategy && typeof strategy.execute === 'function') {
      log.info(`[ExecutionAdapter] Delegating to Strategy: ${strategy.constructor.name}`);
      const result = await strategy.execute(capabilityId, mappedPayload, provider);
      return result;
    } else {
      log.error(`[ExecutionAdapter] No valid strategy found for provider ${provider.id}`);
      throw new Error('Execution Strategy not implemented for this provider.');
    }
  }

  _mapConstraints(constraints, provider) {
    // In a fully declarative system, provider.manifest would define an input schema mapping.
    // E.g., constraints.from -> provider.mapping.fromField
    // For now, we pass constraints straight through.
    return { ...constraints, _providerSignature: provider.signature || 'unsigned' };
  }
}

const executionAdapter = new ExecutionAdapterRuntime();
module.exports = { executionAdapter, ExecutionAdapterRuntime };
