'use strict';

/**
 * CHATR Kernel — Capability Registry
 * 
 * Defines the generic OS capability taxonomy.
 * The kernel ONLY knows these capabilities. It knows nothing about
 * Uber, Google, Stripe, etc.
 * 
 * Capabilities are the contracts that Providers must fulfill.
 */

class CapabilityRegistry {
  constructor() {
    this._capabilities = new Map();
    this._initializeBaseTaxonomy();
  }

  _initializeBaseTaxonomy() {
    // ── TRANSPORT ──
    this.register({
      id: 'Transport.GetEstimate',
      domain: 'Transport',
      action: 'GetEstimate',
      description: 'Fetch time and cost estimates for a ride.',
      inputSchema: ['from', 'to', 'type'],
      outputSchema: ['estimatedCost', 'estimatedTime', 'currency']
    });

    this.register({
      id: 'Transport.BookRide',
      domain: 'Transport',
      action: 'BookRide',
      description: 'Book a ride between two locations.',
      inputSchema: ['from', 'to', 'type'],
      outputSchema: ['rideId', 'status', 'driverDetails']
    });

    // ── IDENTITY ──
    this.register({
      id: 'Identity.Login',
      domain: 'Identity',
      action: 'Login',
      description: 'Authenticate a user with a third-party service.',
      inputSchema: ['serviceId'],
      outputSchema: ['token', 'userId', 'expiresAt']
    });

    // ── COMMERCE ──
    this.register({
      id: 'Payment.Authorize',
      domain: 'Payment',
      action: 'Authorize',
      description: 'Authorize a payment for a specific amount.',
      inputSchema: ['amount', 'currency', 'paymentMethodId'],
      outputSchema: ['transactionId', 'status']
    });
  }

  /**
   * Register a new capability contract.
   */
  register(capability) {
    if (!capability.id) throw new Error('Capability must have an id');
    this._capabilities.set(capability.id, capability);
  }

  /**
   * Get a capability contract.
   */
  getContract(capabilityId) {
    return this._capabilities.get(capabilityId) || null;
  }

  /**
   * List all registered capabilities.
   */
  list() {
    return Array.from(this._capabilities.values());
  }
}

const capabilityRegistry = new CapabilityRegistry();
module.exports = { CapabilityRegistry, capabilityRegistry };
