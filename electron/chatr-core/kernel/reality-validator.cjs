'use strict';

/**
 * CHATR Kernel — Reality Validator
 * Platform Milestone P1.5
 *
 * Records every real execution as a structured ValidationReport.
 * The foundation for replay, regression testing, and production debugging.
 *
 * For every goal execution it captures:
 *   - Planned action (what the kernel intended to do)
 *   - Actual provider response (what really happened)
 *   - Verification evidence (confirmation from provider)
 *   - Final outcome (success / failure / recovery)
 *   - Per-stage latency
 *
 * IMPORTANT: This is observability infrastructure, NOT a new kernel subsystem.
 * It wraps existing components — it does not own execution state.
 */

class RealityValidator {
  constructor(options = {}) {
    this._bus = options.bus;
    this._reports = new Map(); // goalId -> ValidationReport
  }

  /**
   * Begin recording a new execution.
   */
  startReport(goalId, intentText) {
    const report = {
      goal_id: goalId,
      intent_text: intentText,
      started_at: new Date().toISOString(),
      completed_at: null,
      outcome: 'IN_PROGRESS',
      stages: [],
      provider_responses: [],
      verification_evidence: null,
      recovery_events: [],
      total_latency_ms: null,
    };
    this._reports.set(goalId, report);
    return report;
  }

  /**
   * Record a stage completion (planned vs actual timing).
   */
  recordStage(goalId, stageName, planned_sla_ms, actual_latency_ms, metadata = {}) {
    const report = this._reports.get(goalId);
    if (!report) return;

    report.stages.push({
      stage: stageName,
      planned_sla_ms,
      actual_latency_ms,
      within_sla: actual_latency_ms <= planned_sla_ms,
      recorded_at: new Date().toISOString(),
      ...metadata,
    });
  }

  /**
   * Record a raw provider response (the "reality" part of Reality Validation).
   */
  recordProviderResponse(goalId, provider, responseStatus, latencyMs, evidence = {}) {
    const report = this._reports.get(goalId);
    if (!report) return;

    report.provider_responses.push({
      provider,
      status: responseStatus, // 'success' | 'partial' | 'timeout' | 'error'
      latency_ms: latencyMs,
      evidence,
      recorded_at: new Date().toISOString(),
    });
  }

  /**
   * Record a recovery event (provider failed, system recovered).
   */
  recordRecovery(goalId, failedProvider, recoveredVia, recoveryLatencyMs) {
    const report = this._reports.get(goalId);
    if (!report) return;

    report.recovery_events.push({
      failed_provider: failedProvider,
      recovered_via: recoveredVia,
      recovery_latency_ms: recoveryLatencyMs,
      recorded_at: new Date().toISOString(),
    });
  }

  /**
   * Record verification evidence (what the provider confirmed).
   */
  recordVerification(goalId, orderId, verified, evidence = {}) {
    const report = this._reports.get(goalId);
    if (!report) return;

    report.verification_evidence = {
      order_id: orderId,
      verified,
      evidence,
      verified_at: new Date().toISOString(),
    };
  }

  /**
   * Close the report with a final outcome.
   */
  completeReport(goalId, outcome, startTime) {
    const report = this._reports.get(goalId);
    if (!report) return null;

    report.completed_at = new Date().toISOString();
    report.outcome = outcome; // 'SUCCESS' | 'FAILED' | 'RECOVERED' | 'CANCELLED'
    report.total_latency_ms = Date.now() - startTime;

    // Compute SLA summary
    report.sla_summary = {
      total_stages: report.stages.length,
      stages_within_sla: report.stages.filter(s => s.within_sla).length,
      provider_failures: report.provider_responses.filter(r => r.status !== 'success').length,
      recoveries: report.recovery_events.length,
    };

    if (this._bus) {
      this._bus.publish('kernel.reality.report_completed', {
        goal_id: goalId,
        outcome,
        total_latency_ms: report.total_latency_ms,
        sla_summary: report.sla_summary,
      });
    }

    return report;
  }

  /**
   * Get the full report for a goal (for replay / debugging).
   */
  getReport(goalId) {
    return this._reports.get(goalId) || null;
  }

  /**
   * Get aggregate production KPI metrics across all completed reports.
   */
  getProductKPIs() {
    const completed = Array.from(this._reports.values()).filter(r => r.outcome !== 'IN_PROGRESS');
    if (completed.length === 0) return null;

    const discoveryStages = completed.flatMap(r => r.stages.filter(s => s.stage === 'DISCOVERY'));
    const avgDiscovery = discoveryStages.length
      ? discoveryStages.reduce((sum, s) => sum + s.actual_latency_ms, 0) / discoveryStages.length
      : null;

    const successCount = completed.filter(r => r.outcome === 'SUCCESS' || r.outcome === 'RECOVERED').length;
    const recoveryCount = completed.filter(r => r.outcome === 'RECOVERED').length;
    const totalRecoveries = completed.reduce((sum, r) => sum + r.recovery_events.length, 0);

    return {
      total_executions: completed.length,
      success_rate: Math.round((successCount / completed.length) * 100),
      recovery_count: recoveryCount,
      total_recovery_events: totalRecoveries,
      avg_discovery_latency_ms: avgDiscovery ? Math.round(avgDiscovery) : null,
      avg_total_latency_ms: Math.round(
        completed.reduce((sum, r) => sum + (r.total_latency_ms || 0), 0) / completed.length
      ),
    };
  }
}

let _instance = null;
function getRealityValidator(options = {}) {
  if (!_instance) _instance = new RealityValidator(options);
  return _instance;
}

module.exports = { RealityValidator, getRealityValidator };
