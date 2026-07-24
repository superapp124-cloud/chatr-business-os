'use strict';

/**
 * CHATR Kernel — Lifecycle Inspector
 *
 * Makes every request's lifecycle visible in real-time.
 * Tracks per-stage timing for latency analysis and production diagnostics.
 * Every span is available from the /metrics endpoint.
 *
 * Genesis v1.0 — Milestone 2
 */

const MAX_COMPLETED_SPANS = 200; // Keep last N spans in memory

class LifecycleInspector {
  constructor() {
    this._activeSpans    = new Map();   // requestId → span
    this._completedSpans = [];          // Circular buffer
    this._stats = {
      total:        0,
      succeeded:    0,
      failed:       0,
      totalLatency: 0,
    };
  }

  /**
   * Start a new span for a request.
   * @param {string} requestId
   * @returns {object} span handle
   */
  startSpan(requestId) {
    const started = Date.now();
    const marks   = {};
    const span    = {
      requestId,
      started,
      marks,
      status: 'active',
      error:  null,
    };

    this._activeSpans.set(requestId, span);
    this._stats.total++;

    const self = this;

    return {
      mark(stage) {
        marks[stage] = Date.now();
      },

      finish({ latencyMs, provider, tokens } = {}) {
        span.status    = 'completed';
        span.latencyMs = latencyMs ?? Date.now() - started;
        span.provider  = provider;
        span.tokens    = tokens;
        span.finishedAt = Date.now();

        self._activeSpans.delete(requestId);
        self._completedSpans.push({ ...span });
        if (self._completedSpans.length > MAX_COMPLETED_SPANS) {
          self._completedSpans.shift();
        }

        self._stats.succeeded++;
        self._stats.totalLatency += span.latencyMs;
      },

      fail(errorMessage) {
        span.status     = 'failed';
        span.error      = errorMessage;
        span.latencyMs  = Date.now() - started;
        span.finishedAt = Date.now();

        self._activeSpans.delete(requestId);
        self._completedSpans.push({ ...span });
        if (self._completedSpans.length > MAX_COMPLETED_SPANS) {
          self._completedSpans.shift();
        }

        self._stats.failed++;
      },
    };
  }

  /**
   * Get inspector stats (used by /metrics endpoint).
   */
  getStats() {
    return {
      total:          this._stats.total,
      succeeded:      this._stats.succeeded,
      failed:         this._stats.failed,
      activeNow:      this._activeSpans.size,
      avgLatencyMs:   this._stats.succeeded > 0
        ? Math.round(this._stats.totalLatency / this._stats.succeeded)
        : 0,
      recentSpans:    this._completedSpans.slice(-20).map(s => ({
        requestId: s.requestId,
        status:    s.status,
        latencyMs: s.latencyMs,
        provider:  s.provider,
        marks:     s.marks,
        error:     s.error ?? null,
      })),
    };
  }

  /**
   * Get all currently active spans (live requests).
   */
  getActive() {
    return [...this._activeSpans.values()].map(s => ({
      requestId: s.requestId,
      started:   s.started,
      ageMs:     Date.now() - s.started,
      marks:     s.marks,
    }));
  }
}

const inspector = new LifecycleInspector();

module.exports = { inspector };
