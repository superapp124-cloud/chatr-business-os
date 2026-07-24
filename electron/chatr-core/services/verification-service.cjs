/**
 * Verification Runtime (v2)
 *
 * Exclusively responsible for executing pure-function verification strategies 
 * to confirm reality based on VerificationObligations.
 * Emits ONLY verification.* events.
 */

const { bus } = require('../events/bus.cjs');
const persistence = require('../db/persistence.cjs');
const crypto = require('crypto');

class VerificationRuntime {
    constructor() {
        this.strategies = new Map();
        
        // In a real implementation, we'd subscribe to bus here:
        // bus.subscribe('verification.requested', this._onVerificationRequested.bind(this));
    }

    /**
     * Registers a Versioned Verification Strategy Plugin
     */
    registerStrategy(id, version, evaluateFn) {
        if (typeof evaluateFn !== 'function') {
            throw new Error(`VERIFICATION_VIOLATION: Strategy ${id}@${version} must be a pure function`);
        }
        this.strategies.set(`${id}@${version}`, evaluateFn);
    }

    /**
     * Creates a VerificationObligation (e.g. from execution.completed)
     */
    async _createObligation(spec) {
        const obl = {
            id: `obl-${crypto.randomUUID()}`,
            intent_id: spec.intentId,
            execution_id: spec.executionId,
            strategy: spec.strategy,
            strategy_version: spec.strategyVersion,
            required_evidence: JSON.stringify(spec.requiredEvidence || []),
            timeout: spec.timeout || 'PT24H',
            retry_policy: JSON.stringify(spec.retryPolicy || {}),
            status: 'pending',
            created_at: new Date().toISOString()
        };

        persistence.insertRecord('verification_obligations', obl);
        bus.publish('verification.obligation.created', { obligation_id: obl.id });
        return obl;
    }

    /**
     * Accepts canonical evidence and runs evaluation
     */
    async _acceptEvidence(obligationId, evidenceSpec) {
        // Find obligation (in a real system, from persistence)
        // We'll assume the caller passes a valid obligationId
        const evidence = {
            id: `ev-${crypto.randomUUID()}`,
            obligation_id: obligationId,
            source: evidenceSpec.source,
            type: evidenceSpec.type,
            confidence: evidenceSpec.confidence || 1.0,
            correlation_id: evidenceSpec.correlationId,
            payload: JSON.stringify(evidenceSpec.payload),
            checksum: evidenceSpec.checksum,
            timestamp: new Date().toISOString()
        };

        // 1. Append Evidence Immutable
        persistence.insertRecord('verification_evidence', evidence);
        bus.publish('verification.evidence.accepted', { obligation_id: obligationId, evidence_id: evidence.id });

        // 2. Load obligation and all evidence
        const dbObligation = persistence.db.prepare('SELECT * FROM verification_obligations WHERE id = ?').get(obligationId);
        if (!dbObligation) return;

        const dbEvidence = persistence.db.prepare('SELECT * FROM verification_evidence WHERE obligation_id = ?').all(obligationId);
        
        const strategyKey = `${dbObligation.strategy}@${dbObligation.strategy_version}`;
        const evaluateFn = this.strategies.get(strategyKey);
        
        if (!evaluateFn) {
            bus.publish('verification.failed', { obligation_id: obligationId, reason: `Strategy not found: ${strategyKey}` });
            return;
        }

        // 3. Evaluate Pure Function
        try {
            const result = evaluateFn(dbObligation, dbEvidence);
            
            if (result.status === 'confirmed') {
                persistence.db.prepare('UPDATE verification_obligations SET status = ? WHERE id = ?').run('confirmed', obligationId);
                bus.publish('verification.confirmed', {
                    obligation_id: obligationId,
                    intent_id: dbObligation.intent_id,
                    confidence: result.confidence
                });
            } else if (result.status === 'failed') {
                persistence.db.prepare('UPDATE verification_obligations SET status = ? WHERE id = ?').run('failed', obligationId);
                bus.publish('verification.failed', {
                    obligation_id: obligationId,
                    intent_id: dbObligation.intent_id,
                    reason: result.reason || 'Verification logic returned failure'
                });
            }
            // If insufficient_evidence, we remain pending
        } catch (error) {
            bus.publish('verification.failed', {
                obligation_id: obligationId,
                intent_id: dbObligation.intent_id,
                reason: error.message
            });
        }
    }
}

module.exports = new VerificationRuntime();
