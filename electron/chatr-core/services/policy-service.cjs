/**
 * Policy Service (v1)
 *
 * Exclusively responsible for evaluating facts against defined policies.
 * Emits canonical policy.evaluated events containing PolicyEvaluation objects.
 * Does NOT perform I/O, network calls, or direct provider interactions.
 */

const { bus } = require('../events/bus.cjs');
const persistence = require('../db/persistence.cjs');
const crypto = require('crypto');

class PolicyService {
    constructor() {
        this.policies = new Map();
        
        // bus.subscribe('policy.evaluate.requested', this._onEvaluateRequested.bind(this));
    }

    /**
     * Registers a pure policy evaluation function.
     */
    registerPolicy(id, version, evaluateFn) {
        if (typeof evaluateFn !== 'function') {
            throw new Error(`POLICY_VIOLATION: Policy ${id}@${version} must provide an evaluate function`);
        }
        this.policies.set(`${id}@${version}`, evaluateFn);
    }

    /**
     * Internal handler to evaluate policies for an intent.
     * @param {Object} request { intentId, policyIds, facts }
     */
    async _evaluatePolicies(request) {
        const evaluations = [];
        
        for (const policyReq of request.policyIds) {
            const policyKey = `${policyReq.id}@${policyReq.version}`;
            const evaluateFn = this.policies.get(policyKey);
            
            if (!evaluateFn) {
                // If policy is not found, produce a failed evaluation
                evaluations.push({
                    id: `eval-${crypto.randomUUID()}`,
                    intentId: request.intentId,
                    policyId: policyReq.id,
                    policyVersion: policyReq.version,
                    matched: false,
                    constraintsSatisfied: false,
                    authorizationState: 'prohibited',
                    confidence: 1.0,
                    timestamp: Date.now(),
                    reasons: [{
                        rule: 'policy.exists',
                        operator: '==',
                        expected: true,
                        actual: false,
                        satisfied: false
                    }]
                });
                continue;
            }
            
            try {
                // evaluateFn must be pure
                const result = evaluateFn(request.facts);
                
                const evaluation = {
                    id: `eval-${crypto.randomUUID()}`,
                    intentId: request.intentId,
                    policyId: policyReq.id,
                    policyVersion: policyReq.version,
                    matched: result.matched || false,
                    constraintsSatisfied: result.constraintsSatisfied || false,
                    authorizationState: result.authorizationState || 'insufficient_information',
                    confidence: result.confidence || 1.0,
                    timestamp: Date.now(),
                    reasons: result.reasons || []
                };
                
                // Persist immutable evaluation
                persistence.insertRecord('policy_evaluations', {
                    id: evaluation.id,
                    intent_id: evaluation.intentId,
                    policy_id: evaluation.policyId,
                    policy_version: evaluation.policyVersion,
                    matched: evaluation.matched ? 1 : 0,
                    constraints_satisfied: evaluation.constraintsSatisfied ? 1 : 0,
                    authorization_state: evaluation.authorizationState,
                    confidence: evaluation.confidence,
                    reasons: JSON.stringify(evaluation.reasons)
                });
                
                evaluations.push(evaluation);
            } catch (error) {
                // Capture failure as a prohibited evaluation
                evaluations.push({
                    id: `eval-${crypto.randomUUID()}`,
                    intentId: request.intentId,
                    policyId: policyReq.id,
                    policyVersion: policyReq.version,
                    matched: true,
                    constraintsSatisfied: false,
                    authorizationState: 'prohibited',
                    confidence: 1.0,
                    timestamp: Date.now(),
                    reasons: [{
                        rule: 'evaluation.execution',
                        operator: 'success',
                        expected: true,
                        actual: false,
                        satisfied: false,
                        error: error.message
                    }]
                });
            }
        }
        
        bus.publish('policy.evaluated', {
            intent_id: request.intentId,
            evaluations: evaluations
        });
        
        return evaluations;
    }
}

module.exports = new PolicyService();
