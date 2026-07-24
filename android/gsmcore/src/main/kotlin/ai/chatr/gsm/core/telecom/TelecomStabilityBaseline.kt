package ai.chatr.gsm.core.telecom

import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class TelecomStabilityViolation {
    OVERLAY_LEAK_THRESHOLD,
    CALLBACK_DRIFT_THRESHOLD,
    MEMORY_GROWTH_THRESHOLD,
    CLEANUP_FAILURE_THRESHOLD,
    WATCHDOG_FREQUENCY_THRESHOLD,
    OVERLAY_ATTACH_P95_THRESHOLD,
    LATENCY_VARIANCE_THRESHOLD,
    OVERLAY_SUCCESS_RATE_THRESHOLD,
    CLEANUP_SUCCESS_RATE_THRESHOLD,
    CRITICAL_INCIDENT_THRESHOLD,
}

data class TelecomStabilityThresholds(
    val maxOverlayLeakIncidents: Int = 0,
    val maxCallbackDriftIncidents: Int = 1,
    val maxMemoryRiskEvents: Int = 0,
    val maxCleanupFailureEvents: Int = 0,
    val maxWatchdogInterventions: Int = 1,
    val maxOverlayAttachP95Millis: Long = 180L,
    val maxOverlayAttachLatencyRangeMillis: Long = 140L,
    val minOverlaySuccessRatePercent: Float = 98f,
    val minCleanupSuccessRatePercent: Float = 99f,
    val maxCriticalIncidents: Int = 0,
)

data class TelecomStabilityBaselineReport(
    val acceptable: Boolean,
    val violations: Set<TelecomStabilityViolation>,
    val evaluatedEventCount: Int,
    val overlayLeakIncidents: Int,
    val callbackDriftIncidents: Int,
    val memoryRiskEvents: Int,
    val cleanupFailureEvents: Int,
    val watchdogInterventions: Int,
    val criticalIncidents: Int,
    val overlayAttachP95Millis: Long?,
    val overlayAttachLatencyRangeMillis: Long?,
    val overlaySuccessRate: OperationalRate,
    val cleanupSuccessRate: OperationalRate,
)

class TelecomStabilityBaseline(
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val incidentClassifier: TelecomIncidentClassifier = TelecomIncidentClassifier(recorder),
    private val thresholds: TelecomStabilityThresholds = TelecomStabilityThresholds(),
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun evaluate(
        reason: String,
        windowMillis: Long = 24 * 60 * 60 * 1000L,
    ): TelecomStabilityBaselineReport {
        val cutoff = now() - windowMillis
        val events = recorder.snapshot().filter { it.timestampMillis >= cutoff }
        val incidents = events.mapNotNull { incidentClassifier.classify(it) }
        val overlayAttachSamples = events
            .filter { it.type == TelecomRecordedEventType.OVERLAY_ATTACHED }
            .mapNotNull { it.durationMillis }
            .sorted()
        val overlaySuccesses = events.count { it.type == TelecomRecordedEventType.OVERLAY_ATTACHED }
        val overlayFailures = events.count { it.type == TelecomRecordedEventType.OVERLAY_ATTACH_FAILED }
        val cleanupSuccesses = events.count {
            it.type == TelecomRecordedEventType.CLEANUP_SUCCEEDED ||
                it.type == TelecomRecordedEventType.OVERLAY_DETACHED
        }
        val cleanupFailures = events.count {
            it.type == TelecomRecordedEventType.CLEANUP_FAILED ||
                it.type == TelecomRecordedEventType.OVERLAY_DETACH_FAILED
        }
        val overlayLeaks = incidents.count { it.type == TelecomIncidentType.OVERLAY_LEAK }
        val callbackDrift = incidents.count { it.type == TelecomIncidentType.CALLBACK_DRIFT }
        val memoryRisk = events.count {
            it.type == TelecomRecordedEventType.TELECOM_MEMORY_GUARD_REPORTED &&
                it.attributes["healthy"] == "false"
        }
        val watchdogInterventions = events.count {
            it.type == TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION &&
                it.attributes["action"] != "NONE"
        }
        val criticalIncidents = incidents.count { it.severity == TelecomIncidentSeverity.CRITICAL }
        val overlayAttachP95 = overlayAttachSamples.percentile(0.95)
        val latencyRange = overlayAttachSamples.takeIf { it.isNotEmpty() }?.let {
            it.last() - it.first()
        }
        val overlaySuccessRate = OperationalRate(
            numerator = overlaySuccesses,
            denominator = overlaySuccesses + overlayFailures,
        )
        val cleanupSuccessRate = OperationalRate(
            numerator = cleanupSuccesses,
            denominator = cleanupSuccesses + cleanupFailures,
        )
        val violations = buildSet {
            if (overlayLeaks > thresholds.maxOverlayLeakIncidents) add(TelecomStabilityViolation.OVERLAY_LEAK_THRESHOLD)
            if (callbackDrift > thresholds.maxCallbackDriftIncidents) add(TelecomStabilityViolation.CALLBACK_DRIFT_THRESHOLD)
            if (memoryRisk > thresholds.maxMemoryRiskEvents) add(TelecomStabilityViolation.MEMORY_GROWTH_THRESHOLD)
            if (cleanupFailures > thresholds.maxCleanupFailureEvents) add(TelecomStabilityViolation.CLEANUP_FAILURE_THRESHOLD)
            if (watchdogInterventions > thresholds.maxWatchdogInterventions) add(TelecomStabilityViolation.WATCHDOG_FREQUENCY_THRESHOLD)
            if ((overlayAttachP95 ?: 0L) > thresholds.maxOverlayAttachP95Millis) add(TelecomStabilityViolation.OVERLAY_ATTACH_P95_THRESHOLD)
            if ((latencyRange ?: 0L) > thresholds.maxOverlayAttachLatencyRangeMillis) add(TelecomStabilityViolation.LATENCY_VARIANCE_THRESHOLD)
            if (overlaySuccessRate.percent < thresholds.minOverlaySuccessRatePercent) add(TelecomStabilityViolation.OVERLAY_SUCCESS_RATE_THRESHOLD)
            if (cleanupSuccessRate.percent < thresholds.minCleanupSuccessRatePercent) add(TelecomStabilityViolation.CLEANUP_SUCCESS_RATE_THRESHOLD)
            if (criticalIncidents > thresholds.maxCriticalIncidents) add(TelecomStabilityViolation.CRITICAL_INCIDENT_THRESHOLD)
        }
        val report = TelecomStabilityBaselineReport(
            acceptable = violations.isEmpty(),
            violations = violations,
            evaluatedEventCount = events.size,
            overlayLeakIncidents = overlayLeaks,
            callbackDriftIncidents = callbackDrift,
            memoryRiskEvents = memoryRisk,
            cleanupFailureEvents = cleanupFailures,
            watchdogInterventions = watchdogInterventions,
            criticalIncidents = criticalIncidents,
            overlayAttachP95Millis = overlayAttachP95,
            overlayAttachLatencyRangeMillis = latencyRange,
            overlaySuccessRate = overlaySuccessRate,
            cleanupSuccessRate = cleanupSuccessRate,
        )
        record(reason, report)
        return report
    }

    private fun List<Long>.percentile(percentile: Double): Long? {
        if (isEmpty()) return null
        val index = ((size - 1) * percentile).toInt().coerceIn(0, size - 1)
        return this[index]
    }

    private fun record(
        reason: String,
        report: TelecomStabilityBaselineReport,
    ) {
        val attributes = mapOf(
            "reason" to reason,
            "acceptable" to report.acceptable.toString(),
            "violations" to report.violations.joinToString { it.name },
            "events" to report.evaluatedEventCount.toString(),
            "overlay_leaks" to report.overlayLeakIncidents.toString(),
            "callback_drift" to report.callbackDriftIncidents.toString(),
            "memory_risk" to report.memoryRiskEvents.toString(),
            "cleanup_failures" to report.cleanupFailureEvents.toString(),
            "watchdog_interventions" to report.watchdogInterventions.toString(),
            "attach_p95" to report.overlayAttachP95Millis.toString(),
            "attach_range" to report.overlayAttachLatencyRangeMillis.toString(),
            "overlay_success_rate" to report.overlaySuccessRate.percent.toInt().toString(),
            "cleanup_success_rate" to report.cleanupSuccessRate.percent.toInt().toString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.STABILITY_BASELINE_EVALUATED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_2c_operational_validation",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.STABILITY_BASELINE_EVALUATED,
                attributes = attributes,
            ),
        )
    }
}
