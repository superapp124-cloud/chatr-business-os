'use strict';

/**
 * CHATR Kernel — Capability Monitor
 * 
 * Continuously records execution success, latency, retries, policy failures,
 * provider health, and verification failures.
 * Feeds real operational history back into the Decision Service.
 */

const { ledger } = require('../ledger/event-ledger.cjs');

class CapabilityMonitor {
  constructor() {
    this._metrics = new Map(); // providerId -> metrics
  }

  _getMetrics(providerId) {
    if (!this._metrics.has(providerId)) {
      this._metrics.set(providerId, {
        invocations: 0,
        successes: 0,
        failures: 0,
        retries: 0,
        policyFailures: 0,
        verificationFailures: 0,
        totalLatencyMs: 0,
        averageLatencyMs: 0,
        lastInvoked: null,
        healthStatus: 'healthy' // 'healthy', 'degraded', 'down'
      });
    }
    return this._metrics.get(providerId);
  }

  /**
   * Records a successful execution.
   */
  recordSuccess(capabilityId, providerId, latencyMs) {
    const m = this._getMetrics(providerId);
    m.invocations++;
    m.successes++;
    m.totalLatencyMs += latencyMs;
    m.averageLatencyMs = m.totalLatencyMs / m.invocations;
    m.lastInvoked = new Date().toISOString();
    m.healthStatus = 'healthy';

    ledger.append('MONITOR.SUCCESS', { capabilityId, providerId, latencyMs });
  }

  /**
   * Records an execution failure.
   */
  recordFailure(capabilityId, providerId, error) {
    const m = this._getMetrics(providerId);
    m.invocations++;
    m.failures++;
    m.lastInvoked = new Date().toISOString();

    const failureRate = m.failures / m.invocations;
    if (failureRate > 0.5 && m.invocations > 5) {
      m.healthStatus = 'down';
    } else if (failureRate > 0.2 && m.invocations > 5) {
      m.healthStatus = 'degraded';
    }

    ledger.append('MONITOR.FAILURE', { capabilityId, providerId, error: error.message });
  }

  recordRetry(capabilityId, providerId) {
    const m = this._getMetrics(providerId);
    m.retries++;
    ledger.append('MONITOR.RETRY', { capabilityId, providerId });
  }

  recordPolicyFailure(capabilityId, providerId, policyName) {
    const m = this._getMetrics(providerId);
    m.policyFailures++;
    ledger.append('MONITOR.POLICY_FAILURE', { capabilityId, providerId, policyName });
  }

  recordVerificationFailure(capabilityId, providerId, reason) {
    const m = this._getMetrics(providerId);
    m.verificationFailures++;
    ledger.append('MONITOR.VERIFICATION_FAILURE', { capabilityId, providerId, reason });
  }

  /**
   * Get historical performance of a provider to aid Decision Service.
   */
  getProviderStats(providerId) {
    return this._getMetrics(providerId);
  }
}

const capabilityMonitor = new CapabilityMonitor();
module.exports = { CapabilityMonitor, capabilityMonitor };
