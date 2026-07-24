'use strict';

/**
 * Discovery Engine
 * Parallel orchestrator across all registered provider connectors.
 * Orchestrates Promise.all across the ConnectorRegistry.
 */
class DiscoveryEngine {
  constructor(bus, executionCache, registry) {
    this.bus = bus;
    this.cache = executionCache;
    this.registry = registry;
  }

  async discover(intentText, context) {
    const startTime = Date.now();
    this.bus.publish('kernel.discovery.started', { intentText });

    // 1. Check Cache
    // Extract a simple capability keyword for caching heuristics
    const capabilityKey = (intentText && intentText.toLowerCase().includes('hotel')) ? 'hotel' : 'food';
    const cachedResult = this.cache.get('DISCOVER', `${capabilityKey}_${context}`);
    
    if (cachedResult) {
      this.bus.publish('kernel.discovery.completed', { 
        source: 'cache', 
        latencyMs: Date.now() - startTime,
        results: cachedResult 
      });
      return cachedResult;
    }

    // 2. Parallel Provider Queries via Registry
    const allOptions = await this.registry.executeDiscovery(intentText);

    // Store in cache
    // Store in cache (Capability TTL logic handled by updated ExecutionCache)
    this.cache.set('DISCOVER', `${capabilityKey}_${context}`, allOptions);

    this.bus.publish('kernel.discovery.completed', {
      source: 'network',
      latencyMs: Date.now() - startTime,
      results: allOptions
    });

    return allOptions;
  }
}

module.exports = { DiscoveryEngine };
