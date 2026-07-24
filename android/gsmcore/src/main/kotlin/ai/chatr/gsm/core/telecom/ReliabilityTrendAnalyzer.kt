package ai.chatr.gsm.core.telecom

import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class ReliabilityTrendSignal {
    ROLLING_CRASH_RISK,
    LIFECYCLE_DRIFT_INCREASE,
    MEMORY_TREND_GROWTH,
    OVERLAY_DEGRADATION,
    OEM_REGRESSION_PATTERN,
}

enum class ReliabilityTrendDirection {
    STABLE,
    IMPROVING,
    DEGRADING,
}

data class ReliabilityTrendMetric(
    val signal: ReliabilityTrendSignal,
    val direction: ReliabilityTrendDirection,
    val previousValue: Float,
    val currentValue: Float,
)

data class ReliabilityTrendReport(
    val healthy: Boolean,
    val signals: Set<ReliabilityTrendSignal>,
    val metrics: List<ReliabilityTrendMetric>,
    val affectedManufacturers: Set<String>,
    val recommendedRollback: Boolean,
)

class ReliabilityTrendAnalyzer(
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun analyze(
        reason: String,
        windowMillis: Long = 24 * 60 * 60 * 1000L,
    ): ReliabilityTrendReport {
        val cutoff = now() - windowMillis
        val midpoint = cutoff + windowMillis / 2
        val events = recorder.snapshot().filter { it.timestampMillis >= cutoff }
        val previous = events.filter { it.timestampMillis < midpoint }
        val current = events.filter { it.timestampMillis >= midpoint }

        val metrics = listOf(
            trendMetric(
                signal = ReliabilityTrendSignal.ROLLING_CRASH_RISK,
                previousValue = previous.crashRiskValue(),
                currentValue = current.crashRiskValue(),
                higherIsWorse = true,
            ),
            trendMetric(
                signal = ReliabilityTrendSignal.LIFECYCLE_DRIFT_INCREASE,
                previousValue = previous.lifecycleDriftValue(),
                currentValue = current.lifecycleDriftValue(),
                higherIsWorse = true,
            ),
            trendMetric(
                signal = ReliabilityTrendSignal.MEMORY_TREND_GROWTH,
                previousValue = previous.memoryRiskValue(),
                currentValue = current.memoryRiskValue(),
                higherIsWorse = true,
            ),
            trendMetric(
                signal = ReliabilityTrendSignal.OVERLAY_DEGRADATION,
                previousValue = previous.overlayLatencyValue(),
                currentValue = current.overlayLatencyValue(),
                higherIsWorse = true,
            ),
            trendMetric(
                signal = ReliabilityTrendSignal.OEM_REGRESSION_PATTERN,
                previousValue = previous.oemRegressionValue(),
                currentValue = current.oemRegressionValue(),
                higherIsWorse = true,
            ),
        )
        val signals = metrics
            .filter { it.direction == ReliabilityTrendDirection.DEGRADING && it.currentValue > 0f }
            .map { it.signal }
            .toSet()
        val affectedManufacturers = current
            .filter { it.isRegressionEvent() }
            .map { it.manufacturer.ifBlank { "unknown" } }
            .toSet()
        val report = ReliabilityTrendReport(
            healthy = signals.isEmpty(),
            signals = signals,
            metrics = metrics,
            affectedManufacturers = affectedManufacturers,
            recommendedRollback = signals.any {
                it == ReliabilityTrendSignal.ROLLING_CRASH_RISK ||
                    it == ReliabilityTrendSignal.LIFECYCLE_DRIFT_INCREASE ||
                    it == ReliabilityTrendSignal.MEMORY_TREND_GROWTH
            } || signals.size >= 2,
        )
        record(reason, report)
        return report
    }

    private fun trendMetric(
        signal: ReliabilityTrendSignal,
        previousValue: Float,
        currentValue: Float,
        higherIsWorse: Boolean,
    ): ReliabilityTrendMetric {
        val delta = currentValue - previousValue
        val threshold = when (signal) {
            ReliabilityTrendSignal.OVERLAY_DEGRADATION -> 25f
            ReliabilityTrendSignal.ROLLING_CRASH_RISK -> 0.5f
            else -> 1f
        }
        val direction = when {
            higherIsWorse && delta > threshold -> ReliabilityTrendDirection.DEGRADING
            higherIsWorse && delta < -threshold -> ReliabilityTrendDirection.IMPROVING
            !higherIsWorse && delta < -threshold -> ReliabilityTrendDirection.DEGRADING
            !higherIsWorse && delta > threshold -> ReliabilityTrendDirection.IMPROVING
            else -> ReliabilityTrendDirection.STABLE
        }
        return ReliabilityTrendMetric(
            signal = signal,
            direction = direction,
            previousValue = previousValue,
            currentValue = currentValue,
        )
    }

    private fun List<TelecomRecordedEvent>.crashRiskValue(): Float {
        return count {
            it.type == TelecomRecordedEventType.CALLBACK_FAILURE ||
                (it.type == TelecomRecordedEventType.SILENT_FALLBACK_APPLIED &&
                    it.attributes["action"] == "DISABLE_GSM_LAYER")
        }.toFloat()
    }

    private fun List<TelecomRecordedEvent>.lifecycleDriftValue(): Float {
        return count {
            (it.type == TelecomRecordedEventType.TELECOM_HEALTH_REPORTED &&
                ("LIFECYCLE_DRIFT" in it.attributes["violations"].orEmpty() ||
                    "CALLBACK_STORM" in it.attributes["violations"].orEmpty())) ||
                (it.type == TelecomRecordedEventType.SESSION_CONSISTENCY_AUDIT &&
                    it.attributes["consistent"] == "false")
        }.toFloat()
    }

    private fun List<TelecomRecordedEvent>.memoryRiskValue(): Float {
        return count {
            it.type == TelecomRecordedEventType.TELECOM_MEMORY_GUARD_REPORTED &&
                it.attributes["healthy"] == "false"
        }.toFloat()
    }

    private fun List<TelecomRecordedEvent>.overlayLatencyValue(): Float {
        val samples = filter { it.type == TelecomRecordedEventType.OVERLAY_ATTACHED }
            .mapNotNull { it.durationMillis }
            .sorted()
        if (samples.isEmpty()) return 0f
        val index = ((samples.size - 1) * 0.95).toInt().coerceIn(0, samples.size - 1)
        return samples[index].toFloat()
    }

    private fun List<TelecomRecordedEvent>.oemRegressionValue(): Float {
        return filter { it.isRegressionEvent() }
            .groupBy { it.manufacturer.ifBlank { "unknown" } }
            .values
            .maxOfOrNull { it.size }
            ?.toFloat()
            ?: 0f
    }

    private fun TelecomRecordedEvent.isRegressionEvent(): Boolean {
        return type == TelecomRecordedEventType.OVERLAY_ATTACH_FAILED ||
            type == TelecomRecordedEventType.OVERLAY_DETACH_FAILED ||
            type == TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION && attributes["action"] != "NONE" ||
            type == TelecomRecordedEventType.TELECOM_HEALTH_REPORTED && attributes["healthy"] == "false" ||
            type == TelecomRecordedEventType.TELECOM_MEMORY_GUARD_REPORTED && attributes["healthy"] == "false"
    }

    private fun record(
        reason: String,
        report: ReliabilityTrendReport,
    ) {
        val attributes = mapOf(
            "reason" to reason,
            "healthy" to report.healthy.toString(),
            "signals" to report.signals.joinToString { it.name },
            "rollback" to report.recommendedRollback.toString(),
            "affected_oems" to report.affectedManufacturers.joinToString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.RELIABILITY_TREND_ANALYZED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_2b_live_pilot_operations",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.RELIABILITY_TREND_ANALYZED,
                attributes = attributes,
            ),
        )
    }
}
