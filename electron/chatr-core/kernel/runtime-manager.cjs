'use strict';

/**
 * CHATR Kernel — Runtime Manager
 *
 * Central registry mapping Capabilities -> Runtimes -> Providers.
 * The Kernel requests a Capability, and the Runtime Manager resolves
 * it to the appropriate Provider through the assigned Runtime.
 *
 * ABI v1.0
 */

const { ManifestValidator } = require('./manifests.cjs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class RuntimeManager {
  constructor() {
    this.runtimes = new Map();     // name -> Runtime instance
    this.capabilities = new Map(); // capabilityId -> manifest
    this.providers = new Map();    // capabilityId -> Array of { provider, priority, status, consecutiveFailures, id }
  }

  /**
   * Registers a Runtime domain (e.g., BrowserRuntime).
   */
  registerRuntime(name, runtimeInstance) {
    if (this.runtimes.has(name)) {
      log.warn(`[RuntimeManager] Runtime ${name} is already registered. Overwriting.`);
    }
    this.runtimes.set(name, runtimeInstance);
    log.info(`[RuntimeManager] Registered Runtime: ${name}`);
  }

  /**
   * Dynamically registers a capability using a Manifest.
   */
  registerCapability(manifestPayload, providerInstance, priority = 100) {
    try {
      const manifest = ManifestValidator.validateCapability(manifestPayload);
      
      if (!this.runtimes.has(manifest.runtime)) {
        throw new Error(`Target runtime '${manifest.runtime}' is not registered.`);
      }

      this.capabilities.set(manifest.id, manifest);
      
      if (!this.providers.has(manifest.id)) {
        this.providers.set(manifest.id, []);
      }
      
      const providerList = this.providers.get(manifest.id);
      const providerId = providerInstance.id || `provider_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      providerInstance._providerId = providerId;
      
      providerList.push({
        id: providerId,
        provider: providerInstance,
        priority,
        status: 'active',
        consecutiveFailures: 0
      });
      
      providerList.sort((a, b) => b.priority - a.priority);

      // Register the provider with its respective runtime
      const runtime = this.runtimes.get(manifest.runtime);
      runtime.registerProvider(manifest.id, providerInstance, true);

      log.info(`[RuntimeManager] Registered Capability: ${manifest.id} (${manifest.version}) -> ${manifest.runtime} (priority: ${priority})`);
      return manifest;
    } catch (err) {
      log.error(`[RuntimeManager] Capability Registration Failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Resolves a capability to its highest-priority active provider.
   */
  getProviderForCapability(capabilityId) {
    const providerList = this.providers.get(capabilityId);
    if (!providerList || providerList.length === 0) {
      const { CapabilityNotBoundError } = require('./errors.cjs');
      throw new CapabilityNotBoundError(`No provider registered for capability: ${capabilityId}`, { capability: capabilityId });
    }
    const activeProvider = providerList.find(p => p.status === 'active' || p.status === 'degraded');
    if (!activeProvider) {
      const { ProviderFailoverExhaustedError } = require('./errors.cjs');
      throw new ProviderFailoverExhaustedError(`All providers for capability ${capabilityId} have failed.`, { capability: capabilityId });
    }
    return activeProvider.provider;
  }
  
  /**
   * Records a provider failure, handles failover logic.
   */
  recordProviderFailure(capabilityId, providerId) {
    const providerList = this.providers.get(capabilityId);
    if (!providerList) return null;
    
    const providerEntry = providerList.find(p => p.id === providerId);
    if (providerEntry) {
      providerEntry.consecutiveFailures++;
      if (providerEntry.consecutiveFailures >= 3) {
        providerEntry.status = 'failed';
        log.warn(`[RuntimeManager] Provider ${providerId} for ${capabilityId} marked as failed.`);
        
        try {
          const { bus } = require('../events/bus.cjs');
          bus.publish('PROVIDER_FAILOVER', { capabilityId, failedProviderId: providerId });
        } catch (e) {
          // Bus might not be available
        }
      }
    }
    
    // Return the next active provider
    const nextActive = providerList.find(p => p.status === 'active' || p.status === 'degraded');
    return nextActive ? nextActive.provider : null;
  }

  /**
   * Records a successful execution by a provider, resetting failure counts.
   */
  recordProviderSuccess(capabilityId, providerId) {
    const providerList = this.providers.get(capabilityId);
    if (!providerList) return;
    
    const providerEntry = providerList.find(p => p.id === providerId);
    if (providerEntry) {
      providerEntry.consecutiveFailures = 0;
      providerEntry.status = 'active';
    }
  }
  
  /**
   * Retrieves a specific runtime by name.
   */
  getRuntime(name) {
    return this.runtimes.get(name);
  }

  // --- Discovery & Introspection API ---

  discover() {
    return Array.from(this.capabilities.values());
  }

  searchCapabilities(query) {
    const q = query.toLowerCase();
    return this.discover().filter(c => 
      c.id.toLowerCase().includes(q) || 
      c.name.toLowerCase().includes(q) || 
      c.category.toLowerCase().includes(q)
    );
  }

  inspectCapability(capabilityId) {
    return this.capabilities.get(capabilityId);
  }

  hasCapability(capabilityId) {
    return this.capabilities.has(capabilityId);
  }

  getCapability(capabilityId) {
    return this.capabilities.get(capabilityId) || null;
  }

  getDependencies(capabilityId) {
    const cap = this.capabilities.get(capabilityId);
    return cap ? cap.dependencies : [];
  }

  /**
   * Polls all registered runtimes for their current health state.
   */
  getSystemHealth() {
    const health = {};
    for (const [name, runtime] of this.runtimes.entries()) {
      health[name] = typeof runtime.getHealth === 'function' ? runtime.getHealth() : 'Unknown';
    }
    return health;
  }
}

const runtimeManager = new RuntimeManager();
module.exports = { runtimeManager, RuntimeManager };
