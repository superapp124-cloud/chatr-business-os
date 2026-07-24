'use strict';

const { providerRegistry } = require('./provider-registry.cjs');
const { worldModel } = require('../world-model/world-model.cjs');

/**
 * CHATR Kernel — Dynamic Resolver (Goal Engine)
 * 
 * Takes an Abstract Execution Graph (from the Planner) and binds each 
 * abstract capability node to a specific Provider plugin.
 * 
 * Resolution Logic:
 * 1. Find all providers fulfilling the capability.
 * 2. Filter out unhealthy or untrusted providers.
 * 3. Consult World Model for explicit user preferences (e.g. "Preferred Provider").
 * 4. Optimize based on implied cost/latency constraints.
 */

class CapabilityResolver {
  constructor() {}

  /**
   * Resolves an Abstract Execution Graph into a Concrete Execution Graph.
   * @param {object} abstractGraph 
   * @returns {object} Concrete Execution Graph ready for ExecutionEngine
   */
  resolve(abstractGraph) {
    if (!abstractGraph || !abstractGraph.nodes) {
      throw new Error('Invalid abstract graph provided to resolver.');
    }

    const concreteGraph = {
      intentId: abstractGraph.intentId,
      nodes: [],
      metadata: { ...abstractGraph.metadata, resolvedAt: new Date().toISOString() }
    };

    for (const node of abstractGraph.nodes) {
      const concreteNode = { ...node };
      
      // 1. Find Candidates
      const candidates = providerRegistry.findProvidersFor(node.capability);
      
      if (candidates.length === 0) {
        concreteNode.status = 'failed';
        concreteNode.error = `No providers found for capability: ${node.capability}`;
        concreteGraph.nodes.push(concreteNode);
        continue;
      }

      // 2. Determine best provider based on World Model preferences & defaults
      const bestProvider = this._selectBestProvider(candidates, abstractGraph.intentId);
      
      // 3. Bind the Provider
      concreteNode.providerId = bestProvider.id;
      concreteNode.providerName = bestProvider.name;
      
      concreteGraph.nodes.push(concreteNode);
    }

    return concreteGraph;
  }

  _selectBestProvider(candidates, intentId) {
    // If only one candidate, return it
    if (candidates.length === 1) return candidates[0];

    // TODO: Phase 3 simplified resolution logic.
    // In production, query worldModel.getPreferences(intentType) to check if 
    // user explicitly prefers 'Uber' over 'Ola' or 'Cost' over 'Speed'.
    
    // For now, simple fallback optimization: sort by Trust, then Cost.
    // (Higher trust is better. If trust is equal, lower cost is better.)
    const sorted = [...candidates].sort((a, b) => {
      const trustDiff = (b.trustScore || 0) - (a.trustScore || 0);
      if (trustDiff !== 0) return trustDiff;
      
      return (a.baseCost || 0) - (b.baseCost || 0);
    });

    return sorted[0];
  }
}

const resolver = new CapabilityResolver();
module.exports = { resolver, CapabilityResolver };
