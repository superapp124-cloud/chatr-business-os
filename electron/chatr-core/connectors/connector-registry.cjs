'use strict';

const { Normalizer } = require('./normalizer.cjs');

/**
 * Connector Registry
 * Holds static registrations of all providers.
 */
class ConnectorRegistry {
  constructor() {
    this.connectors = new Map();
  }

  register(connector) {
    this.connectors.set(connector.id, connector);
  }

  get(connectorId) {
    return this.connectors.get(connectorId);
  }

  getAll() {
    return Array.from(this.connectors.values());
  }

  async executeDiscovery(context) {
    const promises = this.getAll().map(async (connector) => {
      const pStart = Date.now();
      let health = 'unknown';

      try {
        health = await connector.health();
        if (health === 'offline') {
          throw new Error(`Connector ${connector.id} is offline`);
        }

        const rawResults = await connector.discover(context);
        const latencyMs = Date.now() - pStart;

        return rawResults.map(raw => 
          Normalizer.normalizeDiscoveryResult(
            connector.id, 
            connector.version, 
            health, 
            latencyMs, 
            raw
          )
        );
      } catch (err) {
        // Partial Failure Handling
        console.warn(`[ConnectorRegistry] Connector ${connector.id} failed during discovery:`, err.message);
        return []; // Return empty array to not break Promise.all
      }
    });

    const resultsArray = await Promise.all(promises);
    return resultsArray.flat();
  }
}

module.exports = { ConnectorRegistry };
