package ai.chatr.gsm.core.safety

import android.content.Context
import android.os.Build
import ai.chatr.gsm.core.telecom.NoOpTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEvent
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class TelecomCrashLoopSignal {
    SERVICE_CRASH,
    OVERLAY_ATTACH_FAILURE,
    PROCESS_RECOVERY_FAILURE,
    WATCHDOG_ESCALATION,
}

enum class TelecomCrashLoopAction {
    NONE,
    OBSERVE,
    SUPPRESS_RESTARTS,
    ENTER_SAFE_MODE,
}

data class TelecomCrashLoopThresholds(
    val maxServiceCrashes: Int = 2,
    val maxOverlayAttachFailures: Int = 3,
    val maxProcessRecoveryFailures: Int = 2,
    val maxWatchdogEscalations: Int = 3,
    val cooldownMillis: Long = 30 * 60 * 1000L,
)

data class TelecomCrashLoopState(
    val serviceCrashCount: Int = 0,
    val overlayAttachFailureCount: Int = 0,
    val processRecoveryFailureCount: Int = 0,
    val watchdogEscalationCount: Int = 0,
    val firstFailureAtMillis: Long = 0L,
    val lastFailureAtMillis: Long = 0L,
    val cooldownUntilMillis: Long = 0L,
    val restartSuppressed: Boolean = false,
    val lastReason: String? = null,
)

data class TelecomCrashLoopDecision(
    val loopDetected: Boolean,
    val action: TelecomCrashLoopAction,
    val reason: String,
    val cooldownUntilMillis: Long,
    val safeModeState: GsmSafeModeState?,
    val preservesCarrierCalling: Boolean = true,
)

interface TelecomCrashLoopStore {
    fun current(): TelecomCrashLoopState
    fun save(state: TelecomCrashLoopState)
}

class InMemoryTelecomCrashLoopStore(
    private var state: TelecomCrashLoopState = TelecomCrashLoopState(),
) : TelecomCrashLoopStore {
    override fun current(): TelecomCrashLoopState = state

    override fun save(state: TelecomCrashLoopState) {
        this.state = state
    }
}

class SharedPreferencesTelecomCrashLoopStore(
    private val context: Context,
) : TelecomCrashLoopStore {
    private val prefs by lazy {
        val appContext = context.applicationContext
        val isLocked = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && 
            !(appContext.getSystemService(android.os.UserManager::class.java)?.isUserUnlocked ?: true)
        val safeContext = if (isLocked) {
            appContext.createDeviceProtectedStorageContext()
        } else {
            appContext
        }
        safeContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    override fun current(): TelecomCrashLoopState {
        return TelecomCrashLoopState(
            serviceCrashCount = prefs.getInt(KEY_SERVICE_CRASH_COUNT, 0),
            overlayAttachFailureCount = prefs.getInt(KEY_OVERLAY_ATTACH_FAILURE_COUNT, 0),
            processRecoveryFailureCount = prefs.getInt(KEY_PROCESS_RECOVERY_FAILURE_COUNT, 0),
            watchdogEscalationCount = prefs.getInt(KEY_WATCHDOG_ESCALATION_COUNT, 0),
            firstFailureAtMillis = prefs.getLong(KEY_FIRST_FAILURE_AT, 0L),
            lastFailureAtMillis = prefs.getLong(KEY_LAST_FAILURE_AT, 0L),
            cooldownUntilMillis = prefs.getLong(KEY_COOLDOWN_UNTIL, 0L),
            restartSuppressed = prefs.getBoolean(KEY_RESTART_SUPPRESSED, false),
            lastReason = prefs.getString(KEY_LAST_REASON, null),
        )
    }

    override fun save(state: TelecomCrashLoopState) {
        prefs.edit()
            .putInt(KEY_SERVICE_CRASH_COUNT, state.serviceCrashCount)
            .putInt(KEY_OVERLAY_ATTACH_FAILURE_COUNT, state.overlayAttachFailureCount)
            .putInt(KEY_PROCESS_RECOVERY_FAILURE_COUNT, state.processRecoveryFailureCount)
            .putInt(KEY_WATCHDOG_ESCALATION_COUNT, state.watchdogEscalationCount)
            .putLong(KEY_FIRST_FAILURE_AT, state.firstFailureAtMillis)
            .putLong(KEY_LAST_FAILURE_AT, state.lastFailureAtMillis)
            .putLong(KEY_COOLDOWN_UNTIL, state.cooldownUntilMillis)
            .putBoolean(KEY_RESTART_SUPPRESSED, state.restartSuppressed)
            .putString(KEY_LAST_REASON, state.lastReason)
            .apply()
    }

    private companion object {
        const val PREFS_NAME = "ai.chatr.gsm.crash_loop"
        const val KEY_SERVICE_CRASH_COUNT = "service_crash_count"
        const val KEY_OVERLAY_ATTACH_FAILURE_COUNT = "overlay_attach_failure_count"
        const val KEY_PROCESS_RECOVERY_FAILURE_COUNT = "process_recovery_failure_count"
        const val KEY_WATCHDOG_ESCALATION_COUNT = "watchdog_escalation_count"
        const val KEY_FIRST_FAILURE_AT = "first_failure_at"
        const val KEY_LAST_FAILURE_AT = "last_failure_at"
        const val KEY_COOLDOWN_UNTIL = "cooldown_until"
        const val KEY_RESTART_SUPPRESSED = "restart_suppressed"
        const val KEY_LAST_REASON = "last_reason"
    }
}

class TelecomCrashLoopProtector(
    private val store: TelecomCrashLoopStore = InMemoryTelecomCrashLoopStore(),
    private val safeMode: GsmSafeMode = GsmSafeMode(),
    private val thresholds: TelecomCrashLoopThresholds = TelecomCrashLoopThresholds(),
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun report(
        signal: TelecomCrashLoopSignal,
        reason: String,
    ): TelecomCrashLoopDecision {
        val current = store.current()
        if (current.restartSuppressed && now() < current.cooldownUntilMillis) {
            return decision(
                action = TelecomCrashLoopAction.SUPPRESS_RESTARTS,
                state = current,
                reason = reason,
                safeModeState = safeMode.current().takeIf { it.active },
            )
        }
        val base = if (current.firstFailureAtMillis == 0L) {
            current.copy(firstFailureAtMillis = now())
        } else {
            current
        }
        val updated = when (signal) {
            TelecomCrashLoopSignal.SERVICE_CRASH -> base.copy(
                serviceCrashCount = base.serviceCrashCount + 1,
            )
            TelecomCrashLoopSignal.OVERLAY_ATTACH_FAILURE -> base.copy(
                overlayAttachFailureCount = base.overlayAttachFailureCount + 1,
            )
            TelecomCrashLoopSignal.PROCESS_RECOVERY_FAILURE -> base.copy(
                processRecoveryFailureCount = base.processRecoveryFailureCount + 1,
            )
            TelecomCrashLoopSignal.WATCHDOG_ESCALATION -> base.copy(
                watchdogEscalationCount = base.watchdogEscalationCount + 1,
            )
        }.copy(
            lastFailureAtMillis = now(),
            lastReason = reason,
        )
        return applyThresholds(updated, reason)
    }

    fun evaluateRecentEvents(
        reason: String,
        windowMillis: Long = 10 * 60 * 1000L,
    ): TelecomCrashLoopDecision {
        val current = store.current()
        if (current.restartSuppressed && now() < current.cooldownUntilMillis) {
            return decision(
                action = TelecomCrashLoopAction.SUPPRESS_RESTARTS,
                state = current,
                reason = reason,
                safeModeState = safeMode.current().takeIf { it.active },
            )
        }
        val cutoff = now() - windowMillis
        val events = recorder.snapshot().filter { it.timestampMillis >= cutoff }
        val updated = TelecomCrashLoopState(
            serviceCrashCount = events.count { it.type == TelecomRecordedEventType.CALLBACK_FAILURE },
            overlayAttachFailureCount = events.count { it.type == TelecomRecordedEventType.OVERLAY_ATTACH_FAILED },
            processRecoveryFailureCount = events.count { it.isProcessRecoveryFailure() },
            watchdogEscalationCount = events.count { it.isWatchdogEscalation() },
            firstFailureAtMillis = events.firstOrNull()?.timestampMillis ?: 0L,
            lastFailureAtMillis = events.lastOrNull()?.timestampMillis ?: 0L,
            lastReason = reason,
        )
        return applyThresholds(updated, reason)
    }

    fun isRestartSuppressed(): Boolean {
        val state = store.current()
        return state.restartSuppressed && now() < state.cooldownUntilMillis
    }

    fun current(): TelecomCrashLoopState = store.current()

    private fun applyThresholds(
        state: TelecomCrashLoopState,
        reason: String,
    ): TelecomCrashLoopDecision {
        val loopDetected = state.serviceCrashCount >= thresholds.maxServiceCrashes ||
            state.overlayAttachFailureCount >= thresholds.maxOverlayAttachFailures ||
            state.processRecoveryFailureCount >= thresholds.maxProcessRecoveryFailures ||
            state.watchdogEscalationCount >= thresholds.maxWatchdogEscalations
        val finalState = if (loopDetected) {
            state.copy(
                restartSuppressed = true,
                cooldownUntilMillis = now() + thresholds.cooldownMillis,
            )
        } else {
            state.copy(restartSuppressed = false)
        }
        store.save(finalState)
        val safeState = if (loopDetected) {
            safeMode.enter(
                trigger = GsmSafeModeTrigger.CRASH_LOOP,
                reason = reason,
                manualReenableRequired = true,
            )
        } else {
            null
        }
        val action = when {
            loopDetected -> TelecomCrashLoopAction.ENTER_SAFE_MODE
            finalState.serviceCrashCount > 0 ||
                finalState.overlayAttachFailureCount > 0 ||
                finalState.processRecoveryFailureCount > 0 ||
                finalState.watchdogEscalationCount > 0 -> TelecomCrashLoopAction.OBSERVE
            else -> TelecomCrashLoopAction.NONE
        }
        return decision(
            action = action,
            state = finalState,
            reason = reason,
            safeModeState = safeState,
        )
    }

    private fun decision(
        action: TelecomCrashLoopAction,
        state: TelecomCrashLoopState,
        reason: String,
        safeModeState: GsmSafeModeState?,
    ): TelecomCrashLoopDecision {
        val decision = TelecomCrashLoopDecision(
            loopDetected = action == TelecomCrashLoopAction.ENTER_SAFE_MODE ||
                action == TelecomCrashLoopAction.SUPPRESS_RESTARTS,
            action = action,
            reason = reason,
            cooldownUntilMillis = state.cooldownUntilMillis,
            safeModeState = safeModeState,
        )
        record(decision, state)
        return decision
    }

    private fun TelecomRecordedEvent.isProcessRecoveryFailure(): Boolean {
        return type == TelecomRecordedEventType.PROCESS_RECOVERY_RECONCILED &&
            "REPORT_TELECOM_MISMATCH" in attributes["actions"].orEmpty()
    }

    private fun TelecomRecordedEvent.isWatchdogEscalation(): Boolean {
        return type == TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION &&
            attributes["action"] != "NONE"
    }

    private fun record(
        decision: TelecomCrashLoopDecision,
        state: TelecomCrashLoopState,
    ) {
        val attributes = mapOf(
            "action" to decision.action.name,
            "loop_detected" to decision.loopDetected.toString(),
            "reason" to decision.reason,
            "service_crashes" to state.serviceCrashCount.toString(),
            "overlay_attach_failures" to state.overlayAttachFailureCount.toString(),
            "process_recovery_failures" to state.processRecoveryFailureCount.toString(),
            "watchdog_escalations" to state.watchdogEscalationCount.toString(),
            "restart_suppressed" to state.restartSuppressed.toString(),
            "cooldown_active" to (state.cooldownUntilMillis > now()).toString(),
            "preserves_carrier_calling" to decision.preservesCarrierCalling.toString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.TELECOM_CRASH_LOOP_PROTECTED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_2e_device_ship_readiness",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.TELECOM_CRASH_LOOP_PROTECTED,
                attributes = attributes,
            ),
        )
    }
}
