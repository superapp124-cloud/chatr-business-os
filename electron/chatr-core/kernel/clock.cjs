'use strict';

/**
 * CHATR Kernel — Kernel Clock
 *
 * Attaches high-resolution timestamps to every lifecycle stage of a request.
 * Becomes the foundation for Latency Analytics, Learning, and Diagnostics.
 *
 * Genesis v1.0
 */

class KernelClock {
  /**
   * Start a new clock for a request.
   * @param {string} requestId
   * @returns {object} clock handle
   */
  start(requestId) {
    const started = Date.now();
    const marks = { started };

    return {
      requestId,
      mark(stage) {
        marks[stage] = Date.now();
      },
      elapsed(fromStage, toStage) {
        const from = marks[fromStage] ?? started;
        const to   = marks[toStage]   ?? Date.now();
        return to - from;
      },
      total() {
        return Date.now() - started;
      },
      snapshot() {
        return { requestId, started, marks, totalMs: Date.now() - started };
      },
    };
  }
}

const clock = new KernelClock();

module.exports = { clock };
