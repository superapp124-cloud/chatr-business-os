package ai.chatr.gsm.core.telecom

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.safety.GsmRecoverySignal
import ai.chatr.gsm.core.safety.GsmSafetyRecoveryManager
import java.util.concurrent.ConcurrentHashMap

enum class TelecomMemoryRisk {
    SERVICE_INSTANCE_ACCUMULATION,
    RETAINED_CALLBACKS,
    LEAKED_OVERLAY_REFERENCE,
    LONG_LIVED_SESSION,
    RETAINED_JOB,
}

data class TelecomMemoryGuardThresholds(
    val serviceInstanceLimit: Int = 2,
    val activeCallbackLimit: Int = 4,
    val callbackRetentionMillis: Long = 2 * 60 * 60 * 1000L,
    val overlayReferenceRetentionMillis: Long = 5 * 60 * 1000L,
    val longLivedSessionMillis: Long = 6 * 60 * 60 * 1000L,
    val activeJobLimit: Int = 8,
    val jobRetentionMillis: Long = 30_000L,
)

data class TelecomMemoryGuardReport(
    val healthy: Boolean,
    val risks: Set<TelecomMemoryRisk>,
    val activeServiceCount: Int,
    val activeCallbackCount: Int,
    val overlayReferenceCount: Int,
    val activeJobCount: Int,
    val retainedCallbackCount: Int,
    val leakedOverlayReferenceCount: Int,
    val retainedJobCount: Int,
    val longLivedSessionCount: Int,
)

class TelecomMemoryGuard(
    private val stateMachine: GsmSessionStateMachine,
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val recoveryManager: GsmSafetyRecoveryManager = GsmSafetyRecoveryManager(),
    private val thresholds: TelecomMemoryGuardThresholds = TelecomMemoryGuardThresholds(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    private val services = ConcurrentHashMap<String, Long>()
    private val callbacks = ConcurrentHashMap<Int, Long>()
    private val overlayReferences = ConcurrentHashMap<String, Long>()
    private val jobs = ConcurrentHashMap<String, Long>()

    fun onServiceCreated(serviceKey: String) {
        services[serviceKey] = now()
    }

    fun onServiceDestroyed(serviceKey: String) {
        services.remove(serviceKey)
    }

    fun onCallbackRegistered(callbackKey: Int) {
        callbacks[callbackKey] = now()
    }

    fun onCallbackUnregistered(callbackKey: Int) {
        callbacks.remove(callbackKey)
    }

    fun onOverlayReferenceAttached(callId: String?) {
        overlayReferences[callId.safeReferenceKey("overlay")] = now()
    }

    fun onOverlayReferenceCleared(callId: String?) {
        overlayReferences.remove(callId.safeReferenceKey("overlay"))
    }

    fun onJobStarted(jobKey: String) {
        jobs[jobKey] = now()
    }

    fun onJobCompleted(jobKey: String) {
        jobs.remove(jobKey)
    }

    fun evaluate(reason: String): TelecomMemoryGuardReport {
        val timestamp = now()
        val retainedCallbacks = callbacks.values.count {
            timestamp - it > thresholds.callbackRetentionMillis
        }
        val leakedOverlayReferences = overlayReferences.values.count {
            timestamp - it > thresholds.overlayReferenceRetentionMillis
        }
        val retainedJobs = jobs.values.count {
            timestamp - it > thresholds.jobRetentionMillis
        }
        val longLivedSessions = stateMachine.sessions.value.values.count { session ->
            !session.isTerminal && timestamp - session.firstSeenAtMillis > thresholds.longLivedSessionMillis
        }

        val risks = buildSet {
            if (services.size > thresholds.serviceInstanceLimit) {
                add(TelecomMemoryRisk.SERVICE_INSTANCE_ACCUMULATION)
            }
            if (callbacks.size > thresholds.activeCallbackLimit || retainedCallbacks > 0) {
                add(TelecomMemoryRisk.RETAINED_CALLBACKS)
            }
            if (leakedOverlayReferences > 0) {
                add(TelecomMemoryRisk.LEAKED_OVERLAY_REFERENCE)
            }
            if (longLivedSessions > 0) {
                add(TelecomMemoryRisk.LONG_LIVED_SESSION)
            }
            if (jobs.size > thresholds.activeJobLimit || retainedJobs > 0) {
                add(TelecomMemoryRisk.RETAINED_JOB)
            }
        }

        val report = TelecomMemoryGuardReport(
            healthy = risks.isEmpty(),
            risks = risks,
            activeServiceCount = services.size,
            activeCallbackCount = callbacks.size,
            overlayReferenceCount = overlayReferences.size,
            activeJobCount = jobs.size,
            retainedCallbackCount = retainedCallbacks,
            leakedOverlayReferenceCount = leakedOverlayReferences,
            retainedJobCount = retainedJobs,
            longLivedSessionCount = longLivedSessions,
        )
        record(reason, report, timestamp)
        triggerRecovery(report)
        return report
    }

    private fun triggerRecovery(report: TelecomMemoryGuardReport) {
        if (TelecomMemoryRisk.LEAKED_OVERLAY_REFERENCE in report.risks) {
            recoveryManager.report(
                signal = GsmRecoverySignal.CLEANUP_FAILURE,
                feature = GsmFeature.OVERLAY,
                reason = "memory_guard_overlay_reference",
            )
        }
        if (TelecomMemoryRisk.RETAINED_CALLBACKS in report.risks ||
            TelecomMemoryRisk.SERVICE_INSTANCE_ACCUMULATION in report.risks ||
            TelecomMemoryRisk.LONG_LIVED_SESSION in report.risks ||
            TelecomMemoryRisk.RETAINED_JOB in report.risks
        ) {
            recoveryManager.report(
                signal = GsmRecoverySignal.TELECOM_CALLBACK_FAILURE,
                feature = GsmFeature.PASSIVE_CALL_OBSERVATION,
                reason = "memory_guard_lifecycle_retention",
            )
        }
    }

    private fun record(
        reason: String,
        report: TelecomMemoryGuardReport,
        timestamp: Long,
    ) {
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.TELECOM_MEMORY_GUARD_REPORTED,
                sessionKey = null,
                timestampMillis = timestamp,
                activationPath = "phase_1f_long_run_validation",
                attributes = mapOf(
                    "reason" to reason,
                    "healthy" to report.healthy.toString(),
                    "risks" to report.risks.joinToString { it.name },
                    "active_services" to report.activeServiceCount.toString(),
                    "active_callbacks" to report.activeCallbackCount.toString(),
                    "overlay_references" to report.overlayReferenceCount.toString(),
                    "active_jobs" to report.activeJobCount.toString(),
                    "retained_callbacks" to report.retainedCallbackCount.toString(),
                    "leaked_overlay_references" to report.leakedOverlayReferenceCount.toString(),
                    "retained_jobs" to report.retainedJobCount.toString(),
                    "long_lived_sessions" to report.longLivedSessionCount.toString(),
                ),
            ),
        )
    }

    private fun String?.safeReferenceKey(prefix: String): String {
        return "$prefix:${this?.takeIf { it.isNotBlank() } ?: "unknown"}"
    }
}
