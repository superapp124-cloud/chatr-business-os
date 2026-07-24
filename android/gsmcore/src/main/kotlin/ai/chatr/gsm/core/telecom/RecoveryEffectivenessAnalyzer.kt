package ai.chatr.gsm.core.telecom

import ai.chatr.gsm.core.safety.SilentFallbackAction
import ai.chatr.gsm.core.safety.SilentRollbackStage
import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

data class RecoveryEffectivenessReport(
    val containmentEffective: Boolean,
    val recommendedEscalation: Boolean,
    val fallbackSuccessRate: OperationalRate,
    val rollbackSuccessRate: OperationalRate,
    val watchdogRecoveryRate: OperationalRate,
    val overlayCleanupRecoveryRate: OperationalRate,
    val failedRecoveryCount: Int,
)

class RecoveryEffectivenessAnalyzer(
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun analyze(
        reason: String,
        windowMillis: Long = 24 * 60 * 60 * 1000L,
        recoveryWindowMillis: Long = 5 * 60 * 1000L,
    ): RecoveryEffectivenessReport {
        val cutoff = now() - windowMillis
        val events = recorder.snapshot()
            .filter { it.timestampMillis >= cutoff }
            .sortedBy { it.timestampMillis }
        val fallbackEvents = events.filter { it.isFallbackAction() }
        val rollbackEvents = events.filter { it.isRollbackAction() }
        val watchdogEvents = events.filter { it.isWatchdogAction() }
        val overlayCleanupEvents = events.filter {
            it.type == TelecomRecordedEventType.OVERLAY_DETACH_REQUESTED ||
                it.type == TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION
        }
        val fallbackSuccesses = fallbackEvents.count { source ->
            events.recoverySucceededAfter(source, recoveryWindowMillis)
        }
        val rollbackSuccesses = rollbackEvents.count { source ->
            events.rollbackSucceededAfter(source, recoveryWindowMillis)
        }
        val watchdogSuccesses = watchdogEvents.count { source ->
            events.recoverySucceededAfter(source, recoveryWindowMillis)
        }
        val overlayCleanupSuccesses = overlayCleanupEvents.count { source ->
            events.overlayCleanupSucceededAfter(source, recoveryWindowMillis)
        }
        val failedRecoveries = fallbackEvents.size - fallbackSuccesses +
            rollbackEvents.size - rollbackSuccesses +
            watchdogEvents.size - watchdogSuccesses
        val report = RecoveryEffectivenessReport(
            containmentEffective = failedRecoveries == 0,
            recommendedEscalation = failedRecoveries >= 2,
            fallbackSuccessRate = OperationalRate(fallbackSuccesses, fallbackEvents.size),
            rollbackSuccessRate = OperationalRate(rollbackSuccesses, rollbackEvents.size),
            watchdogRecoveryRate = OperationalRate(watchdogSuccesses, watchdogEvents.size),
            overlayCleanupRecoveryRate = OperationalRate(overlayCleanupSuccesses, overlayCleanupEvents.size),
            failedRecoveryCount = failedRecoveries,
        )
        record(reason, report)
        return report
    }

    private fun List<TelecomRecordedEvent>.recoverySucceededAfter(
        source: TelecomRecordedEvent,
        recoveryWindowMillis: Long,
    ): Boolean {
        val followUps = followUpsFor(source, recoveryWindowMillis)
        val failure = followUps.any {
            it.type == TelecomRecordedEventType.CALLBACK_FAILURE ||
                it.type == TelecomRecordedEventType.CLEANUP_FAILED ||
                it.type == TelecomRecordedEventType.OVERLAY_DETACH_FAILED
        }
        val success = followUps.any {
            it.type == TelecomRecordedEventType.CLEANUP_SUCCEEDED ||
                it.type == TelecomRecordedEventType.OVERLAY_DETACHED ||
                it.type == TelecomRecordedEventType.SAFETY_RECOVERY_ACTION &&
                    it.attributes["action"] == "NONE"
        }
        return success && !failure
    }

    private fun List<TelecomRecordedEvent>.rollbackSucceededAfter(
        source: TelecomRecordedEvent,
        recoveryWindowMillis: Long,
    ): Boolean {
        val followUps = followUpsFor(source, recoveryWindowMillis)
        val failure = followUps.any {
            it.type == TelecomRecordedEventType.CALLBACK_FAILURE ||
                it.type == TelecomRecordedEventType.CLEANUP_FAILED ||
                it.type == TelecomRecordedEventType.PILOT_CONFIDENCE_REPORTED &&
                    it.attributes["level"] == PilotConfidenceLevel.ROLLBACK.name
        }
        val stableSignal = followUps.any {
            it.type == TelecomRecordedEventType.TELECOM_OPERATIONAL_SLA_MONITORED &&
                it.attributes["status"] != TelecomOperationalSlaStatus.VIOLATION.name
        } || followUps.none {
            it.type == TelecomRecordedEventType.CALLBACK_FAILURE ||
                it.type == TelecomRecordedEventType.CLEANUP_FAILED
        }
        return stableSignal && !failure
    }

    private fun List<TelecomRecordedEvent>.overlayCleanupSucceededAfter(
        source: TelecomRecordedEvent,
        recoveryWindowMillis: Long,
    ): Boolean {
        val followUps = followUpsFor(source, recoveryWindowMillis)
        return followUps.any {
            it.type == TelecomRecordedEventType.OVERLAY_DETACHED ||
                it.type == TelecomRecordedEventType.CLEANUP_SUCCEEDED
        } && followUps.none {
            it.type == TelecomRecordedEventType.OVERLAY_DETACH_FAILED ||
                it.type == TelecomRecordedEventType.CLEANUP_FAILED
        }
    }

    private fun List<TelecomRecordedEvent>.followUpsFor(
        source: TelecomRecordedEvent,
        recoveryWindowMillis: Long,
    ): List<TelecomRecordedEvent> {
        return filter { candidate ->
            candidate.timestampMillis > source.timestampMillis &&
                candidate.timestampMillis <= source.timestampMillis + recoveryWindowMillis &&
                (source.sessionKey == null || candidate.sessionKey == source.sessionKey || candidate.sessionKey == null)
        }
    }

    private fun TelecomRecordedEvent.isFallbackAction(): Boolean {
        return type == TelecomRecordedEventType.SILENT_FALLBACK_APPLIED &&
            attributes["action"] != SilentFallbackAction.NONE.name
    }

    private fun TelecomRecordedEvent.isRollbackAction(): Boolean {
        return type == TelecomRecordedEventType.SILENT_ROLLBACK_ORCHESTRATED &&
            attributes["stage"] != SilentRollbackStage.NONE.name
    }

    private fun TelecomRecordedEvent.isWatchdogAction(): Boolean {
        return type == TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION &&
            attributes["action"] != "NONE"
    }

    private fun record(
        reason: String,
        report: RecoveryEffectivenessReport,
    ) {
        val attributes = mapOf(
            "reason" to reason,
            "effective" to report.containmentEffective.toString(),
            "escalate" to report.recommendedEscalation.toString(),
            "fallback_rate" to report.fallbackSuccessRate.percent.toInt().toString(),
            "rollback_rate" to report.rollbackSuccessRate.percent.toInt().toString(),
            "watchdog_rate" to report.watchdogRecoveryRate.percent.toInt().toString(),
            "overlay_cleanup_rate" to report.overlayCleanupRecoveryRate.percent.toInt().toString(),
            "failed_recoveries" to report.failedRecoveryCount.toString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.RECOVERY_EFFECTIVENESS_ANALYZED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_2d_long_horizon_maturity",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.RECOVERY_EFFECTIVENESS_ANALYZED,
                attributes = attributes,
            ),
        )
    }
}
