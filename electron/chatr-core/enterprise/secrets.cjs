/**
 * Secrets & Connection Service
 * Manages Connection lifecycle and shields raw secrets from the Execution Plane.
 * The Execution Plane receives secure handles, not the secrets themselves.
 */

class SecretsService {
    constructor() {
        this.connections = new Map();
        this.vault = new Map(); // The secure store holding actual credentials
    }

    /**
     * Request a new connection. Places it in the 'Requested' lifecycle state.
     */
    requestConnection(principal, providerId, config) {
        const connId = `conn_${Date.now()}`;
        const connection = {
            id: connId,
            type: "Connection",
            version: "1.0",
            owner: principal,
            providerId,
            lifecycleState: "Requested",
            classification: config.classification || "Internal",
            trustLevel: "Untrusted",
            timestamp: new Date().toISOString()
        };

        this.connections.set(connId, connection);
        console.log(`[SecretsService] Connection ${connId} requested by Principal ${principal.id}. Lifecycle: Requested.`);
        
        return connection;
    }

    /**
     * Governance action to approve the connection.
     */
    approveConnection(connId, governanceDecision) {
        const connection = this.connections.get(connId);
        if (!connection) throw new Error("Connection not found");
        
        if (governanceDecision.decision === 'APPROVED') {
            connection.lifecycleState = "Approved";
            connection.trustLevel = "Verified";
            console.log(`[SecretsService] Connection ${connId} Approved.`);
        }
    }

    /**
     * Configures the connection with raw secrets. Secrets are vaulted.
     */
    configureConnection(connId, secrets) {
        const connection = this.connections.get(connId);
        if (!connection || connection.lifecycleState !== "Approved") {
            throw new Error("Connection must be Approved before configuration.");
        }

        // Store raw secrets in the vault, not on the connection resource
        this.vault.set(connId, secrets);
        
        connection.lifecycleState = "Active";
        console.log(`[SecretsService] Connection ${connId} Configured and Active.`);
    }

    /**
     * Execution Plane requests to use the connection.
     * Returns a Secure Handle, NEVER the raw secret.
     */
    getSecureHandle(connId) {
        const connection = this.connections.get(connId);
        if (!connection || connection.lifecycleState !== "Active") {
            throw new Error("Connection is not Active.");
        }

        // Generate a temporary execution handle
        const handle = `handle_${connId}_${Date.now()}`;
        console.log(`[SecretsService] Secure handle ${handle} issued for Connection ${connId}. (Raw secrets shielded).`);
        
        return {
            handle,
            providerId: connection.providerId,
            classification: connection.classification
        };
    }
}

module.exports = new SecretsService();
