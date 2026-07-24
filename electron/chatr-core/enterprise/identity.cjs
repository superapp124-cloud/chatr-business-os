/**
 * Identity Service
 * Manages Principals (Humans, AI Agents, Service Accounts, MCP Servers, Devices, External Systems)
 */

class IdentityService {
    constructor() {
        this.principals = new Map();
    }

    createPrincipal(type, identityRef) {
        const validTypes = ['Human', 'AIAgent', 'ServiceAccount', 'MCPServer', 'Device', 'ExternalSystem'];
        if (!validTypes.includes(type)) {
            throw new Error(`Invalid Principal type: ${type}`);
        }

        const id = `prin_${Date.now()}`;
        const principal = {
            id,
            type,
            identityRef
        };
        
        this.principals.set(id, principal);
        return principal;
    }

    getPrincipal(id) {
        return this.principals.get(id);
    }
}

module.exports = new IdentityService();
