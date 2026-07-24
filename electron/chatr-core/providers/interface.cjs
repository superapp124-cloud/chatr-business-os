'use strict';

/**
 * CHATR Kernel — AIProvider Interface Contract
 *
 * All providers MUST implement every method listed here.
 * If a method is not supported, it must return a clear error — not throw silently.
 *
 * Genesis v1.0
 */

/**
 * @typedef {object} AIProvider
 * @property {(messages: object[], opts?: object) => Promise<string>} generate
 * @property {(messages: object[], opts: object, onToken: Function) => Promise<void>} stream
 * @property {() => void} cancel
 * @property {() => Promise<ProviderHealth>} health
 * @property {() => Promise<Model[]>} listModels
 * @property {(modelName: string) => Promise<void>} pullModel
 */

/**
 * @typedef {object} ProviderHealth
 * @property {boolean} ok
 * @property {string} provider
 * @property {string[]} readyModels
 * @property {number} latencyMs
 * @property {string|null} error
 */

/**
 * @typedef {object} Model
 * @property {string} name
 * @property {number} size
 */

/**
 * Validate that a provider implements the full interface.
 * Throws if any method is missing.
 */
function validateProvider(name, provider) {
  const required = ['generate', 'stream', 'cancel', 'health', 'listModels', 'pullModel'];
  for (const method of required) {
    if (typeof provider[method] !== 'function') {
      throw new Error(`[AIProvider] Provider "${name}" is missing required method: ${method}()`);
    }
  }
}

module.exports = { validateProvider };
