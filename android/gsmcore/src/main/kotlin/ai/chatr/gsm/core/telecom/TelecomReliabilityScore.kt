package ai.chatr.gsm.core.telecom

import ai.chatr.gsm.core.compat.OemRolloutTier
import ai.chatr.gsm.core.compat.OemTelecomBehaviorProfile
import ai.chatr.gsm.core.compat.OemTelecomBehaviorProfiles
import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class TelecomReliabilityGrade {
    EXCELLENT,
    GOOD,
    WATCH,
    UNSTABLE,
    CRITICAL,
}

enum class TelecomReliabilityConcern {
    CLEANUP_FAILURES,
    SLOW_OVERLAY_ATTACH,
    CALLBACK_INSTABILITY,
    MEMORY_RISK,
    WATCHDOG_INTERVENTIONS,
    OEM_HISTORY_RISK,
    HEALTH_VIOLATION,
}

data class TelecomReliabilityComponents(
    val cleanupCorrectness: Int,
    val overlayLatency: Int,
    val callbackStability: Int,
    val memoryHealth: Int,
    val watchdogStability: Int,
    val oemStability: Int,
)

data class TelecomReliabilityScoreReport(
    val score: Int,
    val grade: TelecomReliabilityGrade,
    val shouldAutoDisable: Boolean,
    val concerns: Set<TelecomReliabilityConcern>,
    val components: TelecomReliabilityComponents,
    val overlayAttachP95Millis: Long?,
    val watchdogInterventionCount: Int,
    val callbackIssueCount: Int,
    val cleanupFailureCount: Int,
)

class TelecomReliabilityScore(
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val healthMonitor: TelecomHealthMonitor,
    private val memoryGuard: TelecomMemoryGuard,
    private val overlayLatencyProfiler: OverlayLatencyProfiler,
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val oemProfileProvider: () -> OemTelecomBehaviorProfile = { OemTelecomBehaviorProfiles.current() },
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun calculate(reason: String): TelecomReliabilityScoreReport {
        val events = recorder.snapshot()
        val health = healthMonitor.evaluate("reliability_$reason")
        val memory = memoryGuard.evaluate("reliability_$reason")
        val latency = overlayLatencyProfiler.profile("reliability_$reason")
        val profile = oemProfileProvider()

        val cleanupFailures = events.count {
            it.type == TelecomRecordedEventType.CLEANUP_FAILED ||
                it.type == TelecomRecordedEventType.OVERLAY_DETACH_FAILED
        }
        val cleanupSuccesses = events.count {
            it.type == TelecomRecordedEventType.CLEANUP_SUCCEEDED ||
                it.type == TelecomRecordedEventType.OVERLAY_DETACHED
        }
        val callbackIssues = events.count {
            it.type == TelecomRecordedEventType.CALLBACK_IGNORED ||
                it.type == TelecomRecordedEventType.CALLBACK_FAILURE
        }
        val watchdogInterventions = events.count {
            it.type == TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION &&
                it.attributes["action"] != "NONE"
        }

        val cleanupScore = ratioScore(
            successes = cleanupSuccesses,
            failures = cleanupFailures,
            emptyScore = 100,
        )
        val latencyScore = latency.attach.p95Millis?.let { p95 ->
            if (p95 <= latency.attach.targetMillis) {
                100
            } else {
                ((latency.attach.targetMillis.toFloat() / p95.toFloat()) * 100).toInt()
            }
        } ?: 100
        val callbackScore = (100 - callbackIssues * 12).coerceIn(0, 100)
        val memoryScore = if (memory.healthy) 100 else 45
        val watchdogScore = (100 - watchdogInterventions * 20).coerceIn(0, 100)
        val oemScore = profile.rolloutTier.oemScore()

        val components = TelecomReliabilityComponents(
            cleanupCorrectness = cleanupScore,
            overlayLatency = latencyScore.coerceIn(0, 100),
            callbackStability = callbackScore,
            memoryHealth = memoryScore,
            watchdogStability = watchdogScore,
            oemStability = oemScore,
        )
        val score = weightedScore(components)
        val concerns = buildSet {
            if (cleanupFailures > 0) add(TelecomReliabilityConcern.CLEANUP_FAILURES)
            if (!latency.attach.withinTarget) add(TelecomReliabilityConcern.SLOW_OVERLAY_ATTACH)
            if (callbackIssues > 0 || !health.healthy) add(TelecomReliabilityConcern.CALLBACK_INSTABILITY)
            if (!memory.healthy) add(TelecomReliabilityConcern.MEMORY_RISK)
            if (watchdogInterventions > 0) add(TelecomReliabilityConcern.WATCHDOG_INTERVENTIONS)
            if (oemScore < 70) add(TelecomReliabilityConcern.OEM_HISTORY_RISK)
            if (!health.healthy) add(TelecomReliabilityConcern.HEALTH_VIOLATION)
        }
        val grade = when {
            score >= 90 -> TelecomReliabilityGrade.EXCELLENT
            score >= 80 -> TelecomReliabilityGrade.GOOD
            score >= 70 -> TelecomReliabilityGrade.WATCH
            score >= 55 -> TelecomReliabilityGrade.UNSTABLE
            else -> TelecomReliabilityGrade.CRITICAL
        }
        val report = TelecomReliabilityScoreReport(
            score = score,
            grade = grade,
            shouldAutoDisable = grade == TelecomReliabilityGrade.CRITICAL ||
                grade == TelecomReliabilityGrade.UNSTABLE ||
                TelecomReliabilityConcern.MEMORY_RISK in concerns ||
                TelecomReliabilityConcern.CLEANUP_FAILURES in concerns,
            concerns = concerns,
            components = components,
            overlayAttachP95Millis = latency.attach.p95Millis,
            watchdogInterventionCount = watchdogInterventions,
            callbackIssueCount = callbackIssues,
            cleanupFailureCount = cleanupFailures,
        )
        record(reason, report)
        return report
    }

    private fun ratioScore(
        successes: Int,
        failures: Int,
        emptyScore: Int,
    ): Int {
        val total = successes + failures
        if (total == 0) return emptyScore
        return ((successes.toFloat() / total.toFloat()) * 100).toInt().coerceIn(0, 100)
    }

    private fun weightedScore(components: TelecomReliabilityComponents): Int {
        return (
            components.cleanupCorrectness * 0.24f +
                components.overlayLatency * 0.18f +
                components.callbackStability * 0.22f +
                components.memoryHealth * 0.18f +
                components.watchdogStability * 0.12f +
                components.oemStability * 0.06f
            ).toInt().coerceIn(0, 100)
    }

    private fun OemRolloutTier.oemScore(): Int {
        return when (this) {
            OemRolloutTier.PIXEL_REFERENCE -> 100
            OemRolloutTier.SAMSUNG_PRIORITY -> 92
            OemRolloutTier.ONEPLUS_PRIORITY -> 86
            OemRolloutTier.DELAYED_VALIDATION -> 45
            OemRolloutTier.UNKNOWN_CONSERVATIVE -> 35
        }
    }

    private fun record(
        reason: String,
        report: TelecomReliabilityScoreReport,
    ) {
        val attributes = mapOf(
            "reason" to reason,
            "score" to report.score.toString(),
            "grade" to report.grade.name,
            "auto_disable" to report.shouldAutoDisable.toString(),
            "concerns" to report.concerns.joinToString { it.name },
            "cleanup_score" to report.components.cleanupCorrectness.toString(),
            "latency_score" to report.components.overlayLatency.toString(),
            "callback_score" to report.components.callbackStability.toString(),
            "memory_score" to report.components.memoryHealth.toString(),
            "watchdog_score" to report.components.watchdogStability.toString(),
            "oem_score" to report.components.oemStability.toString(),
            "overlay_attach_p95" to report.overlayAttachP95Millis.toString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.RELIABILITY_SCORE_REPORTED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_2a_internal_telecom_pilot",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.RELIABILITY_SCORE_REPORTED,
                attributes = attributes,
            ),
        )
    }
}
