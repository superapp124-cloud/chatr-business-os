package ai.chatr.gsm.core.telecom

import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class TelecomOperationalSlaStatus {
    PASS,
    WATCH,
    VIOLATION,
}

enum class TelecomOperationalSlaBreach {
    ATTACH_LATENCY,
    CLEANUP_CORRECTNESS,
    CALLBACK_RECONCILIATION,
    WATCHDOG_INTERVENTIONS,
    BASELINE_VIOLATION,
    CONFIDENCE_ROLLBACK,
}

enum class TelecomOperationalSlaEnforcement {
    NONE,
    WATCH_ONLY,
    PAUSE_OVERLAY_EXPANSION,
    HOLD_ROLLOUT_EXPANSION,
    REQUEST_ROLLBACK_ORCHESTRATION,
}

data class TelecomOperationalSlaTargets(
    val maxAttachP95Millis: Long = 150L,
    val minCleanupSuccessPercent: Float = 99f,
    val minCallbackReconciliationScore: Int = 90,
    val maxWatchdogInterventions: Int = 1,
)

data class TelecomOperationalSlaReport(
    val status: TelecomOperationalSlaStatus,
    val enforcement: TelecomOperationalSlaEnforcement,
    val breaches: Set<TelecomOperationalSlaBreach>,
    val baseline: TelecomStabilityBaselineReport,
    val confidence: PilotConfidenceReport,
    val evaluatedAtMillis: Long,
)

class TelecomOperationalSlaMonitor(
    private val stabilityBaseline: TelecomStabilityBaseline,
    private val confidenceEngine: PilotConfidenceEngine,
    private val targets: TelecomOperationalSlaTargets = TelecomOperationalSlaTargets(),
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun monitor(
        reason: String,
        windowMillis: Long = 24 * 60 * 60 * 1000L,
    ): TelecomOperationalSlaReport {
        val baseline = stabilityBaseline.evaluate("sla_$reason", windowMillis)
        val confidence = confidenceEngine.evaluate("sla_$reason", windowMillis)
        val breaches = buildSet {
            if ((baseline.overlayAttachP95Millis ?: 0L) > targets.maxAttachP95Millis) {
                add(TelecomOperationalSlaBreach.ATTACH_LATENCY)
            }
            if (baseline.cleanupSuccessRate.percent < targets.minCleanupSuccessPercent) {
                add(TelecomOperationalSlaBreach.CLEANUP_CORRECTNESS)
            }
            if (confidence.components.callbackReconciliation < targets.minCallbackReconciliationScore) {
                add(TelecomOperationalSlaBreach.CALLBACK_RECONCILIATION)
            }
            if (baseline.watchdogInterventions > targets.maxWatchdogInterventions) {
                add(TelecomOperationalSlaBreach.WATCHDOG_INTERVENTIONS)
            }
            if (!baseline.acceptable) {
                add(TelecomOperationalSlaBreach.BASELINE_VIOLATION)
            }
            if (confidence.level == PilotConfidenceLevel.ROLLBACK) {
                add(TelecomOperationalSlaBreach.CONFIDENCE_ROLLBACK)
            }
        }
        val status = when {
            TelecomOperationalSlaBreach.CONFIDENCE_ROLLBACK in breaches ||
                TelecomOperationalSlaBreach.CALLBACK_RECONCILIATION in breaches -> TelecomOperationalSlaStatus.VIOLATION
            breaches.isNotEmpty() -> TelecomOperationalSlaStatus.WATCH
            else -> TelecomOperationalSlaStatus.PASS
        }
        val enforcement = when {
            TelecomOperationalSlaBreach.CONFIDENCE_ROLLBACK in breaches ||
                TelecomOperationalSlaBreach.CALLBACK_RECONCILIATION in breaches ->
                TelecomOperationalSlaEnforcement.REQUEST_ROLLBACK_ORCHESTRATION
            TelecomOperationalSlaBreach.ATTACH_LATENCY in breaches ||
                TelecomOperationalSlaBreach.WATCHDOG_INTERVENTIONS in breaches ->
                TelecomOperationalSlaEnforcement.PAUSE_OVERLAY_EXPANSION
            TelecomOperationalSlaBreach.CLEANUP_CORRECTNESS in breaches ||
                TelecomOperationalSlaBreach.BASELINE_VIOLATION in breaches ->
                TelecomOperationalSlaEnforcement.HOLD_ROLLOUT_EXPANSION
            status == TelecomOperationalSlaStatus.WATCH -> TelecomOperationalSlaEnforcement.WATCH_ONLY
            else -> TelecomOperationalSlaEnforcement.NONE
        }
        val report = TelecomOperationalSlaReport(
            status = status,
            enforcement = enforcement,
            breaches = breaches,
            baseline = baseline,
            confidence = confidence,
            evaluatedAtMillis = now(),
        )
        record(reason, report)
        return report
    }

    private fun record(
        reason: String,
        report: TelecomOperationalSlaReport,
    ) {
        val attributes = mapOf(
            "reason" to reason,
            "status" to report.status.name,
            "enforcement" to report.enforcement.name,
            "breaches" to report.breaches.joinToString { it.name },
            "attach_p95" to report.baseline.overlayAttachP95Millis.toString(),
            "cleanup_success_rate" to report.baseline.cleanupSuccessRate.percent.toInt().toString(),
            "callback_reconciliation" to report.confidence.components.callbackReconciliation.toString(),
            "watchdog_interventions" to report.baseline.watchdogInterventions.toString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.TELECOM_OPERATIONAL_SLA_MONITORED,
                sessionKey = null,
                timestampMillis = report.evaluatedAtMillis,
                activationPath = "phase_2d_long_horizon_maturity",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.TELECOM_OPERATIONAL_SLA_MONITORED,
                attributes = attributes,
            ),
        )
    }
}
