package ai.chatr.gsm.overlay

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.compat.OemTelecomBehaviorProfile
import ai.chatr.gsm.core.compat.OemTelecomBehaviorProfiles
import ai.chatr.gsm.core.safety.GsmRecoverySignal
import ai.chatr.gsm.core.safety.GsmSafetyRecoveryManager
import ai.chatr.gsm.core.telecom.NoOpTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEvent
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType

enum class OverlayWatchdogAction {
    NONE,
    REQUEST_DETACH,
    FORCE_DETACH,
    REPORT_STUCK_OVERLAY,
}

data class OverlayWatchdogDecision(
    val action: OverlayWatchdogAction,
    val reason: String,
    val callId: String?,
)

class OverlayWatchdog(
    private val oemProfile: OemTelecomBehaviorProfile = OemTelecomBehaviorProfiles.current(),
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val recoveryManager: GsmSafetyRecoveryManager = GsmSafetyRecoveryManager(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun evaluate(
        overlaySnapshot: OverlayLifecycleSnapshot,
        activeOverlayCallIds: Set<String>,
    ): OverlayWatchdogDecision {
        val timestamp = now()
        val decision = when {
            !overlaySnapshot.isVisible -> OverlayWatchdogDecision(
                action = OverlayWatchdogAction.NONE,
                reason = "overlay_not_visible",
                callId = overlaySnapshot.callId,
            )
            overlaySnapshot.callId != null && overlaySnapshot.callId !in activeOverlayCallIds -> OverlayWatchdogDecision(
                action = OverlayWatchdogAction.FORCE_DETACH,
                reason = "overlay_call_not_active",
                callId = overlaySnapshot.callId,
            )
            overlaySnapshot.state == OverlayLifecycleState.ATTACHING &&
                overlaySnapshot.requestedAtMillis != null &&
                timestamp - overlaySnapshot.requestedAtMillis > oemProfile.overlayAttachTimeoutMillis ->
                OverlayWatchdogDecision(
                    action = OverlayWatchdogAction.REPORT_STUCK_OVERLAY,
                    reason = "attach_timeout",
                    callId = overlaySnapshot.callId,
                )
            overlaySnapshot.state == OverlayLifecycleState.DETACHING &&
                overlaySnapshot.attachedAtMillis != null &&
                timestamp - overlaySnapshot.attachedAtMillis > oemProfile.overlayDetachTimeoutMillis ->
                OverlayWatchdogDecision(
                    action = OverlayWatchdogAction.FORCE_DETACH,
                    reason = "detach_timeout",
                    callId = overlaySnapshot.callId,
                )
            else -> OverlayWatchdogDecision(
                action = OverlayWatchdogAction.NONE,
                reason = "within_limits",
                callId = overlaySnapshot.callId,
            )
        }

        record(decision)
        if (decision.action == OverlayWatchdogAction.REPORT_STUCK_OVERLAY ||
            decision.action == OverlayWatchdogAction.FORCE_DETACH
        ) {
            recoveryManager.report(
                signal = GsmRecoverySignal.CLEANUP_FAILURE,
                feature = GsmFeature.OVERLAY,
                reason = decision.reason,
                sessionKey = decision.callId?.hashCode(),
            )
        }
        return decision
    }

    private fun record(decision: OverlayWatchdogDecision) {
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION,
                sessionKey = decision.callId?.hashCode(),
                timestampMillis = now(),
                activationPath = "phase_1d_internal_hardening",
                attributes = mapOf(
                    "action" to decision.action.name,
                    "reason" to decision.reason,
                    "oem" to oemProfile.manufacturerFamily,
                ),
            ),
        )
    }
}
