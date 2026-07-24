package ai.chatr.gsm.core.telecom

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.safety.GsmRecoverySignal
import ai.chatr.gsm.core.safety.GsmSafetyRecoveryManager

enum class TelecomHealthViolation {
    OVERLAY_FAILURES,
    CLEANUP_OVERDUE,
    CALLBACK_STORM,
    LIFECYCLE_DRIFT,
}

data class TelecomHealthThresholds(
    val rollingWindowMillis: Long = 60_000,
    val overlayFailureLimit: Int = 3,
    val callbackStormLimit: Int = 24,
    val cleanupOverdueMillis: Long = 1_500,
    val activeSessionDriftMillis: Long = 30_000,
)

data class TelecomHealthReport(
    val healthy: Boolean,
    val violations: Set<TelecomHealthViolation>,
    val overlayFailureCount: Int,
    val callbackEventCount: Int,
    val cleanupOverdueCount: Int,
    val driftingSessionCount: Int,
)

class TelecomHealthMonitor(
    private val stateMachine: GsmSessionStateMachine,
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val recoveryManager: GsmSafetyRecoveryManager = GsmSafetyRecoveryManager(),
    private val thresholds: TelecomHealthThresholds = TelecomHealthThresholds(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun evaluate(reason: String): TelecomHealthReport {
        val timestamp = now()
        val events = recorder.snapshot().filter {
            timestamp - it.timestampMillis <= thresholds.rollingWindowMillis
        }
        val overlayFailures = events.count {
            it.type == TelecomRecordedEventType.OVERLAY_ATTACH_FAILED ||
                it.type == TelecomRecordedEventType.OVERLAY_DETACH_FAILED
        }
        val callbackEvents = events.count {
            it.type == TelecomRecordedEventType.SESSION_TRANSITION ||
                it.type == TelecomRecordedEventType.CALLBACK_IGNORED ||
                it.type == TelecomRecordedEventType.CALLBACK_FAILURE
        }
        val cleanupOverdue = stateMachine.sessions.value.values.filter { session ->
            session.cleanupRequired &&
                timestamp - session.lastTransitionAtMillis > thresholds.cleanupOverdueMillis
        }
        val driftingSessions = stateMachine.sessions.value.values.filter { session ->
            !session.isTerminal &&
                timestamp - session.lastTransitionAtMillis > thresholds.activeSessionDriftMillis
        }

        val violations = buildSet {
            if (overlayFailures >= thresholds.overlayFailureLimit) add(TelecomHealthViolation.OVERLAY_FAILURES)
            if (cleanupOverdue.isNotEmpty()) add(TelecomHealthViolation.CLEANUP_OVERDUE)
            if (callbackEvents >= thresholds.callbackStormLimit) add(TelecomHealthViolation.CALLBACK_STORM)
            if (driftingSessions.isNotEmpty()) add(TelecomHealthViolation.LIFECYCLE_DRIFT)
        }

        val report = TelecomHealthReport(
            healthy = violations.isEmpty(),
            violations = violations,
            overlayFailureCount = overlayFailures,
            callbackEventCount = callbackEvents,
            cleanupOverdueCount = cleanupOverdue.size,
            driftingSessionCount = driftingSessions.size,
        )
        record(reason, report, timestamp)
        triggerRecovery(report)
        return report
    }

    private fun triggerRecovery(report: TelecomHealthReport) {
        if (TelecomHealthViolation.OVERLAY_FAILURES in report.violations) {
            recoveryManager.report(
                signal = GsmRecoverySignal.OVERLAY_RENDER_FAILURE,
                feature = GsmFeature.OVERLAY,
                reason = "health_overlay_failures",
            )
        }
        if (TelecomHealthViolation.CLEANUP_OVERDUE in report.violations) {
            recoveryManager.report(
                signal = GsmRecoverySignal.CLEANUP_FAILURE,
                feature = GsmFeature.OVERLAY,
                reason = "health_cleanup_overdue",
            )
        }
        if (TelecomHealthViolation.CALLBACK_STORM in report.violations ||
            TelecomHealthViolation.LIFECYCLE_DRIFT in report.violations
        ) {
            recoveryManager.report(
                signal = GsmRecoverySignal.TELECOM_CALLBACK_FAILURE,
                feature = GsmFeature.PASSIVE_CALL_OBSERVATION,
                reason = "health_callback_or_drift",
            )
        }
    }

    private fun record(
        reason: String,
        report: TelecomHealthReport,
        timestamp: Long,
    ) {
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.TELECOM_HEALTH_REPORTED,
                sessionKey = null,
                timestampMillis = timestamp,
                activationPath = "phase_1e_dogfood_readiness",
                attributes = mapOf(
                    "reason" to reason,
                    "healthy" to report.healthy.toString(),
                    "violations" to report.violations.joinToString { it.name },
                    "overlay_failures" to report.overlayFailureCount.toString(),
                    "callback_events" to report.callbackEventCount.toString(),
                    "cleanup_overdue" to report.cleanupOverdueCount.toString(),
                    "drifting_sessions" to report.driftingSessionCount.toString(),
                ),
            ),
        )
    }
}
