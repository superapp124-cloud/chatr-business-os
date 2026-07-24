package ai.chatr.gsm.core.telecom

import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class PilotConfidenceLevel {
    READY,
    WATCH,
    HOLD,
    ROLLBACK,
}

enum class PilotConfidenceReason {
    CRASH_RISK,
    CLEANUP_NOT_PROVEN,
    WATCHDOG_TOO_FREQUENT,
    OEM_UNSTABLE,
    MEMORY_TREND_RISK,
    CALLBACK_RECONCILIATION_RISK,
    BASELINE_VIOLATION,
    TREND_ROLLBACK,
}

data class PilotConfidenceComponents(
    val crashFreeRuntime: Int,
    val cleanupCorrectness: Int,
    val watchdogStability: Int,
    val oemStability: Int,
    val memoryTrend: Int,
    val callbackReconciliation: Int,
)

data class PilotConfidenceReport(
    val score: Int,
    val level: PilotConfidenceLevel,
    val expansionAllowed: Boolean,
    val reasons: Set<PilotConfidenceReason>,
    val components: PilotConfidenceComponents,
    val baseline: TelecomStabilityBaselineReport,
    val trend: ReliabilityTrendReport,
)

class PilotConfidenceEngine(
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val stabilityBaseline: TelecomStabilityBaseline,
    private val operationalDashboard: TelecomOperationalDashboard,
    private val trendAnalyzer: ReliabilityTrendAnalyzer,
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun evaluate(
        reason: String,
        windowMillis: Long = 24 * 60 * 60 * 1000L,
    ): PilotConfidenceReport {
        val events = recorder.snapshot().filter { it.timestampMillis >= now() - windowMillis }
        val baseline = stabilityBaseline.evaluate("confidence_$reason", windowMillis)
        val dashboard = operationalDashboard.snapshot("confidence_$reason", windowMillis)
        val trend = trendAnalyzer.analyze("confidence_$reason", windowMillis)

        val crashRiskEvents = events.count {
            it.type == TelecomRecordedEventType.CALLBACK_FAILURE ||
                (it.type == TelecomRecordedEventType.SILENT_FALLBACK_APPLIED &&
                    it.attributes["action"] == "DISABLE_GSM_LAYER")
        }
        val memoryRiskEvents = baseline.memoryRiskEvents
        val callbackRiskEvents = baseline.callbackDriftIncidents
        val components = PilotConfidenceComponents(
            crashFreeRuntime = (100 - crashRiskEvents * 30).coerceIn(0, 100),
            cleanupCorrectness = baseline.cleanupSuccessRate.percent.toInt().coerceIn(0, 100),
            watchdogStability = (100 - baseline.watchdogInterventions * 20).coerceIn(0, 100),
            oemStability = dashboard.oemStability.oemConfidenceScore(),
            memoryTrend = (100 - memoryRiskEvents * 35).coerceIn(0, 100),
            callbackReconciliation = (100 - callbackRiskEvents * 25).coerceIn(0, 100),
        )
        val score = weightedScore(components)
        val reasons = buildSet {
            if (crashRiskEvents > 0) add(PilotConfidenceReason.CRASH_RISK)
            if (baseline.cleanupSuccessRate.percent < 99f) add(PilotConfidenceReason.CLEANUP_NOT_PROVEN)
            if (baseline.watchdogInterventions > 1) add(PilotConfidenceReason.WATCHDOG_TOO_FREQUENT)
            if (components.oemStability < 80) add(PilotConfidenceReason.OEM_UNSTABLE)
            if (memoryRiskEvents > 0) add(PilotConfidenceReason.MEMORY_TREND_RISK)
            if (callbackRiskEvents > 1) add(PilotConfidenceReason.CALLBACK_RECONCILIATION_RISK)
            if (!baseline.acceptable) add(PilotConfidenceReason.BASELINE_VIOLATION)
            if (trend.recommendedRollback) add(PilotConfidenceReason.TREND_ROLLBACK)
        }
        val level = when {
            PilotConfidenceReason.TREND_ROLLBACK in reasons ||
                PilotConfidenceReason.CRASH_RISK in reasons ||
                score < 55 -> PilotConfidenceLevel.ROLLBACK
            reasons.isNotEmpty() || score < 75 -> PilotConfidenceLevel.HOLD
            score < 90 -> PilotConfidenceLevel.WATCH
            else -> PilotConfidenceLevel.READY
        }
        val report = PilotConfidenceReport(
            score = score,
            level = level,
            expansionAllowed = level == PilotConfidenceLevel.READY,
            reasons = reasons,
            components = components,
            baseline = baseline,
            trend = trend,
        )
        record(reason, report)
        return report
    }

    private fun List<OemOperationalStats>.oemConfidenceScore(): Int {
        if (isEmpty()) return 100
        val average = map { stats ->
            var score = 100
            score -= stats.cleanupFailures * 25
            score -= stats.watchdogInterventions * 10
            score -= stats.incidentCount * 8
            if (stats.overlaySuccessRate.percent < 95f) score -= 20
            score.coerceIn(0, 100)
        }.average()
        return average.toInt().coerceIn(0, 100)
    }

    private fun weightedScore(components: PilotConfidenceComponents): Int {
        return (
            components.crashFreeRuntime * 0.22f +
                components.cleanupCorrectness * 0.22f +
                components.watchdogStability * 0.14f +
                components.oemStability * 0.14f +
                components.memoryTrend * 0.14f +
                components.callbackReconciliation * 0.14f
            ).toInt().coerceIn(0, 100)
    }

    private fun record(
        reason: String,
        report: PilotConfidenceReport,
    ) {
        val attributes = mapOf(
            "reason" to reason,
            "score" to report.score.toString(),
            "level" to report.level.name,
            "expansion_allowed" to report.expansionAllowed.toString(),
            "reasons" to report.reasons.joinToString { it.name },
            "crash_free" to report.components.crashFreeRuntime.toString(),
            "cleanup" to report.components.cleanupCorrectness.toString(),
            "watchdog" to report.components.watchdogStability.toString(),
            "oem" to report.components.oemStability.toString(),
            "memory" to report.components.memoryTrend.toString(),
            "callbacks" to report.components.callbackReconciliation.toString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.PILOT_CONFIDENCE_REPORTED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_2c_operational_validation",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.PILOT_CONFIDENCE_REPORTED,
                attributes = attributes,
            ),
        )
    }
}
