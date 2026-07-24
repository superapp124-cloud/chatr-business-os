// Authority Manager
// Implements AUTHORITY_SPEC_v1.md

const AUTHORITY_MATRIX = {
    'Policy': {
        'Modify': ['User'],
        'Read': ['User', 'Kernel', 'LearningRuntime', 'ObservationRuntime', 'StewardshipRuntime', 'MissionControl']
    },
    'Execution': {
        'Trigger': ['Kernel', 'User']
    },
    'Intent': {
        'Create': ['User', 'LearningRuntime'], // Learning can propose/create drafts
        'Modify': ['User', 'Kernel'],          // Kernel transitions state
        'Archive': ['User', 'Kernel']
    }
};

class AuthorityManager {
    /**
     * Verifies if a principal is authorized to perform an action on a resource.
     * @param {string} resource (e.g. 'Policy', 'Intent')
     * @param {string} action (e.g. 'Modify', 'Trigger')
     * @param {string} principal (e.g. 'User', 'Kernel', 'LearningRuntime')
     * @throws {Error} AUTHORITY_VIOLATION if not authorized
     */
    static verifyAction(resource, action, principal) {
        if (!AUTHORITY_MATRIX[resource] || !AUTHORITY_MATRIX[resource][action]) {
            throw new Error(`AUTHORITY_VIOLATION: Unknown resource or action (${resource}.${action})`);
        }

        const allowedPrincipals = AUTHORITY_MATRIX[resource][action];
        if (!allowedPrincipals.includes(principal)) {
            throw new Error(`AUTHORITY_VIOLATION: ${principal} cannot perform ${action} on ${resource}`);
        }
    }
}

module.exports = AuthorityManager;
