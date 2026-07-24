package ai.chatr.gsm.core.telecom

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

enum class GsmSessionState {
    IDLE,
    RINGING,
    DIALING,
    ACTIVE,
    HOLDING,
    DISCONNECTING,
    ENDED,
    FAILED,
}

enum class GsmSessionTransitionReason {
    SNAPSHOT,
    REMOVED,
    CALLBACK_FAILURE,
    CLEANUP_CONFIRMED,
    RESET,
}

data class GsmSessionRuntimeState(
    val telecomCallHash: Int,
    val state: GsmSessionState,
    val direction: GsmCallDirection,
    val phoneAccountId: String?,
    val simSlotIndex: Int?,
    val firstSeenAtMillis: Long,
    val lastTransitionAtMillis: Long,
    val ringingAtMillis: Long?,
    val activeAtMillis: Long?,
    val disconnectingAtMillis: Long?,
    val endedAtMillis: Long?,
    val cleanupRequired: Boolean,
    val cleanupCompletedAtMillis: Long?,
    val lastReason: GsmSessionTransitionReason,
) {
    val isTerminal: Boolean
        get() = state == GsmSessionState.ENDED || state == GsmSessionState.FAILED
}

data class GsmSessionTransition(
    val telecomCallHash: Int,
    val from: GsmSessionState,
    val to: GsmSessionState,
    val accepted: Boolean,
    val reason: GsmSessionTransitionReason,
    val cleanupRequired: Boolean,
    val timestampMillis: Long,
)

class GsmSessionStateMachine(
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val now: () -> Long = System::currentTimeMillis,
) {
    private val lock = Any()
    private val _sessions = MutableStateFlow<Map<Int, GsmSessionRuntimeState>>(emptyMap())
    val sessions: StateFlow<Map<Int, GsmSessionRuntimeState>> = _sessions

    fun onSnapshot(snapshot: GsmCallSnapshot): GsmSessionTransition {
        val target = snapshot.lifecycle.toSessionState()
        return transition(
            telecomCallHash = snapshot.telecomCallHash,
            target = target,
            timestampMillis = snapshot.capturedAtMillis,
            reason = GsmSessionTransitionReason.SNAPSHOT,
            snapshot = snapshot,
        )
    }

    fun onRemoved(
        snapshot: GsmCallSnapshot,
        failed: Boolean = false,
    ): GsmSessionTransition {
        return transition(
            telecomCallHash = snapshot.telecomCallHash,
            target = if (failed) GsmSessionState.FAILED else GsmSessionState.ENDED,
            timestampMillis = snapshot.capturedAtMillis,
            reason = GsmSessionTransitionReason.REMOVED,
            snapshot = snapshot,
        )
    }

    fun onCallbackFailure(
        telecomCallHash: Int,
        failureReason: String,
    ): GsmSessionTransition {
        val timestamp = now()
        return transition(
            telecomCallHash = telecomCallHash,
            target = GsmSessionState.FAILED,
            timestampMillis = timestamp,
            reason = GsmSessionTransitionReason.CALLBACK_FAILURE,
            attributes = mapOf("reason" to failureReason),
        )
    }

    fun markCleanupComplete(
        telecomCallHash: Int,
        success: Boolean,
        reason: String,
    ): GsmSessionTransition? {
        synchronized(lock) {
            val existing = _sessions.value[telecomCallHash] ?: return null
            val timestamp = now()
            val updated = existing.copy(
                cleanupRequired = !success,
                cleanupCompletedAtMillis = timestamp.takeIf { success } ?: existing.cleanupCompletedAtMillis,
                lastTransitionAtMillis = timestamp,
                lastReason = GsmSessionTransitionReason.CLEANUP_CONFIRMED,
            )
            _sessions.value = _sessions.value + (telecomCallHash to updated)
            recorder.record(
                TelecomRecordedEvent(
                    type = if (success) {
                        TelecomRecordedEventType.CLEANUP_SUCCEEDED
                    } else {
                        TelecomRecordedEventType.CLEANUP_FAILED
                    },
                    sessionKey = telecomCallHash,
                    timestampMillis = timestamp,
                    activationPath = "phase_1c_internal_validation",
                    attributes = mapOf("reason" to reason),
                    durationMillis = existing.endedAtMillis?.let { timestamp - it },
                ),
            )
            return GsmSessionTransition(
                telecomCallHash = telecomCallHash,
                from = existing.state,
                to = updated.state,
                accepted = true,
                reason = GsmSessionTransitionReason.CLEANUP_CONFIRMED,
                cleanupRequired = updated.cleanupRequired,
                timestampMillis = timestamp,
            )
        }
    }

    fun reset() {
        synchronized(lock) {
            _sessions.value.values.forEach { session ->
                recorder.record(
                    TelecomRecordedEvent(
                        type = TelecomRecordedEventType.SESSION_TRANSITION,
                        sessionKey = session.telecomCallHash,
                        timestampMillis = now(),
                        activationPath = "phase_1c_internal_validation",
                        attributes = mapOf(
                            "from" to session.state.name,
                            "to" to GsmSessionState.IDLE.name,
                            "reason" to GsmSessionTransitionReason.RESET.name,
                            "accepted" to true.toString(),
                        ),
                    ),
                )
            }
            _sessions.value = emptyMap()
        }
    }

    private fun transition(
        telecomCallHash: Int,
        target: GsmSessionState,
        timestampMillis: Long,
        reason: GsmSessionTransitionReason,
        snapshot: GsmCallSnapshot? = null,
        attributes: Map<String, String> = emptyMap(),
    ): GsmSessionTransition {
        synchronized(lock) {
            val existing = _sessions.value[telecomCallHash]
            val current = existing?.state ?: GsmSessionState.IDLE
            val accepted = current.canMoveTo(target)
            val next = if (accepted) target else current
            val runtime = (existing ?: GsmSessionRuntimeState(
                telecomCallHash = telecomCallHash,
                state = GsmSessionState.IDLE,
                direction = snapshot?.direction ?: GsmCallDirection.UNKNOWN,
                phoneAccountId = snapshot?.phoneAccountId,
                simSlotIndex = snapshot?.simSlotIndex,
                firstSeenAtMillis = timestampMillis,
                lastTransitionAtMillis = timestampMillis,
                ringingAtMillis = null,
                activeAtMillis = null,
                disconnectingAtMillis = null,
                endedAtMillis = null,
                cleanupRequired = false,
                cleanupCompletedAtMillis = null,
                lastReason = reason,
            )).copy(
                state = next,
                direction = snapshot?.direction?.takeUnless { it == GsmCallDirection.UNKNOWN }
                    ?: existing?.direction
                    ?: GsmCallDirection.UNKNOWN,
                phoneAccountId = existing?.phoneAccountId ?: snapshot?.phoneAccountId,
                simSlotIndex = existing?.simSlotIndex ?: snapshot?.simSlotIndex,
                lastTransitionAtMillis = timestampMillis,
                ringingAtMillis = existing?.ringingAtMillis ?: timestampMillis.takeIf {
                    next == GsmSessionState.RINGING
                },
                activeAtMillis = existing?.activeAtMillis ?: timestampMillis.takeIf {
                    next == GsmSessionState.ACTIVE
                },
                disconnectingAtMillis = existing?.disconnectingAtMillis ?: timestampMillis.takeIf {
                    next == GsmSessionState.DISCONNECTING
                },
                endedAtMillis = existing?.endedAtMillis ?: timestampMillis.takeIf {
                    next == GsmSessionState.ENDED || next == GsmSessionState.FAILED
                },
                cleanupRequired = next == GsmSessionState.DISCONNECTING ||
                    next == GsmSessionState.ENDED ||
                    next == GsmSessionState.FAILED ||
                    existing?.cleanupRequired == true,
                lastReason = reason,
            )

            _sessions.value = _sessions.value + (telecomCallHash to runtime)
            recordTransition(
                telecomCallHash = telecomCallHash,
                from = current,
                to = next,
                accepted = accepted,
                reason = reason,
                timestampMillis = timestampMillis,
                attributes = attributes,
            )

            return GsmSessionTransition(
                telecomCallHash = telecomCallHash,
                from = current,
                to = next,
                accepted = accepted,
                reason = reason,
                cleanupRequired = runtime.cleanupRequired,
                timestampMillis = timestampMillis,
            )
        }
    }

    private fun recordTransition(
        telecomCallHash: Int,
        from: GsmSessionState,
        to: GsmSessionState,
        accepted: Boolean,
        reason: GsmSessionTransitionReason,
        timestampMillis: Long,
        attributes: Map<String, String>,
    ) {
        recorder.record(
            TelecomRecordedEvent(
                type = if (accepted) {
                    TelecomRecordedEventType.SESSION_TRANSITION
                } else {
                    TelecomRecordedEventType.CALLBACK_IGNORED
                },
                sessionKey = telecomCallHash,
                timestampMillis = timestampMillis,
                activationPath = "phase_1c_internal_validation",
                attributes = attributes + mapOf(
                    "from" to from.name,
                    "to" to to.name,
                    "reason" to reason.name,
                    "accepted" to accepted.toString(),
                ),
            ),
        )
    }

    private fun GsmCallLifecycle.toSessionState(): GsmSessionState {
        return when (this) {
            GsmCallLifecycle.RINGING -> GsmSessionState.RINGING
            GsmCallLifecycle.DIALING -> GsmSessionState.DIALING
            GsmCallLifecycle.ACTIVE -> GsmSessionState.ACTIVE
            GsmCallLifecycle.HOLDING -> GsmSessionState.HOLDING
            GsmCallLifecycle.DISCONNECTING -> GsmSessionState.DISCONNECTING
            GsmCallLifecycle.DISCONNECTED -> GsmSessionState.ENDED
            GsmCallLifecycle.UNKNOWN -> GsmSessionState.IDLE
        }
    }

    private fun GsmSessionState.canMoveTo(target: GsmSessionState): Boolean {
        if (this == target) return true
        return when (this) {
            GsmSessionState.IDLE -> true
            GsmSessionState.RINGING -> target in setOf(
                GsmSessionState.ACTIVE,
                GsmSessionState.DISCONNECTING,
                GsmSessionState.ENDED,
                GsmSessionState.FAILED,
            )
            GsmSessionState.DIALING -> target in setOf(
                GsmSessionState.ACTIVE,
                GsmSessionState.DISCONNECTING,
                GsmSessionState.ENDED,
                GsmSessionState.FAILED,
            )
            GsmSessionState.ACTIVE -> target in setOf(
                GsmSessionState.HOLDING,
                GsmSessionState.DISCONNECTING,
                GsmSessionState.ENDED,
                GsmSessionState.FAILED,
            )
            GsmSessionState.HOLDING -> target in setOf(
                GsmSessionState.ACTIVE,
                GsmSessionState.DISCONNECTING,
                GsmSessionState.ENDED,
                GsmSessionState.FAILED,
            )
            GsmSessionState.DISCONNECTING -> target in setOf(
                GsmSessionState.ENDED,
                GsmSessionState.FAILED,
            )
            GsmSessionState.ENDED,
            GsmSessionState.FAILED -> false
        }
    }
}
