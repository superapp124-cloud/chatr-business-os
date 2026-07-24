'use strict';

/**
 * CHATR Kernel — Execution Strategy Registry
 * 
 * Manages the registration and lookup of pluggable execution strategies
 * (e.g. Local Code, Database, REST, MCP).
 */

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class StrategyRegistry {
  constructor() {
    this._strategies = new Map();
  }

  /**
   * Registers a new execution strategy.
   * @param {string} name - e.g. 'Local Code', 'Database', 'REST'
   * @param {CapabilityStrategy} strategyInstance
   */
  async register(name, strategyInstance) {
    try {
      await strategyInstance.initialize();
      this._strategies.set(name, strategyInstance);
      if (log && log.info) {
        log.info(`[StrategyRegistry] Registered strategy: ${name}`);
      }
    } catch (err) {
      if (log && log.error) {
        log.error(`[StrategyRegistry] Failed to initialize strategy '${name}': ${err.message}`);
      }
    }
  }

  /**
   * Gets a registered strategy by name.
   * @param {string} name
   * @returns {CapabilityStrategy|null}
   */
  get(name) {
    return this._strategies.get(name) || null;
  }

  /**
   * Shuts down all registered strategies.
   */
  async shutdownAll() {
    for (const [name, strategy] of this._strategies.entries()) {
      try {
        await strategy.shutdown();
      } catch (err) {
        if (log && log.warn) {
          log.warn(`[StrategyRegistry] Error shutting down strategy '${name}': ${err.message}`);
        }
      }
    }
  }
}

const strategyRegistry = new StrategyRegistry();
module.exports = { StrategyRegistry, strategyRegistry };
