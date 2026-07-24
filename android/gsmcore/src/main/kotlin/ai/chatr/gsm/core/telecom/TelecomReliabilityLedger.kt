package ai.chatr.gsm.core.telecom

import ai.chatr.gsm.core.safety.SilentRollbackStage
import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

data class TelecomLedgerStabilityStats(
    val key: String,
    val eventCount: Int,
    val watchdogEvents: Int,
    val cleanupFailures: Int,
    val rollbackEvents: Int,
    val averageConfidenceScore: Int?,
)

data class TelecomConfidenceTrend(
    val reportCount: Int,
    val latestScore: Int?,
    val averageScore: Int?,
    val minimumScore: Int?,
    val direction: ReliabilityTrendDirection,
)

data class TelecomReliabilityLedgerSnapshot(
    val generatedAtMillis: Long,
    val windowMillis: Long,
    val totalEvents: Int,
    val oemStability: List<TelecomLedgerStabilityStats>,
    val androidVersionStability: List<TelecomLedgerStabilityStats>,
    val rollbackFrequency: Int,
    val watchdogEventCount: Int,
    val confidenceTrend: TelecomConfidenceTrend,
)

class TelecomReliabilityLedger(
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun snapshot(
        reason: String,
        windowMillis: Long = 7 * 24 * 60 * 60 * 1000L,
    ): TelecomReliabilityLedgerSnapshot {
        val cutoff = now() - windowMillis
        val events = recorder.snapshot().filter { it.timestampMillis >= cutoff }
        val confidenceReports = events.confidenceReports()
        val snapshot = TelecomReliabilityLedgerSnapshot(
            generatedAtMillis = now(),
            windowMillis = windowMillis,
            totalEvents = events.size,
            oemStability = events
                .groupBy { it.manufacturer.ifBlank { "unknown" } }
                .map { (manufacturer, manufacturerEvents) ->
                    manufacturerEvents.toStabilityStats(manufacturer, confidenceReports)
                }
                .sortedByDescending { it.eventCount },
            androidVersionStability = events
                .groupBy { it.androidSdk.toString() }
                .map { (androidSdk, sdkEvents) ->
                    sdkEvents.toStabilityStats(androidSdk, confidenceReports)
                }
                .sortedByDescending { it.eventCount },
            rollbackFrequency = events.count { it.isRollbackEvent() },
            watchdogEventCount = events.count { it.isWatchdogIntervention() },
            confidenceTrend = confidenceReports.toConfidenceTrend(),
        )
        record(reason, snapshot)
        return snapshot
    }

    private fun List<TelecomRecordedEvent>.toStabilityStats(
        key: String,
        confidenceReports: List<TelecomRecordedEvent>,
    ): TelecomLedgerStabilityStats {
        val keyConfidenceScores = confidenceReports
            .filter { report ->
                key == report.manufacturer.ifBlank { "unknown" } ||
                    key == report.androidSdk.toString()
            }
            .mapNotNull { it.attributes["score"]?.toIntOrNull() }
        return TelecomLedgerStabilityStats(
            key = key,
            eventCount = size,
            watchdogEvents = count { it.isWatchdogIntervention() },
            cleanupFailures = count { it.isCleanupFailure() },
            rollbackEvents = count { it.isRollbackEvent() },
            averageConfidenceScore = keyConfidenceScores.takeIf { it.isNotEmpty() }?.average()?.toInt(),
        )
    }

    private fun List<TelecomRecordedEvent>.confidenceReports(): List<TelecomRecordedEvent> {
        return filter { it.type == TelecomRecordedEventType.PILOT_CONFIDENCE_REPORTED }
            .sortedBy { it.timestampMillis }
    }

    private fun List<TelecomRecordedEvent>.toConfidenceTrend(): TelecomConfidenceTrend {
        val scores = mapNotNull { it.attributes["score"]?.toIntOrNull() }
        val direction = when {
            scores.size < 2 -> ReliabilityTrendDirection.STABLE
            scores.last() - scores.first() >= 5 -> ReliabilityTrendDirection.IMPROVING
            scores.first() - scores.last() >= 5 -> ReliabilityTrendDirection.DEGRADING
            else -> ReliabilityTrendDirection.STABLE
        }
        return TelecomConfidenceTrend(
            reportCount = scores.size,
            latestScore = scores.lastOrNull(),
            averageScore = scores.takeIf { it.isNotEmpty() }?.average()?.toInt(),
            minimumScore = scores.minOrNull(),
            direction = direction,
        )
    }

    private fun TelecomRecordedEvent.isCleanupFailure(): Boolean {
        return type == TelecomRecordedEventType.CLEANUP_FAILED ||
            type == TelecomRecordedEventType.OVERLAY_DETACH_FAILED
    }

    private fun TelecomRecordedEvent.isWatchdogIntervention(): Boolean {
        return type == TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION &&
            attributes["action"] != "NONE"
    }

    private fun TelecomRecordedEvent.isRollbackEvent(): Boolean {
        return (type == TelecomRecordedEventType.SILENT_ROLLBACK_ORCHESTRATED &&
            attributes["stage"] != SilentRollbackStage.NONE.name) ||
            (type == TelecomRecordedEventType.SILENT_FALLBACK_APPLIED &&
                attributes["action"] != "NONE")
    }

    private fun record(
        reason: String,
        snapshot: TelecomReliabilityLedgerSnapshot,
    ) {
        val attributes = mapOf(
            "reason" to reason,
            "events" to snapshot.totalEvents.toString(),
            "oem_count" to snapshot.oemStability.size.toString(),
            "android_version_count" to snapshot.androidVersionStability.size.toString(),
            "rollback_frequency" to snapshot.rollbackFrequency.toString(),
            "watchdog_events" to snapshot.watchdogEventCount.toString(),
            "confidence_reports" to snapshot.confidenceTrend.reportCount.toString(),
            "confidence_direction" to snapshot.confidenceTrend.direction.name,
            "latest_confidence" to snapshot.confidenceTrend.latestScore.toString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.TELECOM_RELIABILITY_LEDGER_UPDATED,
                sessionKey = null,
                timestampMillis = snapshot.generatedAtMillis,
                activationPath = "phase_2d_long_horizon_maturity",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.TELECOM_RELIABILITY_LEDGER_UPDATED,
                attributes = attributes,
            ),
        )
    }
}
