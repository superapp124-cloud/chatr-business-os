package ai.chatr.gsm.core.safety

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.telecom.TelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEvent
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import ai.chatr.gsm.core.telecom.NoOpTelecomEventRecorder
import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class GsmRecoverySignal {
    OVERLAY_RENDER_FAILURE,
    OVERLAY_CRASH,
    TELECOM_CALLBACK_FAILURE,
    CLEANUP_FAILURE,
    APP_RESTART,
    RECOVERY_CONFIRMED,
}

enum class GsmRecoveryAction {
    NONE,
    FORCE_CLEANUP,
    DISABLE_OVERLAY,
    DISABLE_CALL_SCREENING,
    DISABLE_GSM_LAYER,
}

data class GsmSafetyRecoveryDecision(
    val action: GsmRecoveryAction,
    val autoDisabledFeatures: Set<GsmFeature>,
    val reason: String,
)

data class GsmSafetyRecoveryState(
    val overlayFailureCount: Int = 0,
    val telecomCallbackFailureCount: Int = 0,
    val cleanupFailureCount: Int = 0,
    val autoDisabledFeatures: Set<GsmFeature> = emptySet(),
    val lastSignalAtMillis: Long = 0L,
    val lastReason: String? = null,
)

interface GsmSafetyRecoveryStore {
    fun current(): GsmSafetyRecoveryState
    fun save(state: GsmSafetyRecoveryState)
}

class InMemoryGsmSafetyRecoveryStore(
    private var state: GsmSafetyRecoveryState = GsmSafetyRecoveryState(),
) : GsmSafetyRecoveryStore {
    override fun current(): GsmSafetyRecoveryState = state

    override fun save(state: GsmSafetyRecoveryState) {
        this.state = state
    }
}

class GsmSafetyRecoveryManager(
    private val store: GsmSafetyRecoveryStore = InMemoryGsmSafetyRecoveryStore(),
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun report(
        signal: GsmRecoverySignal,
        feature: GsmFeature? = null,
        reason: String,
        sessionKey: Int? = null,
    ): GsmSafetyRecoveryDecision {
        val current = store.current()
        val updatedCounts = when (signal) {
            GsmRecoverySignal.OVERLAY_RENDER_FAILURE,
            GsmRecoverySignal.OVERLAY_CRASH -> current.copy(
                overlayFailureCount = current.overlayFailureCount + 1,
            )
            GsmRecoverySignal.TELECOM_CALLBACK_FAILURE -> current.copy(
                telecomCallbackFailureCount = current.telecomCallbackFailureCount + 1,
            )
            GsmRecoverySignal.CLEANUP_FAILURE -> current.copy(
                cleanupFailureCount = current.cleanupFailureCount + 1,
            )
            GsmRecoverySignal.APP_RESTART,
            GsmRecoverySignal.RECOVERY_CONFIRMED -> current
        }

        val action = chooseAction(updatedCounts, signal)
        val disabled = updatedCounts.autoDisabledFeatures + action.disabledFeatures(feature)
        val next = updatedCounts.copy(
            autoDisabledFeatures = disabled,
            lastSignalAtMillis = now(),
            lastReason = reason,
        )
        store.save(next)

        val decision = GsmSafetyRecoveryDecision(
            action = action,
            autoDisabledFeatures = disabled,
            reason = reason,
        )
        record(signal, decision, sessionKey)
        return decision
    }

    fun isFeatureAutoDisabled(feature: GsmFeature): Boolean {
        val disabled = store.current().autoDisabledFeatures
        return feature in disabled || GsmFeature.GSM_INTELLIGENCE in disabled
    }

    fun currentState(): GsmSafetyRecoveryState = store.current()

    private fun chooseAction(
        state: GsmSafetyRecoveryState,
        signal: GsmRecoverySignal,
    ): GsmRecoveryAction {
        return when {
            state.telecomCallbackFailureCount >= 2 -> GsmRecoveryAction.DISABLE_GSM_LAYER
            state.overlayFailureCount >= 3 -> GsmRecoveryAction.DISABLE_OVERLAY
            state.cleanupFailureCount >= 1 -> GsmRecoveryAction.FORCE_CLEANUP
            signal == GsmRecoverySignal.APP_RESTART && state.cleanupFailureCount > 0 ->
                GsmRecoveryAction.FORCE_CLEANUP
            else -> GsmRecoveryAction.NONE
        }
    }

    private fun GsmRecoveryAction.disabledFeatures(feature: GsmFeature?): Set<GsmFeature> {
        return when (this) {
            GsmRecoveryAction.DISABLE_GSM_LAYER -> setOf(GsmFeature.GSM_INTELLIGENCE)
            GsmRecoveryAction.DISABLE_CALL_SCREENING -> setOf(GsmFeature.CALL_SCREENING)
            GsmRecoveryAction.DISABLE_OVERLAY -> setOf(GsmFeature.OVERLAY)
            GsmRecoveryAction.FORCE_CLEANUP,
            GsmRecoveryAction.NONE -> feature?.let { emptySet() } ?: emptySet()
        }
    }

    private fun record(
        signal: GsmRecoverySignal,
        decision: GsmSafetyRecoveryDecision,
        sessionKey: Int?,
    ) {
        val attributes = mapOf(
            "signal" to signal.name,
            "action" to decision.action.name,
            "disabled_features" to decision.autoDisabledFeatures.joinToString { it.name },
            "reason" to decision.reason,
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.SAFETY_RECOVERY_ACTION,
                sessionKey = sessionKey,
                timestampMillis = now(),
                activationPath = "phase_1c_internal_validation",
                attributes = attributes,
            ),
        )
        if (decision.action != GsmRecoveryAction.NONE) {
            telemetrySink.track(
                GsmTelemetryEvent(
                    name = GsmTelemetryEventName.AUTO_DISABLED_FOR_SAFETY,
                    attributes = attributes,
                ),
            )
        }
    }
}
