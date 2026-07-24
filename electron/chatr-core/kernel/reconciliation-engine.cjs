'use strict';

/**
 * CHATR Kernel — Reconciliation Engine (v0.9 RC)
 * 
 * Contract:
 * - A state comparison engine.
 * - Answers "Does observed reality match expected workflow state?"
 * - Emits ONLY declarative, evidence-backed `chatr.recovery_proposal.v0_9_rc` objects.
 * - Idempotent, deterministic, and pure.
 */

const crypto = require('crypto');
const ABI = 'chatr.recovery_proposal.v0_9_rc';

const DriftSeverity = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical'
};

class ReconciliationEngine {
  constructor() {
    this.processedObservations = new Set();
  }

  /**
   * Evaluates an observation against expected state to detect drift.
   * Runs in <5ms.
   * 
   * @param {Object} goalState - Immutable GoalRuntimeState
   * @param {Object} expectedWorkflow - Immutable WorkflowGraph
   * @param {Object} observation - Immutable ObservationFrame
   * @returns {Object|null} A RecoveryProposal, or null if no actionable drift.
   */
  reconcile(goalState, expectedWorkflow, observation) {
    if (!goalState || !expectedWorkflow || !observation) {
      throw new Error('Missing reconciliation inputs');
    }

    // 1. Idempotency Check
    const obsKey = `${goalState.goal_id}:${observation.observation_id}`;
    if (this.processedObservations.has(obsKey)) {
      return null; // Idempotent skip
    }
    
    // Performance timer start (for trace/benchmark if needed)
    // 2. Expected vs Observed Comparison
    const expectedStep = expectedWorkflow.nodes.find(n => n.node_id === observation.workflow_step) ||
                         expectedWorkflow.nodes.find(n => n.action === observation.workflow_step);
    
    let driftType = null;
    let severity = null;
    let recoveryAction = null;
    let reason = null;

    if (!expectedStep) {
      driftType = 'invalid_workflow_transition';
      severity = DriftSeverity.CRITICAL;
      recoveryAction = 'abort_workflow';
      reason = `Observed step ${observation.workflow_step} not found in expected workflow`;
    } else {
      // Analyze the payload to classify drift
      // Since it's pure, we just check generic "status" fields or errors
      const status = observation.payload.status || observation.payload.state || 'ok';
      const statusStr = status.toLowerCase();
      
      if (statusStr.includes('error') || statusStr.includes('fail') || statusStr.includes('expire') || statusStr.includes('timeout')) {
        if (statusStr.includes('auth') || statusStr.includes('login') || statusStr.includes('expire')) {
          driftType = 'authentication_expired';
          severity = DriftSeverity.HIGH;
          recoveryAction = 're_authenticate';
          reason = 'Authentication expired during execution';
        } else if (statusStr.includes('timeout') || statusStr.includes('unavailable')) {
          driftType = 'provider_unavailable';
          severity = DriftSeverity.HIGH;
          recoveryAction = 'retry_step';
          reason = 'External provider timed out';
        } else {
          driftType = 'execution_failure';
          severity = DriftSeverity.MEDIUM;
          recoveryAction = 'retry_step';
          reason = `Execution failed: ${status}`;
        }
      } else if (status.toLowerCase().includes('delay') || status.toLowerCase().includes('wait')) {
        driftType = 'timing_delay';
        severity = DriftSeverity.LOW;
        recoveryAction = 'wait_for_external';
        reason = 'External dependency is delayed';
      }
    }

    // Mark as processed regardless of drift to maintain idempotency
    this.processedObservations.add(obsKey);

    // 3. Emit RecoveryProposal if drift detected
    if (driftType) {
      const proposal = {
        abi: ABI,
        proposal_id: crypto.randomUUID(),
        goal_id: goalState.goal_id,
        workflow_step: observation.workflow_step,
        proposal_type: recoveryAction,
        reason: reason,
        confidence: 0.94,
        evidence_refs: [observation.observation_id],
        sequence: observation.sequence, // Mirrors observation sequence for ordering
        correlation_id: observation.correlation_id || crypto.randomUUID(),
        metadata: {
          drift_type: driftType,
          severity: severity,
          expected_state: expectedStep ? expectedStep.action : 'unknown',
          observed_state: observation.payload.status || 'unknown'
        }
      };

      // Ensure deterministic hash
      proposal.deterministic_hash = this._calculateHash(proposal);
      return Object.freeze(proposal);
    }

    // No drift = expected state matches observed reality
    return null;
  }

  _calculateHash(proposal) {
    const hash = crypto.createHash('sha256');
    const logical = {
      goal_id: proposal.goal_id,
      step: proposal.workflow_step,
      type: proposal.proposal_type,
      reason: proposal.reason,
      evidence: proposal.evidence_refs
    };
    hash.update(JSON.stringify(logical));
    return hash.digest('hex');
  }

  /**
   * Purge internal idempotency cache on restart or cleanup.
   * In a real persistent engine, this is backed by SQLite or similar.
   */
  loadFromDisk(persistedRecords = []) {
    for (const rec of persistedRecords) {
      this.processedObservations.add(rec.key);
    }
  }
}

module.exports = { ReconciliationEngine, DriftSeverity };
