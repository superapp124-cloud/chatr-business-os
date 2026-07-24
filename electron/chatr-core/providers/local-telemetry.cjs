'use strict';

/**
 * CHATR Kernel - Local Telemetry Provider
 * Listens to the Event Bus and writes AI metrics to the database.
 * Phase 1 of the Learning Engine (Read-only).
 */

const { bus } = require('../events/bus.cjs');

class LocalTelemetryProvider {
  constructor() {
    this.name = 'LocalTelemetryProvider';
    this.metrics = [];
    this.initialize();
  }

  initialize() {
    bus.subscribe('TELEMETRY_RECORDED', (telemetry) => {
      this.recordTelemetry(telemetry);
    });
    
    bus.subscribe('EXECUTION_FAILED', (failure) => {
      this.recordFailure(failure);
    });
  }

  recordTelemetry(data) {
    // E.g., { executionPlan, durationMs, success, tokensIn, tokensOut }
    const metric = {
      timestamp: new Date().toISOString(),
      model: data.executionPlan?.model || 'unknown',
      durationMs: data.durationMs,
      tokensIn: data.tokensIn || 0,
      tokensOut: data.tokensOut || 0,
      status: 'success'
    };
    
    this.metrics.push(metric);
    console.log(`[Telemetry] Recorded success for ${metric.model}: ${metric.durationMs}ms`);
    
    // In production, insert into SQLite telemetry journal
  }

  recordFailure(data) {
    const metric = {
      timestamp: new Date().toISOString(),
      model: data.executionPlan?.model || 'unknown',
      durationMs: data.durationMs || 0,
      error: data.error,
      status: 'failure'
    };
    this.metrics.push(metric);
    console.warn(`[Telemetry] Recorded failure for ${metric.model}: ${metric.error}`);
  }
}

module.exports = { LocalTelemetryProvider };
