'use strict';

/**
 * CHATR Kernel — Workflow Generator (Milestone D)
 * 
 * Contract:
 * Input:  ProviderSelection & GoalPlan
 * Output: WorkflowGraph
 * 
 * Constraints:
 * - Pure compiler. No execution, scheduling, or waiting.
 * - Deterministic: Same input -> Same Hash
 * - Immutable graph output.
 * - Provider-agnostic. Uses ExecutionMode. Connector identity is opaque to this layer.
 */

const crypto = require('crypto');

const ABI = 'chatr.workflow_graph.v0_9_rc';

const STANDARD_NODES = {
  START: 'START',
  AUTHENTICATE: 'AUTHENTICATE',
  DISCOVER: 'DISCOVER',
  FETCH: 'FETCH',
  USER_SELECTION: 'USER_SELECTION',
  CHECKOUT: 'CHECKOUT',
  PAY: 'PAY',
  VERIFY: 'VERIFY',
  END: 'END'
};

class WorkflowGenerator {
  
  /**
   * Compiles a deterministic WorkflowGraph from a GoalPlan and ProviderSelection.
   * 
   * @param {Object} goalPlan - The plan associated with the goal.
   * @param {Object} providerSelection - The selected provider and its capabilities/execution modes.
   * @returns {Object} A frozen WorkflowGraph ABI object.
   */
  compile(goalPlan, providerSelection) {
    if (!goalPlan || !goalPlan.goal_id) {
      throw new Error('GoalPlan missing or invalid');
    }
    if (!providerSelection || !providerSelection.capabilities || !providerSelection.execution_mode) {
      throw new Error('ProviderSelection missing or invalid');
    }

    const goalId = goalPlan.goal_id;
    const graphId = crypto.randomUUID();

    // The topology is derived from the requested capabilities and the execution mode.
    // We abstract provider details and only use requested capabilities (e.g., DISCOVER, PAY)
    const requestedCapabilities = goalPlan.capabilities || [];
    
    // Default abstract sequence
    const sequence = [STANDARD_NODES.START];

    // If authentication is required by execution mode or implicitly, add it.
    if (providerSelection.requires_authentication) {
      sequence.push(STANDARD_NODES.AUTHENTICATE);
    }

    if (requestedCapabilities.includes('DISCOVER')) {
      sequence.push(STANDARD_NODES.DISCOVER);
    }
    
    if (requestedCapabilities.includes('FETCH')) {
      sequence.push(STANDARD_NODES.FETCH);
    }

    // Interactive step for the user if selection is required
    if (goalPlan.requires_user_selection) {
      sequence.push(STANDARD_NODES.USER_SELECTION);
    }

    if (requestedCapabilities.includes('PAY') || requestedCapabilities.includes('BOOK')) {
      sequence.push(STANDARD_NODES.CHECKOUT);
      sequence.push(STANDARD_NODES.PAY);
    }

    sequence.push(STANDARD_NODES.VERIFY);
    sequence.push(STANDARD_NODES.END);

    // Build formal nodes and edges
    const nodes = sequence.map((action, index) => ({
      node_id: `node_${index}_${action.toLowerCase()}`,
      type: 'declarative_action',
      action: action
    }));

    const edges = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        from: nodes[i].node_id,
        to: nodes[i + 1].node_id,
        condition: 'success'
      });
    }

    const metadata = {
      execution_mode: providerSelection.execution_mode,
      compiler_version: '1.0'
    };

    const graph = {
      abi: ABI,
      graph_id: graphId,
      goal_id: goalId,
      workflow_version: '1.0',
      nodes,
      edges,
      metadata,
    };

    // Calculate deterministic hash
    graph.deterministic_hash = this._calculateHash(graph);

    // Freeze immutability
    this._deepFreeze(graph);

    return graph;
  }

  _calculateHash(graph) {
    const hash = crypto.createHash('sha256');
    // To be deterministic, we hash only the logical structure, not the random graph_id.
    const logicalStructure = {
      goal_id: graph.goal_id,
      nodes: graph.nodes.map(n => n.action),
      edges: graph.edges.map(e => `${e.from}->${e.to}(${e.condition})`),
      metadata: graph.metadata
    };
    hash.update(JSON.stringify(logicalStructure));
    return hash.digest('hex');
  }

  _deepFreeze(object) {
    const propNames = Object.getOwnPropertyNames(object);
    for (const name of propNames) {
      const value = object[name];
      if (value && typeof value === 'object') {
        this._deepFreeze(value);
      }
    }
    return Object.freeze(object);
  }
}

module.exports = {
  WorkflowGenerator,
  STANDARD_NODES
};
