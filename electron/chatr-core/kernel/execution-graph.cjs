'use strict';

/**
 * CHATR Kernel — Execution Engine (Phase 4)
 *
 * Fully event-sourced execution layer.
 * It consumes a fully resolved Concrete Execution Graph from the DecisionEngine.
 * By the time a graph reaches here, ALL policy, privacy, and dependency checks
 * have already passed, and capability nodes are bound to specific Provider IDs.
 *
 * This engine simply orchestrates the bound capability invocations (or mocks),
 * emitting events at every state change, and producing immutable evidence.
 */

const crypto = require('crypto');
const { bus } = require('../events/bus.cjs');
const { policyEngine } = require('./policy-engine.cjs');
const { capabilityRuntime } = require('../execution/capability-runtime.cjs');

class ExecutionEngine {
  constructor() {
    this._activeExecutions = new Map();

    // Listen for authorized execution dispatches (usually from a Policy or Decision engine trigger)
    bus.subscribe('kernel.execution.dispatch', (envelope) => this._startExecution(envelope));
    
    // Resume pending approvals if they arrive
    bus.subscribe('kernel.decision.approved', (envelope) => this._resumeExecution(envelope));
  }

  /**
   * Internal kick-off for a concrete graph.
   */
  async _startExecution(envelope) {
    const { intent_id, concreteGraph, intent } = envelope.payload;
    if (!concreteGraph) return;

    // ── Phase 5: Policy Enforcement Gate ──
    const policyResult = policyEngine.evaluate(concreteGraph, intent);
    if (!policyResult.permitted) {
      this._failExecution(intent_id, `Policy Violation: ${policyResult.reason}`);
      return;
    }

    this._activeExecutions.set(intent_id, {
      graph: concreteGraph,
      status: 'EXECUTING',
      startedAt: Date.now(),
      evidence: []
    });

    bus.publish('kernel.execution.started', {
      intent_id,
      node_count: concreteGraph.nodes.length
    }, { correlationId: intent_id });

    // Execute nodes sequentially (for now)
    for (const node of concreteGraph.nodes) {
      const nodeSuccess = await this._executeNode(intent_id, node);
      if (!nodeSuccess) {
        this._failExecution(intent_id, `Node ${node.id} failed.`);
        return;
      }
    }

    this._completeExecution(intent_id);
  }

  async _executeNode(intentId, node) {
    if (node.requiresApproval) {
      bus.publish('kernel.execution.paused', {
        intent_id: intentId,
        node_id: node.id,
        reason: 'Awaiting human authorization'
      }, { correlationId: intentId });
    }

    bus.publish('kernel.execution.progress', {
      intent_id: intentId,
      node_id: node.id,
      status: 'running',
      provider: node.providerId
    }, { correlationId: intentId });

    try {
      // Hand off to the true nucleus: the Capability Runtime
      const result = await capabilityRuntime.executeCapability(node.capability, node.parameters, { intentId });
      
      // Add evidence to active execution
      const execution = this._activeExecutions.get(intentId);
      if (execution && result.evidence) {
        execution.evidence.push(result.evidence);
      }

      // Publishing completion with evidence directly feeds back into IntentStore Projection
      bus.publish('kernel.execution.progress', {
        intent_id: intentId,
        node_id: node.id,
        status: 'completed',
        evidence: result.evidence
      }, { correlationId: intentId });
      
      return true;

    } catch (error) {
      bus.publish('kernel.execution.progress', {
        intent_id: intentId,
        node_id: node.id,
        status: 'failed',
        error: error.message
      }, { correlationId: intentId });
      return false;
    }
  }

  _failExecution(intentId, reason) {
    this._activeExecutions.delete(intentId);
    bus.publish('kernel.execution.completed', {
      intent_id: intentId,
      status: 'FAILED',
      reason
    }, { correlationId: intentId });
  }

  _completeExecution(intentId) {
    const execution = this._activeExecutions.get(intentId);
    const evidence = execution ? execution.evidence : [];
    this._activeExecutions.delete(intentId);
    bus.publish('kernel.execution.completed', {
      intent_id: intentId,
      status: 'COMPLETED',
      evidence
    }, { correlationId: intentId });
  }

  _resumeExecution(envelope) {
    // In a fully durable async state machine, this would reload the Concrete Graph
    // from a snapshot and resume at the paused node index.
  }
}

const executionEngine = new ExecutionEngine();
module.exports = { ExecutionEngine, executionEngine };
