'use strict';

/**
 * Base Connector Interface
 * All providers (Zomato, Swiggy, MakeMyTrip) must extend this class.
 */
class BaseConnector {
  constructor(id, version) {
    this.id = id;
    this.version = version;
  }

  // ─── Health & Capabilities ───────────────────────────────────────────────

  /**
   * Return connector health
   * @returns {Promise<string>} 'healthy' | 'degraded' | 'offline'
   */
  async health() {
    return 'healthy';
  }

  /**
   * Return capability-level maturity
   * @returns {Object} e.g. { DISCOVER: 'L3', CHECKOUT: 'L0' }
   */
  maturity() {
    return {};
  }

  /**
   * Return supported capabilities
   * @returns {string[]} e.g., ['DISCOVER', 'FETCH_MENU', 'CHECKOUT']
   */
  capabilities() {
    return [];
  }

  /**
   * Return expected SLA in milliseconds
   * @returns {number}
   */
  sla() {
    return 500;
  }

  // ─── Execution Methods ───────────────────────────────────────────────────

  /**
   * Discover entities matching the context
   * MUST return raw JSON objects. The Registry/Normalizer will normalize them.
   */
  async discover(context) {
    throw new Error('Not implemented');
  }

  async fetch(entityId) {
    throw new Error('Not implemented');
  }

  async authenticate(credentials) {
    throw new Error('Not implemented');
  }

  async checkout(cart) {
    throw new Error('Not implemented');
  }

  async track(orderId) {
    throw new Error('Not implemented');
  }
}

module.exports = { BaseConnector };
