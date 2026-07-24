'use strict';

const { capabilityRegistry } = require('./capability-registry.cjs');
const crypto = require('crypto');

/**
 * CHATR Kernel — Planning Engine
 * 
 * Takes a raw intent, parses constraints, and generates an Abstract Execution Graph.
 * The Abstract Execution Graph contains nodes representing generic capabilities
 * (e.g. 'Transport.BookRide') rather than specific providers.
 */

class PlanningEngine {
  constructor() {
    // This phase uses a deterministic rule-based mapping for pipeline validation.
    // In future phases, this will be replaced by an LLM-driven graph generator.
  }

  /**
   * Generates an Abstract Execution Graph for an Intent.
   * @param {object} intent - The intent object from IntentStore
   * @returns {object} Abstract Execution Graph
   */
  plan(intent) {
    if (!intent || !intent.raw_text) {
      return this._buildEmptyGraph(intent?.id);
    }

    const lower = intent.raw_text.toLowerCase();
    
    // Deterministic Rule 1: Transport Booking
    if (/book|ride|cab|taxi|airport/i.test(lower)) {
      return this._buildTransportGraph(intent);
    }

    // Fallback: Empty or Unknown Graph
    return this._buildEmptyGraph(intent.id);
  }

  _buildTransportGraph(intent) {
    const graph = {
      intentId: intent.id,
      nodes: [],
      metadata: { generatedBy: 'PlanningEngine.RuleBased' }
    };

    // Node 1: Get Estimate
    graph.nodes.push({
      id: `node_${crypto.randomUUID()}`,
      capability: 'Transport.GetEstimate',
      status: 'pending',
      requiresApproval: false,
      inputs: {
        from: intent.constraints.from || null,
        to: intent.constraints.to || null,
        type: intent.constraints.type || 'budget'
      }
    });

    // Node 2: Book Ride (Depends on Node 1 logically, executed sequentially for now)
    graph.nodes.push({
      id: `node_${crypto.randomUUID()}`,
      capability: 'Transport.BookRide',
      status: 'pending',
      requiresApproval: true, // OS policy constraint: booking always requires user confirmation
      inputs: {
        from: intent.constraints.from || null,
        to: intent.constraints.to || null,
        type: intent.constraints.type || 'budget'
      }
    });

    return graph;
  }

  _buildEmptyGraph(intentId) {
    return {
      intentId: intentId || 'unknown',
      nodes: [],
      metadata: { error: 'No applicable planning rules found' }
    };
  }
}

const planner = new PlanningEngine();
module.exports = { planner, PlanningEngine, Planner: PlanningEngine };
