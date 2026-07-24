'use strict';

/**
 * CHATR Kernel — Provider Registry
 *
 * No module directly instantiates new OllamaProvider().
 * All providers are resolved through this registry.
 * Swap providers (Anthropic, Gemini, OpenAI) without touching Conversation Module.
 *
 * Genesis v1.0
 */

const providerConfig = require('../config/provider.config.cjs');

class ProviderRegistry {
  constructor() {
    this._providers = new Map();
    this._activeProviderName = null;
  }

  /**
   * Register a provider implementation.
   * @param {string} name - e.g. 'ollama'
   * @param {object} provider - implements AIProvider interface
   */
  register(name, provider) {
    this._providers.set(name, provider);
  }

  /**
   * Set the active provider by name.
   */
  setActive(name) {
    if (!this._providers.has(name)) {
      throw new Error(`[ProviderRegistry] Provider "${name}" is not registered.`);
    }
    this._activeProviderName = name;
  }

  /**
   * Resolve and return the currently active provider.
   */
  resolve() {
    const name = this._activeProviderName || providerConfig.default;
    const provider = this._providers.get(name);
    if (!provider) {
      throw new Error(`[ProviderRegistry] No provider resolved. Registered: ${[...this._providers.keys()].join(', ')}`);
    }
    return provider;
  }

  /**
   * Get provider name for diagnostics.
   */
  getActiveName() {
    return this._activeProviderName || providerConfig.default;
  }

  /**
   * List all registered providers.
   */
  list() {
    return [...this._providers.keys()];
  }
}

const providerRegistry = new ProviderRegistry();

module.exports = { providerRegistry };
