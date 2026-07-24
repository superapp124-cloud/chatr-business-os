// Intent Lifecycle State Machine
// Implements LIFECYCLE_SPEC_v1.md

const LEGAL_TRANSITIONS = {
    'DISCOVERED': {
        'CLARIFYING': ['Kernel'],
        'PLANNING': ['Kernel'],
        'CANCELLED': ['User', 'Kernel']
    },
    'CLARIFYING': {
        'PLANNING': ['Kernel', 'User'],
        'CANCELLED': ['User', 'Kernel']
    },
    'PLANNING': {
        'DECIDING': ['Kernel'],
        'FAILED': ['Kernel'],
        'CANCELLED': ['User', 'Kernel']
    },
    'DECIDING': {
        'EXECUTING': ['Kernel'],
        'AWAITING_APPROVAL': ['Kernel'],
        'DEFERRED': ['Kernel'],
        'FAILED': ['Kernel'],
        'CANCELLED': ['User', 'Kernel']
    },
    'AWAITING_APPROVAL': {
        'EXECUTING': ['User'],
        'DECIDING': ['Kernel'],
        'CANCELLED': ['User', 'Kernel']
    },
    'EXECUTING': {
        'VERIFYING': ['Kernel'],
        'FAILED': ['Kernel'],
        'CANCELLED': ['User', 'Kernel']
    },
    'VERIFYING': {
        'COMPLETED': ['Kernel'],
        'FAILED': ['Kernel'],
        'EXECUTING': ['Kernel'],
        'CANCELLED': ['User', 'Kernel']
    },
    'DEFERRED': {
        'DECIDING': ['Kernel', 'User'],
        'CANCELLED': ['User', 'Kernel']
    },
    'COMPLETED': {}, // Terminal
    'FAILED': {}, // Terminal
    'CANCELLED': {} // Terminal
};

class IntentLifecycle {
    /**
     * Attempts to transition an intent to a new lifecycle phase.
     * @param {Object} intent - The intent object.
     * @param {string} toPhase - The target lifecycle phase.
     * @param {string} principal - The principal attempting the transition ('User', 'Kernel', etc).
     * @throws {Error} LIFECYCLE_VIOLATION or AUTHORITY_VIOLATION if illegal.
     */
    static transition(intent, toPhase, principal) {
        if (!intent) {
            throw new Error('LIFECYCLE_VIOLATION: Invalid intent object');
        }

        const currentPhase = intent.status || (intent.lifecycle && intent.lifecycle.phase);
        
        if (!currentPhase) {
            throw new Error('LIFECYCLE_VIOLATION: Intent has no status');
        }

        // Check if transition exists from current phase
        const allowedTargets = LEGAL_TRANSITIONS[currentPhase];
        if (!allowedTargets || !allowedTargets[toPhase]) {
            throw new Error(`LIFECYCLE_VIOLATION: Illegal transition from ${currentPhase} to ${toPhase}`);
        }

        // Check authority
        const allowedPrincipals = allowedTargets[toPhase];
        if (!allowedPrincipals.includes(principal)) {
            throw new Error(`AUTHORITY_VIOLATION: ${principal} is not authorized to transition from ${currentPhase} to ${toPhase}`);
        }

        // Transition successful
        intent.status = toPhase;
        if (intent.lifecycle) {
            intent.lifecycle.phase = toPhase; // Legacy sync
        }
    }
}

module.exports = IntentLifecycle;
