'use strict';

/**
 * CHATR Kernel — Execution Memory Interface
 * Platform Milestone C
 *
 * Defines the stable interface the Trust Service consumes.
 * The backing implementation (execution-memory.cjs, telemetry store, etc.)
 * may be enriched in later milestones without changing this contract.
 *
 * TSC decision (2026-07-15): build Trust Service against an interface,
 * not today's storage implementation. Learning and long-term optimization
 * come later.
 */

const { persistence } = require('../db/persistence.cjs');

const COLLECTION = 'kernel_provider_statistics_v0_9_rc';
const ABI        = 'chatr.execution_memory.provider_statistics.v0_9_rc';

/**
 * Provider statistics shape returned by getProviderStatistics().
 * All fields are required; missing fields default to safe neutral values.
 *
 * @typedef {Object} ProviderStatistics
 * @property {string}  provider_id
 * @property {number}  success_rate        - [0, 1] fraction of successful executions
 * @property {number}  failure_rate        - [0, 1] fraction of failed executions
 * @property {number}  average_latency_ms  - mean observed latency in milliseconds
 * @property {string|null} last_success    - ISO timestamp of last successful execution
 * @property {number}  observations        - total count of recorded executions
 */

const NEUTRAL_STATISTICS = Object.freeze({
  success_rate:       0.5,
  failure_rate:       0.5,
  average_latency_ms: 2000,
  last_success:       null,
  observations:       0,
});

/**
 * ExecutionMemoryProvider — minimal interface for Milestone C.
 * Reads from persisted telemetry. Returns neutral statistics for unknown providers.
 */
class ExecutionMemoryProvider {
  constructor(options = {}) {
    this._persistence = options.persistence || persistence;
  }

  /**
   * Return provider statistics for trust computation.
   * Always returns a valid statistics object — never throws.
   *
   * @param {string} providerId
   * @returns {ProviderStatistics}
   */
  getProviderStatistics(providerId) {
    if (!providerId || typeof providerId !== 'string') {
      return { provider_id: 'unknown', ...NEUTRAL_STATISTICS };
    }

    try {
      const store = this._persistence.retrieve(COLLECTION) || {};
      const record = store[providerId];
      if (!record) {
        return { provider_id: providerId, ...NEUTRAL_STATISTICS };
      }

      return {
        provider_id:        providerId,
        success_rate:       clamp(record.success_rate       ?? NEUTRAL_STATISTICS.success_rate,       0, 1),
        failure_rate:       clamp(record.failure_rate       ?? NEUTRAL_STATISTICS.failure_rate,       0, 1),
        average_latency_ms: Math.max(0, record.average_latency_ms ?? NEUTRAL_STATISTICS.average_latency_ms),
        last_success:       record.last_success || null,
        observations:       Math.max(0, Math.floor(record.observations ?? 0)),
      };
    } catch {
      return { provider_id: providerId, ...NEUTRAL_STATISTICS };
    }
  }

  /**
   * Record an execution outcome. Telemetry only — no ABI contract.
   * Called by the Execution Runtime after each provider interaction.
   *
   * @param {string}  providerId
   * @param {boolean} success
   * @param {number}  latency_ms
   */
  recordOutcome(providerId, success, latency_ms) {
    if (!providerId) return;

    try {
      const store   = this._persistence.retrieve(COLLECTION) || {};
      const current = store[providerId] || { ...NEUTRAL_STATISTICS, observations: 0 };

      const n = current.observations + 1;
      const newSuccessRate = lerp(current.success_rate, success ? 1 : 0, 1 / n);
      const newLatency     = lerp(current.average_latency_ms, latency_ms, 1 / n);

      store[providerId] = {
        success_rate:       clamp(newSuccessRate, 0, 1),
        failure_rate:       clamp(1 - newSuccessRate, 0, 1),
        average_latency_ms: Math.max(0, newLatency),
        last_success:       success ? new Date().toISOString() : current.last_success,
        observations:       n,
      };

      this._persistence.store(COLLECTION, store);
    } catch {
      // Telemetry failures must never crash the kernel.
    }
  }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, Number(v) || 0)); }
function lerp(a, b, t)      { return a + (b - a) * t; }

let defaultInstance = null;

function getExecutionMemoryProvider() {
  if (!defaultInstance) {
    defaultInstance = new ExecutionMemoryProvider();
  }
  return defaultInstance;
}

module.exports = {
  ABI,
  ExecutionMemoryProvider,
  NEUTRAL_STATISTICS,
  getExecutionMemoryProvider,
};
