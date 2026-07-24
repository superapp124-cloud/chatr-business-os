package ai.chatr.gsm.core.telecom

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.telecom.TelecomManager
import androidx.core.content.ContextCompat
import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.safety.GsmRecoverySignal
import ai.chatr.gsm.core.safety.GsmSafetyRecoveryManager

enum class TelecomProcessRecoveryReason {
    APP_START,
    PROCESS_RECREATED,
    SERVICE_RECREATED,
    OVERLAY_SERVICE_RECREATED,
    APP_UPGRADED,
    DOGFOOD_DIAGNOSTIC,
}

enum class TelecomProcessRecoveryAction {
    NONE,
    WAIT_FOR_TELECOM_CALLBACKS,
    DETACH_ORPHAN_OVERLAY,
    END_STALE_SESSIONS,
    MARK_CLEANUP_COMPLETE,
    REPORT_TELECOM_MISMATCH,
}

data class AndroidTelecomState(
    val canValidate: Boolean,
    val isInCall: Boolean?,
    val source: String,
    val capturedAtMillis: Long,
)

interface AndroidTelecomStateProbe {
    fun currentState(): AndroidTelecomState
}

class AndroidTelecomManagerStateProbe(
    private val context: Context,
    private val now: () -> Long = System::currentTimeMillis,
) : AndroidTelecomStateProbe {
    override fun currentState(): AndroidTelecomState {
        val hasPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_PHONE_STATE,
        ) == PackageManager.PERMISSION_GRANTED
        if (!hasPermission) {
            return AndroidTelecomState(
                canValidate = false,
                isInCall = null,
                source = "missing_read_phone_state",
                capturedAtMillis = now(),
            )
        }

        val telecomManager = context.getSystemService(TelecomManager::class.java)
        val isInCall = runCatching {
            @Suppress("MissingPermission")
            telecomManager?.isInCall == true
        }.getOrNull()

        return AndroidTelecomState(
            canValidate = isInCall != null,
            isInCall = isInCall,
            source = "telecom_manager",
            capturedAtMillis = now(),
        )
    }
}

data class ProcessRecoveryOverlaySnapshot(
    val callId: String?,
    val isVisible: Boolean,
    val attachedAtMillis: Long?,
    val lastReason: String?,
)

data class TelecomProcessRecoveryDecision(
    val actions: Set<TelecomProcessRecoveryAction>,
    val activeSessionCount: Int,
    val staleSessionKeys: Set<Int>,
    val overlayCallId: String?,
    val androidTelecomState: AndroidTelecomState,
)

class TelecomProcessRecoveryCoordinator(
    private val stateMachine: GsmSessionStateMachine,
    private val telecomStateProbe: AndroidTelecomStateProbe,
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val recoveryManager: GsmSafetyRecoveryManager = GsmSafetyRecoveryManager(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun reconcile(
        reason: TelecomProcessRecoveryReason,
        overlaySnapshot: ProcessRecoveryOverlaySnapshot? = null,
    ): TelecomProcessRecoveryDecision {
        val telecomState = telecomStateProbe.currentState()
        val sessions = stateMachine.sessions.value.values
        val activeSessions = sessions.filterNot { it.isTerminal }
        val staleSessions = sessions.filter { session ->
            session.cleanupRequired || (session.isTerminal && session.cleanupCompletedAtMillis == null)
        }

        val actions = linkedSetOf<TelecomProcessRecoveryAction>()
        val endedByRecovery = mutableListOf<GsmSessionRuntimeState>()
        if (telecomState.canValidate && telecomState.isInCall == false && activeSessions.isNotEmpty()) {
            activeSessions.forEach { session ->
                endStaleSession(session)
                endedByRecovery += session
            }
            actions += TelecomProcessRecoveryAction.END_STALE_SESSIONS
        }
        if (telecomState.canValidate && telecomState.isInCall == true && activeSessions.isEmpty()) {
            actions += TelecomProcessRecoveryAction.WAIT_FOR_TELECOM_CALLBACKS
        }
        if (telecomState.canValidate &&
            telecomState.isInCall == false &&
            overlaySnapshot?.isVisible == true
        ) {
            actions += TelecomProcessRecoveryAction.DETACH_ORPHAN_OVERLAY
        }
        val sessionsNeedingCleanup = staleSessions + endedByRecovery.filter {
            overlaySnapshot?.isVisible != true
        }
        if (sessionsNeedingCleanup.isNotEmpty()) {
            actions += TelecomProcessRecoveryAction.MARK_CLEANUP_COMPLETE
            sessionsNeedingCleanup.forEach { session ->
                stateMachine.markCleanupComplete(
                    telecomCallHash = session.telecomCallHash,
                    success = true,
                    reason = "process_recovery_${reason.name.lowercase()}",
                )
            }
        }
        if (telecomState.canValidate &&
            telecomState.isInCall == true &&
            overlaySnapshot?.isVisible == true &&
            activeSessions.isEmpty()
        ) {
            actions += TelecomProcessRecoveryAction.REPORT_TELECOM_MISMATCH
        }

        val decision = TelecomProcessRecoveryDecision(
            actions = actions.ifEmpty { setOf(TelecomProcessRecoveryAction.NONE) },
            activeSessionCount = activeSessions.size,
            staleSessionKeys = sessionsNeedingCleanup.map { it.telecomCallHash }.toSet(),
            overlayCallId = overlaySnapshot?.callId,
            androidTelecomState = telecomState,
        )
        record(reason, decision)
        if (TelecomProcessRecoveryAction.REPORT_TELECOM_MISMATCH in decision.actions) {
            recoveryManager.report(
                signal = GsmRecoverySignal.TELECOM_CALLBACK_FAILURE,
                feature = GsmFeature.PASSIVE_CALL_OBSERVATION,
                reason = "process_recovery_mismatch",
            )
        }
        return decision
    }

    private fun endStaleSession(session: GsmSessionRuntimeState) {
        stateMachine.onRemoved(
            snapshot = GsmCallSnapshot(
                telecomCallHash = session.telecomCallHash,
                phoneNumber = null,
                direction = session.direction,
                lifecycle = GsmCallLifecycle.DISCONNECTED,
                phoneAccountId = session.phoneAccountId,
                simSlotIndex = session.simSlotIndex,
                capturedAtMillis = now(),
            ),
            failed = false,
        )
    }

    private fun record(
        reason: TelecomProcessRecoveryReason,
        decision: TelecomProcessRecoveryDecision,
    ) {
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.PROCESS_RECOVERY_RECONCILED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_1d_internal_hardening",
                attributes = mapOf(
                    "reason" to reason.name,
                    "actions" to decision.actions.joinToString { it.name },
                    "active_session_count" to decision.activeSessionCount.toString(),
                    "stale_session_count" to decision.staleSessionKeys.size.toString(),
                    "can_validate" to decision.androidTelecomState.canValidate.toString(),
                    "is_in_call" to decision.androidTelecomState.isInCall.toString(),
                    "source" to decision.androidTelecomState.source,
                ),
            ),
        )
    }
}
