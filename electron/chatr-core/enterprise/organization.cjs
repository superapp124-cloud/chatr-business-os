/**
 * Organization Service
 * Manages the Enterprise Hierarchy and Workspaces.
 * Enterprise -> Region -> Business Unit -> Department -> Project -> Workspace
 */

class OrganizationService {
    constructor() {
        // Mock in-memory database of workspaces for the architecture proof
        this.workspaces = new Map();
    }

    createWorkspace(name, hierarchy) {
        this._validateHierarchy(hierarchy);
        
        const workspaceId = `ws_${Date.now()}`;
        const workspace = {
            id: workspaceId,
            name,
            hierarchy
        };
        
        this.workspaces.set(workspaceId, workspace);
        return workspace;
    }

    getWorkspace(workspaceId) {
        return this.workspaces.get(workspaceId);
    }

    _validateHierarchy(hierarchy) {
        const levels = ['enterprise', 'region', 'businessUnit', 'department', 'project'];
        for (const level of levels) {
            if (!hierarchy[level]) {
                throw new Error(`Invalid hierarchy: missing ${level}`);
            }
        }
    }
}

module.exports = new OrganizationService();
