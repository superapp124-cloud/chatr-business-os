'use strict';

/**
 * CHATR Kernel — Verification Engine (Phase 5)
 *
 * The Verification Engine closes the Execution loop.
 * It listens to Evidence emitted by the Execution Engine, validates the cryptographic
 * hash of the payload, and performs logical matching against the Intent's
 * defined success_criteria.
 *
 * If verified, it emits `kernel.intent.verified` (which transitions IntentStore to COMPLETED).
 */

const crypto = require('crypto');
const { bus } = require('../events/bus.cjs');
const { intentStore } = require('./intent-store.cjs');

class VerificationEngine {
  constructor() {
    // Listen for execution progress that includes evidence
    bus.subscribe('kernel.execution.progress', (envelope) => this._onExecutionProgress(envelope));
  }

  _onExecutionProgress(envelope) {
    const { intent_id, status, evidence } = envelope.payload;

    if (status === 'completed' && Array.isArray(evidence) && evidence.length > 0) {
      this._verifyEvidence(intent_id, evidence);
    }
  }

  _verifyEvidence(intentId, evidenceList) {
    const intent = intentStore.get(intentId);
    if (!intent) {
      console.warn(`[VerificationEngine] Intent ${intentId} not found for verification.`);
      return;
    }

    // 1. Cryptographic Validation
    for (const ev of evidenceList) {
      const calculatedHash = crypto.createHash('sha256').update(JSON.stringify(ev.payload)).digest('hex');
      if (calculatedHash !== ev.payload_hash) {
        this._publishResult(intentId, 'FAILED', 'Cryptographic evidence hash mismatch. Possible tampering.', evidenceList);
        return;
      }
    }

    // 2. Logical Validation (Success Criteria)
    // For Phase 5 mock, we check if the evidence payload mockData includes our success criteria strings
    let matchedCriteria = 0;
    const criteriaCount = intent.success_criteria ? intent.success_criteria.length : 0;

    if (criteriaCount > 0) {
      const combinedPayloadStr = JSON.stringify(evidenceList.map(e => e.payload)).toLowerCase();

      for (const criteria of intent.success_criteria) {
        if (combinedPayloadStr.includes(criteria.toLowerCase())) {
          matchedCriteria++;
        }
      }

      if (matchedCriteria < criteriaCount) {
        this._publishResult(intentId, 'FAILED', `Only met ${matchedCriteria}/${criteriaCount} success criteria.`, evidenceList);
        return;
      }
    }

    // Verified!
    this._publishResult(intentId, 'VERIFIED', 'Cryptographic and logical criteria met.', evidenceList);
  }

  _publishResult(intentId, result, reason, evidenceList) {
    bus.publish('kernel.verification.completed', {
      intent_id: intentId,
      result, // 'VERIFIED' or 'FAILED'
      reason,
      evidence: evidenceList
    }, { correlationId: intentId });

    if (result === 'VERIFIED') {
      bus.publish('kernel.intent.completed', {
        intent_id: intentId,
        status: 'COMPLETED',
        evidence: evidenceList
      }, { correlationId: intentId });
    } else {
      bus.publish('kernel.intent.failed', {
        intent_id: intentId,
        status: 'FAILED',
        error: reason,
        evidence: evidenceList
      }, { correlationId: intentId });
    }
  }
}

const verificationEngine = new VerificationEngine();
module.exports = { VerificationEngine, verificationEngine };
