/**
 * Observation Runtime (v1)
 *
 * Exclusively responsible for passively receiving events from the world,
 * persisting the raw data, normalizing it, and publishing world.changed events.
 */

const { bus } = require('../events/bus.cjs');
const persistence = require('../db/persistence.cjs');
const crypto = require('crypto');

const REQUIRED_ADAPTER_METHODS = ['initialize', 'start', 'stop', 'health', 'normalize', 'capabilities'];

class ObservationRuntime {
    constructor() {
        this.adapters = new Map();
    }

    /**
     * Registers an external adapter to feed observations to the kernel.
     * @param {string} id 
     * @param {Object} adapter 
     */
    registerAdapter(id, adapter) {
        for (const method of REQUIRED_ADAPTER_METHODS) {
            if (typeof adapter[method] !== 'function') {
                throw new Error(`ADAPTER_VIOLATION: Adapter is missing required methods. Expected: ${REQUIRED_ADAPTER_METHODS.join(', ')}`);
            }
        }
        this.adapters.set(id, adapter);
    }

    start() {
        for (const adapter of this.adapters.values()) {
            adapter.initialize();
            adapter.start();
        }
    }

    stop() {
        for (const adapter of this.adapters.values()) {
            adapter.stop();
        }
    }

    /**
     * Internal method called by adapters when raw data arrives.
     * Must not be called by other runtimes.
     * @param {string} adapterId 
     * @param {any} rawPayload 
     */
    _handleRawObservation(adapterId, rawPayload) {
        const adapter = this.adapters.get(adapterId);
        if (!adapter) throw new Error(`Unknown adapter: ${adapterId}`);

        const correlationId = crypto.randomUUID();

        // 1. Normalize
        const normalized = adapter.normalize(rawPayload);

        // 2. Persist Raw Observation (Immutable)
        persistence.append('observation_log', {
            adapter: adapterId,
            raw_payload: rawPayload,
            normalized_payload: normalized,
            correlation_id: correlationId,
            timestamp: Date.now()
        });

        // 3. Publish canonical event
        bus.publish('world.changed', {
            source: adapterId,
            subject: normalized.subject,
            payload: normalized.payload
        }, {
            source: 'ObservationRuntime',
            correlationId
        });
    }

    getHealth() {
        const health = {
            adapters_running: this.adapters.size,
            adapter_status: {}
        };
        for (const [id, adapter] of this.adapters.entries()) {
            health.adapter_status[id] = adapter.health();
        }
        return health;
    }
}

module.exports = new ObservationRuntime();
