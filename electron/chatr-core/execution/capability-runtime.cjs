'use strict';

/**
 * CHATR Kernel — Capability Runtime
 * 
 * The execution nucleus. Validates capability contracts, enforces policy,
 * resolves optimal providers through the Decision Engine, invokes the
 * appropriate strategy, normalizes evidence, and hands verified results
 * back to the Event-Sourced Kernel.
 */

const { strategyRegistry } = require('./strategies/strategy-registry.cjs');
const { capabilityMonitor } = require('./capability-monitor.cjs');
const { capabilityContractValidator } = require('../capabilities/capability-contract-validator.cjs');
const { capabilityCatalog } = require('./capability-catalog.cjs');
const { executionMemory } = require('./execution-memory.cjs');
const { providerIntelligence } = require('../intelligence/provider-intelligence.cjs');
const { verificationEngine } = require('../kernel/verification-engine.cjs');
const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class CapabilityRuntime {
  
  /**
   * Resolves and executes a capability.
   * @param {string} capabilityId - E.g. 'Knowledge.Store'
   * @param {object} parameters - Input data
   * @param {object} context - Workflow execution context
   * @returns {Promise<object>} - Normalized Evidence Block
   */
  async executeCapability(capabilityId, parameters, context = {}) {
    const startTime = Date.now();
    let selectedProviderManifest = null;

    try {
      // 1. Validation
      const validationResult = capabilityContractValidator.validate(capabilityId, parameters);
      if (!validationResult.valid) {
        throw new Error(`Capability contract validation failed: Missing [${validationResult.missing.join(', ')}]`);
      }

      // 2. Policy Pre-check (handled by Policy Service usually, but stubbed here as part of contract)
      const profile = validationResult.contract;
      if (profile && profile.policies && profile.policies.includes('offline_first') && !context.offline_allowed) {
        // Just an example check
      }

      // 3. Provider Discovery Waterfall
      const optimalProviders = executionMemory.getOptimalRouting(capabilityId);
      
      let selectedProvider = null;
      let strategy = null;
      let strategyName = null;

      // Waterfall Step 1: Execution Memory
      if (optimalProviders.length > 0) {
        log.info(`[CapabilityRuntime] Execution Memory found optimal routing for ${capabilityId}`);
        for (const provId of optimalProviders) {
           const prov = capabilityCatalog.getProvider(provId);
           if (prov) {
             selectedProvider = prov;
             break;
           }
        }
      }

      // Waterfall Step 2: Capability Catalog
      if (!selectedProvider) {
        log.info(`[CapabilityRuntime] Querying Capability Catalog for ${capabilityId}`);
        const candidates = capabilityCatalog.getProvidersForCapability(capabilityId);
        if (candidates.length > 0) {
          selectedProvider = candidates[0]; // Take highest ranked
        }
      }

      // Waterfall Step 3: Provider Intelligence (Dynamic Discovery)
      if (!selectedProvider) {
        log.info(`[CapabilityRuntime] Capability missing. Handing off to Provider Intelligence for discovery.`);
        selectedProvider = await providerIntelligence.discoverAndInstall(capabilityId);
      }

      if (!selectedProvider) {
         throw new Error(`Execution Failed: No registered or discoverable capability found for ${capabilityId}`);
      }
      
      selectedProviderManifest = selectedProvider; // For error tracking

      // 4. Transport Selection (Strategy)
      let parsedTransports = selectedProvider.transports;
      if (typeof parsedTransports === 'string') {
        try { parsedTransports = JSON.parse(parsedTransports); } catch(e) { parsedTransports = [parsedTransports]; }
      }
      
      for (const t of parsedTransports) {
         const strat = strategyRegistry.get(t);
         if (strat) {
           strategy = strat;
           strategyName = t;
           break;
         }
      }

      if (!strategy) {
        throw new Error(`Execution Failed: No supported transport strategy found for ${selectedProvider.providerId}`);
      }

      // 5. Instantiation
      // Since it's dynamic, the provider instance is just the catalog record itself
      const providerInstance = selectedProvider;

      // 6. Invocation (with Timeout/Retry from profile)
      const retryPolicy = profile?.retry || { attempts: 1 };
      let attempt = 0;
      let rawResult = null;
      let lastError = null;

      while (attempt < retryPolicy.attempts) {
        try {
          attempt++;
          rawResult = await strategy.execute(providerInstance, capabilityId, parameters, {
            ...context,
            timeoutMs: profile?.timeout_ms || 30000
          });
          lastError = null;
          break; // Success
        } catch (err) {
          lastError = err;
          capabilityMonitor.recordRetry(capabilityId, selectedProviderManifest.id);
          if (attempt >= retryPolicy.attempts) break;
          // Apply backoff if needed...
          await new Promise(r => setTimeout(r, 1000)); 
        }
      }

      if (lastError) {
        throw lastError;
      }

      // 7. Evidence Normalization
      const evidence = strategy.collectEvidence(rawResult);

      // 8. Telemetry Success & Execution Memory
      const duration = Date.now() - startTime;
      capabilityMonitor.recordSuccess(capabilityId, selectedProviderManifest.id || selectedProviderManifest.providerId, duration);
      executionMemory.recordExecution(capabilityId, selectedProviderManifest.providerId, strategyName, duration, 1, 1.0);

      // 9. Verification Handoff
      if (profile?.verification_policy?.required) {
        const verificationContext = { capabilityId, profile, parameters };
        const vResult = await verificationEngine.verifyEvidence(evidence, [ { condition: 'success' } ], verificationContext);
        if (!vResult.verified) {
          capabilityMonitor.recordVerificationFailure(capabilityId, selectedProviderManifest.id, vResult.reasons.join(', '));
          // 10. Compensation on Verification Failure
          await strategy.compensate(providerInstance, rawResult, profile.compensation);
          throw new Error(`Verification failed: ${vResult.reasons.join(', ')}`);
        }
      }

      return {
        status: 'completed',
        evidence,
        providerId: selectedProviderManifest.id
      };

    } catch (error) {
      if (selectedProviderManifest) {
        capabilityMonitor.recordFailure(capabilityId, selectedProviderManifest.id, error);
      }
      log.error(`[CapabilityRuntime] Error executing ${capabilityId}: ${error.message}`);
      throw error;
    }
  }

  _instantiateProvider(manifest) {
    // In a full implementation, this uses a ProviderFactory to require() the code
    // For local core providers, we dynamically require based on ID.
    const idMap = {
      'local-search': '../providers/local-search.cjs',
      'sqlite-knowledge': '../providers/sqlite-knowledge.cjs',
      'os-calendar': '../providers/os-calendar.cjs'
    };

    if (idMap[manifest.id]) {
      const mod = require(idMap[manifest.id]);
      const ClassName = Object.keys(mod)[0];
      return new mod[ClassName]();
    }
    
    throw new Error(`Could not dynamically instantiate provider ${manifest.id}`);
  }
}

const capabilityRuntime = new CapabilityRuntime();
module.exports = { CapabilityRuntime, capabilityRuntime };
