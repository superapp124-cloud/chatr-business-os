package ai.chatr.gsm.overlay

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.compat.TelecomCompatibilityProfile
import ai.chatr.gsm.core.compat.TelecomSupportLevel
import ai.chatr.gsm.core.safety.GsmRecoverySignal
import ai.chatr.gsm.core.safety.GsmSafetyRecoveryManager
import ai.chatr.gsm.core.telecom.NoOpTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEvent
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType

enum class OverlayLifecycleState {
    IDLE,
    SUPPRESSED,
    ATTACHING,
    ATTACHED,
    DETACHING,
    DETACHED,
    FAILED,
}

enum class OverlayLifecycleCommand {
    ATTACH,
    UPDATE,
    DETACH,
    SUPPRESS,
    NO_OP,
}

data class OverlayLifecycleDecision(
    val command: OverlayLifecycleCommand,
    val reason: String,
)

data class OverlayLifecycleSnapshot(
    val callId: String?,
    val state: OverlayLifecycleState,
    val requestedAtMillis: Long?,
    val attachedAtMillis: Long?,
    val detachedAtMillis: Long?,
    val lastReason: String?,
) {
    val isVisible: Boolean
        get() = state == OverlayLifecycleState.ATTACHING || state == OverlayLifecycleState.ATTACHED
}

class OverlayLifecycleCoordinator(
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val recoveryManager: GsmSafetyRecoveryManager = GsmSafetyRecoveryManager(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    private val lock = Any()
    private var snapshot = OverlayLifecycleSnapshot(
        callId = null,
        state = OverlayLifecycleState.IDLE,
        requestedAtMillis = null,
        attachedAtMillis = null,
        detachedAtMillis = null,
        lastReason = null,
    )

    fun current(): OverlayLifecycleSnapshot = synchronized(lock) { snapshot }

    fun onOverlayRequested(
        callId: String,
        telecomRingingAtMillis: Long?,
        compatibilityProfile: TelecomCompatibilityProfile,
        isDeviceLocked: Boolean,
        canDrawOverlay: Boolean,
    ): OverlayLifecycleDecision {
        synchronized(lock) {
            val timestamp = now()
            val suppressReason = suppressReason(
                compatibilityProfile = compatibilityProfile,
                isDeviceLocked = isDeviceLocked,
                canDrawOverlay = canDrawOverlay,
            )
            if (suppressReason != null) {
                snapshot = snapshot.copy(
                    callId = callId,
                    state = OverlayLifecycleState.SUPPRESSED,
                    requestedAtMillis = telecomRingingAtMillis ?: timestamp,
                    lastReason = suppressReason,
                )
                record(
                    type = TelecomRecordedEventType.OVERLAY_ATTACH_FAILED,
                    callId = callId,
                    timestampMillis = timestamp,
                    reason = suppressReason,
                    durationMillis = telecomRingingAtMillis?.let { timestamp - it },
                )
                return OverlayLifecycleDecision(
                    command = OverlayLifecycleCommand.SUPPRESS,
                    reason = suppressReason,
                )
            }

            if (snapshot.callId == callId && snapshot.state == OverlayLifecycleState.ATTACHED) {
                record(
                    type = TelecomRecordedEventType.OVERLAY_ATTACH_REQUESTED,
                    callId = callId,
                    timestampMillis = timestamp,
                    reason = "update_existing",
                    durationMillis = telecomRingingAtMillis?.let { timestamp - it },
                )
                return OverlayLifecycleDecision(
                    command = OverlayLifecycleCommand.UPDATE,
                    reason = "update_existing",
                )
            }

            snapshot = OverlayLifecycleSnapshot(
                callId = callId,
                state = OverlayLifecycleState.ATTACHING,
                requestedAtMillis = telecomRingingAtMillis ?: timestamp,
                attachedAtMillis = null,
                detachedAtMillis = null,
                lastReason = "attach_requested",
            )
            record(
                type = TelecomRecordedEventType.OVERLAY_ATTACH_REQUESTED,
                callId = callId,
                timestampMillis = timestamp,
                reason = "attach_requested",
                durationMillis = telecomRingingAtMillis?.let { timestamp - it },
            )
            return OverlayLifecycleDecision(
                command = OverlayLifecycleCommand.ATTACH,
                reason = "attach_requested",
            )
        }
    }

    fun onAttachSucceeded(callId: String): OverlayLifecycleSnapshot {
        synchronized(lock) {
            val timestamp = now()
            snapshot = snapshot.copy(
                callId = callId,
                state = OverlayLifecycleState.ATTACHED,
                attachedAtMillis = timestamp,
                lastReason = "attached",
            )
            record(
                type = TelecomRecordedEventType.OVERLAY_ATTACHED,
                callId = callId,
                timestampMillis = timestamp,
                reason = "attached",
                durationMillis = snapshot.requestedAtMillis?.let { timestamp - it },
            )
            return snapshot
        }
    }

    fun onAttachFailed(
        callId: String,
        reason: String,
    ): OverlayLifecycleSnapshot {
        synchronized(lock) {
            val timestamp = now()
            snapshot = snapshot.copy(
                callId = callId,
                state = OverlayLifecycleState.FAILED,
                lastReason = reason,
            )
            record(
                type = TelecomRecordedEventType.OVERLAY_ATTACH_FAILED,
                callId = callId,
                timestampMillis = timestamp,
                reason = reason,
                durationMillis = snapshot.requestedAtMillis?.let { timestamp - it },
            )
            recoveryManager.report(
                signal = GsmRecoverySignal.OVERLAY_RENDER_FAILURE,
                feature = GsmFeature.OVERLAY,
                reason = reason,
                sessionKey = callId.hashCode(),
            )
            return snapshot
        }
    }

    fun onDetachRequested(
        callId: String?,
        reason: String,
    ): OverlayLifecycleDecision {
        synchronized(lock) {
            if (!snapshot.isVisible && snapshot.state != OverlayLifecycleState.FAILED) {
                return OverlayLifecycleDecision(
                    command = OverlayLifecycleCommand.NO_OP,
                    reason = "not_attached",
                )
            }
            val timestamp = now()
            snapshot = snapshot.copy(
                callId = callId ?: snapshot.callId,
                state = OverlayLifecycleState.DETACHING,
                lastReason = reason,
            )
            record(
                type = TelecomRecordedEventType.OVERLAY_DETACH_REQUESTED,
                callId = callId ?: snapshot.callId.orEmpty(),
                timestampMillis = timestamp,
                reason = reason,
                durationMillis = snapshot.attachedAtMillis?.let { timestamp - it },
            )
            return OverlayLifecycleDecision(
                command = OverlayLifecycleCommand.DETACH,
                reason = reason,
            )
        }
    }

    fun onDetached(
        callId: String?,
        success: Boolean,
        reason: String,
    ): OverlayLifecycleSnapshot {
        synchronized(lock) {
            val timestamp = now()
            snapshot = snapshot.copy(
                callId = callId ?: snapshot.callId,
                state = if (success) OverlayLifecycleState.DETACHED else OverlayLifecycleState.FAILED,
                detachedAtMillis = timestamp.takeIf { success } ?: snapshot.detachedAtMillis,
                lastReason = reason,
            )
            record(
                type = if (success) {
                    TelecomRecordedEventType.OVERLAY_DETACHED
                } else {
                    TelecomRecordedEventType.OVERLAY_DETACH_FAILED
                },
                callId = callId ?: snapshot.callId.orEmpty(),
                timestampMillis = timestamp,
                reason = reason,
                durationMillis = snapshot.attachedAtMillis?.let { timestamp - it },
            )
            if (!success) {
                recoveryManager.report(
                    signal = GsmRecoverySignal.CLEANUP_FAILURE,
                    feature = GsmFeature.OVERLAY,
                    reason = reason,
                    sessionKey = callId?.hashCode(),
                )
            }
            return snapshot
        }
    }

    fun onOrientationChanged(callId: String?): OverlayLifecycleDecision {
        synchronized(lock) {
            if (snapshot.state != OverlayLifecycleState.ATTACHED) {
                return OverlayLifecycleDecision(OverlayLifecycleCommand.NO_OP, "not_attached")
            }
            record(
                type = TelecomRecordedEventType.OVERLAY_ATTACH_REQUESTED,
                callId = callId ?: snapshot.callId.orEmpty(),
                timestampMillis = now(),
                reason = "orientation_changed",
                durationMillis = null,
            )
            return OverlayLifecycleDecision(OverlayLifecycleCommand.UPDATE, "orientation_changed")
        }
    }

    private fun suppressReason(
        compatibilityProfile: TelecomCompatibilityProfile,
        isDeviceLocked: Boolean,
        canDrawOverlay: Boolean,
    ): String? {
        return when {
            !canDrawOverlay -> "permission_missing"
            compatibilityProfile.overlaySupport == TelecomSupportLevel.UNSUPPORTED -> "overlay_unsupported"
            compatibilityProfile.overlaySupport == TelecomSupportLevel.RISKY -> "oem_overlay_risky"
            isDeviceLocked && compatibilityProfile.shouldSuppressOverlayWhenLocked -> "lockscreen_suppressed"
            else -> null
        }
    }

    private fun record(
        type: TelecomRecordedEventType,
        callId: String,
        timestampMillis: Long,
        reason: String,
        durationMillis: Long?,
    ) {
        recorder.record(
            TelecomRecordedEvent(
                type = type,
                sessionKey = callId.takeIf { it.isNotBlank() }?.hashCode(),
                timestampMillis = timestampMillis,
                activationPath = "phase_1c_internal_validation",
                attributes = mapOf("reason" to reason),
                durationMillis = durationMillis,
            ),
        )
    }
}
