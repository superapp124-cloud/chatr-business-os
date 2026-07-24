package ai.chatr.gsm.core.safety

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.telecom.NoOpTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEvent
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import ai.chatr.gsm.core.telecom.TelecomReliabilityConcern
import ai.chatr.gsm.core.telecom.TelecomReliabilityGrade
import ai.chatr.gsm.core.telecom.TelecomReliabilityScoreReport
import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class SilentFallbackAction {
    NONE,
    DISABLE_OVERLAY,
    DISABLE_ENHANCEMENTS,
    DISABLE_GSM_LAYER,
}

data class SilentFallbackDecision(
    val action: SilentFallbackAction,
    val feature: GsmFeature,
    val reason: String,
    val preservesCarrierCalling: Boolean = true,
)

class SilentFallbackController(
    private val recoveryManager: GsmSafetyRecoveryManager = GsmSafetyRecoveryManager(),
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun evaluate(
        feature: GsmFeature,
        reliability: TelecomReliabilityScoreReport,
        reason: String,
    ): SilentFallbackDecision {
        val action = when {
            reliability.grade == TelecomReliabilityGrade.CRITICAL ->
                SilentFallbackAction.DISABLE_GSM_LAYER
            reliability.shouldAutoDisable &&
                TelecomReliabilityConcern.MEMORY_RISK in reliability.concerns ->
                SilentFallbackAction.DISABLE_ENHANCEMENTS
            reliability.shouldAutoDisable &&
                (TelecomReliabilityConcern.SLOW_OVERLAY_ATTACH in reliability.concerns ||
                    TelecomReliabilityConcern.WATCHDOG_INTERVENTIONS in reliability.concerns ||
                    TelecomReliabilityConcern.CLEANUP_FAILURES in reliability.concerns) ->
                SilentFallbackAction.DISABLE_OVERLAY
            reliability.shouldAutoDisable -> SilentFallbackAction.DISABLE_ENHANCEMENTS
            else -> SilentFallbackAction.NONE
        }

        return SilentFallbackDecision(
            action = action,
            feature = feature,
            reason = reason,
        )
    }

    fun apply(decision: SilentFallbackDecision): SilentFallbackDecision {
        when (decision.action) {
            SilentFallbackAction.DISABLE_OVERLAY -> forceDisableOverlay(decision.reason)
            SilentFallbackAction.DISABLE_ENHANCEMENTS -> forceDisableOverlay("${decision.reason}_enhancement")
            SilentFallbackAction.DISABLE_GSM_LAYER -> {
                recoveryManager.report(
                    signal = GsmRecoverySignal.TELECOM_CALLBACK_FAILURE,
                    feature = GsmFeature.PASSIVE_CALL_OBSERVATION,
                    reason = decision.reason,
                )
                recoveryManager.report(
                    signal = GsmRecoverySignal.TELECOM_CALLBACK_FAILURE,
                    feature = GsmFeature.PASSIVE_CALL_OBSERVATION,
                    reason = "${decision.reason}_confirm",
                )
            }
            SilentFallbackAction.NONE -> Unit
        }
        record(decision)
        return decision
    }

    private fun forceDisableOverlay(reason: String) {
        repeat(3) {
            recoveryManager.report(
                signal = GsmRecoverySignal.OVERLAY_RENDER_FAILURE,
                feature = GsmFeature.OVERLAY,
                reason = reason,
            )
        }
    }

    fun evaluateAndApply(
        feature: GsmFeature,
        reliability: TelecomReliabilityScoreReport,
        reason: String,
    ): SilentFallbackDecision {
        return apply(evaluate(feature, reliability, reason))
    }

    private fun record(decision: SilentFallbackDecision) {
        val attributes = mapOf(
            "action" to decision.action.name,
            "feature" to decision.feature.name,
            "reason" to decision.reason,
            "preserves_carrier_calling" to decision.preservesCarrierCalling.toString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.SILENT_FALLBACK_APPLIED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_2a_internal_telecom_pilot",
                attributes = attributes,
            ),
        )
        if (decision.action != SilentFallbackAction.NONE) {
            telemetrySink.track(
                GsmTelemetryEvent(
                    name = GsmTelemetryEventName.SILENT_FALLBACK_APPLIED,
                    attributes = attributes,
                ),
            )
        }
    }
}
