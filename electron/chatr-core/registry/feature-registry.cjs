'use strict';

/**
 * CHATR Kernel — Feature Registry
 *
 * Modules register themselves here at boot.
 * Nothing is static. Dynamic module loading lives here.
 *
 * Genesis v1.0
 */

const { bus } = require('../events/bus.cjs');
const { CORE } = require('../events/events.cjs');

class FeatureRegistry {
  constructor() {
    this._modules = new Map();
  }

  /**
   * Register a module with the kernel.
   * @param {object} manifest - contents of module.json
   * @param {object} handler  - { router, service } (optional)
   */
  register(manifest, handler = {}) {
    if (!manifest?.name) throw new Error('[FeatureRegistry] Module manifest must have a name.');

    this._modules.set(manifest.name, {
      manifest,
      handler,
      registeredAt: Date.now(),
    });

    bus.publish(CORE.MODULE_REGISTERED, {
      module: manifest.name,
      version: manifest.version,
      status: manifest.status,
    });
  }

  /**
   * Check if a module is registered and enabled.
   */
  isEnabled(name) {
    return this._modules.has(name) && this._modules.get(name).manifest.status !== 'disabled';
  }

  /**
   * Get a module handler by name.
   */
  get(name) {
    return this._modules.get(name)?.handler ?? null;
  }

  /**
   * List all registered modules (for health/diagnostics).
   */
  list() {
    return [...this._modules.values()].map(({ manifest, handler, registeredAt }) => ({
      name: manifest.name,
      version: manifest.version,
      status: manifest.status,
      handler,
      registeredAt,
    }));
  }
}

const featureRegistry = new FeatureRegistry();

module.exports = { featureRegistry };
