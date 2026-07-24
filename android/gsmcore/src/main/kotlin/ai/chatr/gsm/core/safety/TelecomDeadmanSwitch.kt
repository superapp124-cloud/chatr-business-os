package ai.chatr.gsm.core.safety

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.telecom.NoOpTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEvent
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class TelecomDeadmanTrigger {
    NONE,
    WATCHDOG_RECOVERY_LOOP,
    UNRECOVERABLE_OVERLAY_FAILURE,
    TELECOM_CALLBACK_STARVATION,
    STATE_MACHINE_CORRUPTION,
}

data class TelecomDeadmanThresholds(
    val maxWatchdogInterventions: Int = 3,
    val maxOverlayFailures: Int = 3,
    val maxCallbackFailures: Int = 2,
    val maxStateMachineCorruptionEvents: Int = 1,
)

data class TelecomDeadmanDecision(
    val tripped: Boolean,
    val trigger: TelecomDeadmanTrigger,
    val reason: String,
    val safeModeState: GsmSafeModeState?,
    val preservesCarrierCalling: Boolean = true,
)

class TelecomDeadmanSwitch(
    private val safeMode: GsmSafeMode = GsmSafeMode(),
    private val recoveryManager: GsmSafetyRecoveryManager = GsmSafetyRecoveryManager(),
    private val thresholds: TelecomDeadmanThresholds = TelecomDeadmanThresholds(),
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun evaluateAndTripIfNeeded(
        reason: String,
        windowMillis: Long = 10 * 60 * 1000L,
    ): TelecomDeadmanDecision {
        if (safeMode.isActive()) {
            return TelecomDeadmanDecision(
                tripped = true,
                trigger = safeMode.current().trigger?.toDeadmanTrigger() ?: TelecomDeadmanTrigger.NONE,
                reason = safeMode.current().reason.orEmpty(),
                safeModeState = safeMode.current(),
            )
        }
        val cutoff = now() - windowMillis
        val events = recorder.snapshot().filter { it.timestampMillis >= cutoff }
        val watchdogLoops = events.count { it.isWatchdogIntervention() }
        val overlayFailures = events.count {
            it.type == TelecomRecordedEventType.OVERLAY_ATTACH_FAILED ||
                it.type == TelecomRecordedEventType.OVERLAY_DETACH_FAILED
        }
        val callbackFailures = events.count { it.type == TelecomRecordedEventType.CALLBACK_FAILURE }
        val stateMachineCorruption = events.count { it.isStateMachineCorruption() }
        val trigger = when {
            stateMachineCorruption >= thresholds.maxStateMachineCorruptionEvents ->
                TelecomDeadmanTrigger.STATE_MACHINE_CORRUPTION
            callbackFailures >= thresholds.maxCallbackFailures ->
                TelecomDeadmanTrigger.TELECOM_CALLBACK_STARVATION
            overlayFailures >= thresholds.maxOverlayFailures ->
                TelecomDeadmanTrigger.UNRECOVERABLE_OVERLAY_FAILURE
            watchdogLoops >= thresholds.maxWatchdogInterventions ->
                TelecomDeadmanTrigger.WATCHDOG_RECOVERY_LOOP
            else -> TelecomDeadmanTrigger.NONE
        }
        val decision = if (trigger == TelecomDeadmanTrigger.NONE) {
            TelecomDeadmanDecision(
                tripped = false,
                trigger = trigger,
                reason = reason,
                safeModeState = null,
            )
        } else {
            trip(
                trigger = trigger,
                reason = "${reason}_${trigger.name.lowercase()}",
            )
        }
        return decision
    }

    fun trip(
        trigger: TelecomDeadmanTrigger,
        reason: String,
    ): TelecomDeadmanDecision {
        val safeState = safeMode.enter(
            trigger = GsmSafeModeTrigger.DEADMAN_SWITCH,
            reason = reason,
            disabledFeatures = GsmSafeMode.defaultDisabledFeatures,
            manualReenableRequired = true,
        )
        repeat(2) { index ->
            recoveryManager.report(
                signal = GsmRecoverySignal.TELECOM_CALLBACK_FAILURE,
                feature = GsmFeature.PASSIVE_CALL_OBSERVATION,
                reason = "${reason}_deadman_$index",
            )
        }
        return TelecomDeadmanDecision(
            tripped = true,
            trigger = trigger,
            reason = reason,
            safeModeState = safeState,
        ).also { decision ->
            record(reason, decision)
        }
    }

    private fun TelecomRecordedEvent.isWatchdogIntervention(): Boolean {
        return type == TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION &&
            attributes["action"] != "NONE"
    }

    private fun TelecomRecordedEvent.isStateMachineCorruption(): Boolean {
        return type == TelecomRecordedEventType.SESSION_CONSISTENCY_AUDIT &&
            attributes["consistent"] == "false" &&
            (
                "INVALID_TRANSITION_RECORDED" in attributes["issues"].orEmpty() ||
                    "SESSION_OVERLAY_MISMATCH" in attributes["issues"].orEmpty() ||
                    "ORPHAN_ACTIVE_SESSION" in attributes["issues"].orEmpty()
                )
    }

    private fun GsmSafeModeTrigger.toDeadmanTrigger(): TelecomDeadmanTrigger {
        return if (this == GsmSafeModeTrigger.DEADMAN_SWITCH) {
            TelecomDeadmanTrigger.STATE_MACHINE_CORRUPTION
        } else {
            TelecomDeadmanTrigger.NONE
        }
    }

    private fun record(
        reason: String,
        decision: TelecomDeadmanDecision,
    ) {
        val attributes = mapOf(
            "reason" to reason,
            "tripped" to decision.tripped.toString(),
            "trigger" to decision.trigger.name,
            "decision_reason" to decision.reason,
            "safe_mode_active" to (decision.safeModeState?.active == true).toString(),
            "manual_reenable_required" to (decision.safeModeState?.manualReenableRequired == true).toString(),
            "preserves_carrier_calling" to decision.preservesCarrierCalling.toString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.TELECOM_DEADMAN_SWITCH_TRIPPED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_2e_device_ship_readiness",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.TELECOM_DEADMAN_SWITCH_TRIPPED,
                attributes = attributes,
            ),
        )
    }
}
