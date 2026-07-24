package ai.chatr.gsm.core.telecom

import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

data class OperationalRate(
    val numerator: Int,
    val denominator: Int,
) {
    val percent: Float
        get() = if (denominator == 0) 100f else (numerator.toFloat() / denominator.toFloat()) * 100f
}

data class OperationalLatencyTrend(
    val sampleCount: Int,
    val p50Millis: Long?,
    val p95Millis: Long?,
    val maxMillis: Long?,
)

data class OemOperationalStats(
    val manufacturer: String,
    val eventCount: Int,
    val overlaySuccessRate: OperationalRate,
    val watchdogInterventions: Int,
    val cleanupFailures: Int,
    val incidentCount: Int,
)

data class TelecomOperationalDashboardSnapshot(
    val generatedAtMillis: Long,
    val activationAllowedCount: Int,
    val activationDeniedCount: Int,
    val overlaySuccessRate: OperationalRate,
    val watchdogInterventions: Int,
    val cleanupFailures: Int,
    val attachLatencyTrend: OperationalLatencyTrend,
    val detachLatencyTrend: OperationalLatencyTrend,
    val oemStability: List<OemOperationalStats>,
    val incidentSummary: TelecomIncidentSummary,
)

class TelecomOperationalDashboard(
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val incidentClassifier: TelecomIncidentClassifier = TelecomIncidentClassifier(recorder),
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun snapshot(
        reason: String,
        windowMillis: Long = 24 * 60 * 60 * 1000L,
    ): TelecomOperationalDashboardSnapshot {
        val cutoff = now() - windowMillis
        val events = recorder.snapshot().filter { it.timestampMillis >= cutoff }
        val activationEvents = events.filter { it.type == TelecomRecordedEventType.PILOT_ROLLOUT_DECISION }
        val overlaySuccesses = events.count { it.type == TelecomRecordedEventType.OVERLAY_ATTACHED }
        val overlayFailures = events.count { it.type == TelecomRecordedEventType.OVERLAY_ATTACH_FAILED }
        val watchdogInterventions = events.count {
            it.type == TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION &&
                it.attributes["action"] != "NONE"
        }
        val cleanupFailures = events.count {
            it.type == TelecomRecordedEventType.CLEANUP_FAILED ||
                it.type == TelecomRecordedEventType.OVERLAY_DETACH_FAILED
        }
        val incidents = events.mapNotNull { incidentClassifier.classify(it) }
        val incidentSummary = TelecomIncidentSummary(
            totalCount = incidents.size,
            byType = incidents.groupingBy { it.type }.eachCount(),
            highestSeverity = incidents.maxByOrNull { it.severity.ordinal }?.severity,
            incidents = incidents,
        )
        val snapshot = TelecomOperationalDashboardSnapshot(
            generatedAtMillis = now(),
            activationAllowedCount = activationEvents.count { it.attributes["allowed"] == "true" },
            activationDeniedCount = activationEvents.count { it.attributes["allowed"] == "false" },
            overlaySuccessRate = OperationalRate(
                numerator = overlaySuccesses,
                denominator = overlaySuccesses + overlayFailures,
            ),
            watchdogInterventions = watchdogInterventions,
            cleanupFailures = cleanupFailures,
            attachLatencyTrend = events
                .filter { it.type == TelecomRecordedEventType.OVERLAY_ATTACHED }
                .mapNotNull { it.durationMillis }
                .toLatencyTrend(),
            detachLatencyTrend = events
                .filter { it.type == TelecomRecordedEventType.OVERLAY_DETACHED }
                .mapNotNull { it.durationMillis }
                .toLatencyTrend(),
            oemStability = events.groupBy { it.manufacturer.ifBlank { "unknown" } }
                .map { (manufacturer, manufacturerEvents) ->
                    manufacturerEvents.toOemStats(manufacturer, incidentSummary)
                }
                .sortedByDescending { it.eventCount },
            incidentSummary = incidentSummary,
        )
        record(reason, snapshot)
        return snapshot
    }

    private fun List<TelecomRecordedEvent>.toOemStats(
        manufacturer: String,
        incidentSummary: TelecomIncidentSummary,
    ): OemOperationalStats {
        val overlaySuccesses = count { it.type == TelecomRecordedEventType.OVERLAY_ATTACHED }
        val overlayFailures = count { it.type == TelecomRecordedEventType.OVERLAY_ATTACH_FAILED }
        return OemOperationalStats(
            manufacturer = manufacturer,
            eventCount = size,
            overlaySuccessRate = OperationalRate(
                numerator = overlaySuccesses,
                denominator = overlaySuccesses + overlayFailures,
            ),
            watchdogInterventions = count {
                it.type == TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION &&
                    it.attributes["action"] != "NONE"
            },
            cleanupFailures = count {
                it.type == TelecomRecordedEventType.CLEANUP_FAILED ||
                    it.type == TelecomRecordedEventType.OVERLAY_DETACH_FAILED
            },
            incidentCount = incidentSummary.incidents.count { it.manufacturer == manufacturer },
        )
    }

    private fun List<Long>.toLatencyTrend(): OperationalLatencyTrend {
        val sorted = sorted()
        return OperationalLatencyTrend(
            sampleCount = sorted.size,
            p50Millis = sorted.percentile(0.50),
            p95Millis = sorted.percentile(0.95),
            maxMillis = sorted.lastOrNull(),
        )
    }

    private fun List<Long>.percentile(percentile: Double): Long? {
        if (isEmpty()) return null
        val index = ((size - 1) * percentile).toInt().coerceIn(0, size - 1)
        return this[index]
    }

    private fun record(
        reason: String,
        snapshot: TelecomOperationalDashboardSnapshot,
    ) {
        val attributes = mapOf(
            "reason" to reason,
            "activation_allowed" to snapshot.activationAllowedCount.toString(),
            "activation_denied" to snapshot.activationDeniedCount.toString(),
            "overlay_success_rate" to snapshot.overlaySuccessRate.percent.toInt().toString(),
            "watchdog_interventions" to snapshot.watchdogInterventions.toString(),
            "cleanup_failures" to snapshot.cleanupFailures.toString(),
            "attach_p95" to snapshot.attachLatencyTrend.p95Millis.toString(),
            "detach_p95" to snapshot.detachLatencyTrend.p95Millis.toString(),
            "incident_count" to snapshot.incidentSummary.totalCount.toString(),
            "oem_count" to snapshot.oemStability.size.toString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.OPERATIONAL_DASHBOARD_REPORTED,
                sessionKey = null,
                timestampMillis = snapshot.generatedAtMillis,
                activationPath = "phase_2b_live_pilot_operations",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.OPERATIONAL_DASHBOARD_REPORTED,
                attributes = attributes,
            ),
        )
    }
}
