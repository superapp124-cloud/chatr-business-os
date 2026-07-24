/**
 * Stewardship Service (v1)
 *
 * Exclusively responsible for evaluating Intent Object lifecycle progression based on time 
 * and external events, emitting lifecycle.transition.proposed.
 * Does NOT own state, perform actions, or run polling loops.
 */

const { bus } = require('../events/bus.cjs');
const persistence = require('../db/persistence.cjs');
const crypto = require('crypto');

class StewardshipService {
    constructor() {
        // The service is purely event-driven, responding to these triggers
        // In a real system, these would be subscribed on the bus
        // bus.subscribe('world.changed', this._handleEvent.bind(this));
        // bus.subscribe('policy.evaluated', this._handleEvent.bind(this));
        // bus.subscribe('verification.confirmed', this._handleEvent.bind(this));
        // bus.subscribe('execution.completed', this._handleEvent.bind(this));
        // bus.subscribe('lifecycle.timer.fired', this._handleEvent.bind(this));
    }

    /**
     * Evaluates the lifecycle for an intent based on an event trigger.
     * @param {Object} intent The current Intent Object state (provided by Kernel)
     * @param {string} triggerType E.g. 'Observation', 'Verification', 'Timeout'
     * @param {Object} eventPayload The canonical event payload
     */
    async evaluateLifecycle(intent, triggerType, eventPayload) {
        let proposedPhase = intent.phase;
        let proposedCondition = intent.condition;
        let transitionReason = null;

        const now = Date.now();

        // Very basic FSM logic as a placeholder for full evaluation
        if (intent.phase === 'Draft' && triggerType === 'User') {
            proposedPhase = 'Active';
            proposedCondition = 'WaitingPolicy';
            transitionReason = 'User activated draft intent';
        } else if (intent.phase === 'Active') {
            if (intent.condition === 'Sleeping' && intent.sleep_until && now >= new Date(intent.sleep_until).getTime()) {
                proposedCondition = 'Healthy';
                transitionReason = 'Sleep duration expired naturally';
            } else if (triggerType === 'Observation' && intent.condition === 'Sleeping') {
                proposedCondition = 'WaitingPolicy';
                transitionReason = 'Observation interrupted sleep state';
            } else if (triggerType === 'Policy') {
                if (eventPayload && eventPayload.authorizationState === 'permitted') {
                    proposedPhase = 'Executing';
                    proposedCondition = 'Healthy';
                    transitionReason = 'Policy evaluation permitted execution';
                }
            } else if (triggerType === 'Timeout') {
                proposedCondition = 'Expired';
                transitionReason = 'SLA timeout reached without progress';
            }
        } else if (intent.phase === 'Executing' && triggerType === 'Execution') {
            proposedPhase = 'Stewarded';
            proposedCondition = 'WaitingVerification';
            transitionReason = 'Execution step completed, requires verification';
        } else if (intent.phase === 'Stewarded' && triggerType === 'Verification') {
            proposedCondition = 'Healthy';
            transitionReason = 'Verification confirmed reality';
        }

        // If a transition is warranted, emit proposal
        if (proposedPhase !== intent.phase || proposedCondition !== intent.condition) {
            bus.publish('lifecycle.transition.proposed', {
                intent_id: intent.id,
                before_phase: intent.phase,
                before_condition: intent.condition,
                after_phase: proposedPhase,
                after_condition: proposedCondition,
                trigger_type: triggerType,
                transition_reason: transitionReason,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Helper to write a Checkpoint (usually invoked by Kernel AFTER committing a transition)
     */
    async logCheckpoint(checkpointData) {
        const chk = {
            id: `chk-${crypto.randomUUID()}`,
            intent_id: checkpointData.intent_id,
            before_phase: checkpointData.before_phase,
            before_condition: checkpointData.before_condition,
            trigger_type: checkpointData.trigger_type,
            after_phase: checkpointData.after_phase,
            after_condition: checkpointData.after_condition,
            transition_reason: checkpointData.transition_reason,
            decision_id: checkpointData.decision_id || null,
            kernel_version: checkpointData.kernel_version || '1.0',
            timestamp: new Date().toISOString()
        };

        persistence.insertRecord('lifecycle_checkpoints', chk);
        return chk;
    }
}

module.exports = new StewardshipService();
