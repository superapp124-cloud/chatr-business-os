/**
 * Authorization Service
 * Centralized policy decision point. Answers "Can this identity perform this action on this resource?"
 * Abstracting away RBAC/ABAC logic.
 */

class AuthorizationService {
    /**
     * Evaluates if a Principal can perform an action on a Resource.
     * @param {Object} principal The Principal attempting the action
     * @param {string} action The action (e.g., 'create', 'read', 'execute', 'approve')
     * @param {Object} resource The target EnterpriseResource
     * @returns {boolean}
     */
    static can(principal, action, resource) {
        console.log(`[Authorization] Checking if Principal ${principal.id} (${principal.type}) can '${action}' Resource ${resource.id} (${resource.type})`);
        
        // Mock authorization logic:
        // In a real system, this would query RBAC/ABAC policies attached to the Organization Workspace.
        
        // Simple mock rule: AI Agents can read/execute, but cannot 'approve' (Human only).
        if (principal.type === 'AIAgent' && action === 'approve') {
            return false; 
        }

        return true;
    }
}

module.exports = AuthorizationService;
