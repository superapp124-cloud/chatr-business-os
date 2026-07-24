/**
 * Provider Telemetry Service
 * 
 * Manages Operational Telemetry (ProviderHealth, ConnectionHealth, Circuit Breakers)
 * Distinct from immutable Decision Artifacts. This is dynamic state.
 */

class TelemetryService {
    constructor() {
        // connectionId -> health metrics
        this.connections = new Map();
    }

    /**
     * Initializes or gets the health state for a connection
     */
    _getHealth(connectionId, providerId) {
        if (!this.connections.has(connectionId)) {
            this.connections.set(connectionId, {
                providerId,
                connectionId,
                status: 'Healthy', // Healthy, Degraded, Open, Half-open, Recovering
                latencyMs: 0,
                errorRate: 0,
                successCount: 0,
                errorCount: 0,
                consecutiveFailures: 0,
                quotaRemaining: 100, // mock quota
                lastUpdated: Date.now()
            });
        }
        return this.connections.get(connectionId);
    }

    recordSuccess(connectionId, providerId, latencyMs) {
        const health = this._getHealth(connectionId, providerId);
        health.successCount++;
        health.consecutiveFailures = 0;
        
        // EWMA (Exponential Weighted Moving Average) for latency
        if (health.latencyMs === 0) health.latencyMs = latencyMs;
        else health.latencyMs = (health.latencyMs * 0.8) + (latencyMs * 0.2);

        if (health.status === 'Half-open' || health.status === 'Open') {
            health.status = 'Recovering';
        } else if (health.status === 'Recovering' && health.successCount > 5) {
            health.status = 'Healthy';
        }

        health.lastUpdated = Date.now();
    }

    recordFailure(connectionId, providerId, isRetryable) {
        const health = this._getHealth(connectionId, providerId);
        health.errorCount++;
        health.consecutiveFailures++;

        if (health.consecutiveFailures >= 3) {
            health.status = 'Open'; // Circuit Breaker Open
        } else if (health.consecutiveFailures > 0) {
            health.status = 'Degraded';
        }

        health.lastUpdated = Date.now();
    }

    getHealth(connectionId) {
        return this.connections.get(connectionId) || null;
    }

    isCircuitOpen(connectionId) {
        const health = this.connections.get(connectionId);
        if (!health) return false;
        
        // Very basic Circuit Breaker simulation
        if (health.status === 'Open') {
            // Half-open after 10 seconds
            if (Date.now() - health.lastUpdated > 10000) {
                health.status = 'Half-open';
                return false;
            }
            return true;
        }
        return false;
    }
}

module.exports = new TelemetryService();
