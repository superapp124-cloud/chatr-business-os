/**
 * Execution Platform Interfaces
 * 
 * Formalizes the 8-Layer Execution Architecture.
 */

/**
 * ExecutionStrategy
 * Decides HOW to execute an intent (Local AI, MCP, Provider, Human).
 */
class ExecutionStrategy {
    /**
     * @param {Object} intent The Intent Object
     * @param {Object} registry Capability Registry reference
     * @returns {string} The chosen execution path (e.g., 'provider', 'human', 'local')
     */
    async planExecution(intent, registry) {
        throw new Error("Not implemented");
    }

    /**
     * Executes the intent via the chosen path, producing an ExecutionOutcome.
     */
    async execute(intent) {
        throw new Error("Not implemented");
    }
}

/**
 * ProviderStrategy
 * Decides WHICH compatible provider and connection to use.
 */
class ProviderStrategy {
    /**
     * @param {Object} intent The Intent Object
     * @param {Array} candidateProviders List of providers matching capability requirements
     * @returns {Object} The selected provider and its configuration
     */
    async selectProvider(intent, candidateProviders) {
        throw new Error("Not implemented");
    }
}

/**
 * ConnectionResolver
 * Isolates enterprise identity, binding a provider to a specific tenant/connection.
 */
class ConnectionResolver {
    /**
     * @param {string} providerId
     * @param {Object} context Execution context (tenant, user)
     * @returns {Object} Connection details (secrets, quotas, region)
     */
    async resolveConnection(providerId, context) {
        throw new Error("Not implemented");
    }
}

/**
 * ProviderAdapter
 * Normalizes the provider into a canonical contract.
 */
class ProviderAdapter {
    async discover(connection) { throw new Error("Not implemented"); }
    async plan(connection, intent) { throw new Error("Not implemented"); }
    async execute(connection, intent) { throw new Error("Not implemented"); }
    async cancel(connection, intent) { throw new Error("Not implemented"); }
    async status(connection, intent) { throw new Error("Not implemented"); }
    async verify(connection, intent) { throw new Error("Not implemented"); }
}

module.exports = {
    ExecutionStrategy,
    ProviderStrategy,
    ConnectionResolver,
    ProviderAdapter
};
