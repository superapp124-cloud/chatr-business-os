package ai.chatr.gsm.core.telecom

import android.telecom.DisconnectCause
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map

enum class GsmCallEndReason {
    ENDED,
    MISSED,
    REJECTED,
    ERROR,
    UNKNOWN,
}

data class GsmTelecomSession(
    val telecomCallHash: Int,
    val phoneNumber: String?,
    val direction: GsmCallDirection,
    val lifecycle: GsmCallLifecycle,
    val phoneAccountId: String?,
    val simSlotIndex: Int?,
    val firstSeenAtMillis: Long,
    val lastUpdatedAtMillis: Long,
    val answeredAtMillis: Long?,
    val disconnectedAtMillis: Long?,
    val endReason: GsmCallEndReason?,
) {
    val isActive: Boolean
        get() = lifecycle == GsmCallLifecycle.ACTIVE || lifecycle == GsmCallLifecycle.HOLDING
}

interface GsmTelecomLifecycleBridge {
    val sessions: StateFlow<Map<Int, GsmTelecomSession>>
    fun activeSessions(): StateFlow<List<GsmTelecomSession>>
    fun onCallAdded(snapshot: GsmCallSnapshot)
    fun onCallChanged(snapshot: GsmCallSnapshot)
    fun onCallRemoved(snapshot: GsmCallSnapshot, disconnectCauseCode: Int?)
    fun clear()
}

class ThreadSafeGsmTelecomLifecycleBridge : GsmTelecomLifecycleBridge {
    private val lock = Any()
    private val _sessions = MutableStateFlow<Map<Int, GsmTelecomSession>>(emptyMap())
    override val sessions: StateFlow<Map<Int, GsmTelecomSession>> = _sessions

    override fun activeSessions(): StateFlow<List<GsmTelecomSession>> {
        return MutableDerivedStateFlow(_sessions) { sessions ->
            sessions.values.filter { session -> session.disconnectedAtMillis == null }
        }
    }

    override fun onCallAdded(snapshot: GsmCallSnapshot) {
        upsert(snapshot)
    }

    override fun onCallChanged(snapshot: GsmCallSnapshot) {
        upsert(snapshot)
    }

    override fun onCallRemoved(snapshot: GsmCallSnapshot, disconnectCauseCode: Int?) {
        synchronized(lock) {
            val existing = _sessions.value[snapshot.telecomCallHash]
            val session = (existing ?: snapshot.toSession()).copy(
                lifecycle = GsmCallLifecycle.DISCONNECTED,
                lastUpdatedAtMillis = snapshot.capturedAtMillis,
                disconnectedAtMillis = snapshot.capturedAtMillis,
                endReason = endReason(existing, disconnectCauseCode),
            )
            _sessions.value = _sessions.value + (session.telecomCallHash to session)
        }
    }

    override fun clear() {
        synchronized(lock) {
            _sessions.value = emptyMap()
        }
    }

    private fun upsert(snapshot: GsmCallSnapshot) {
        synchronized(lock) {
            val existing = _sessions.value[snapshot.telecomCallHash]
            val session = existing?.copy(
                phoneNumber = existing.phoneNumber ?: snapshot.phoneNumber,
                direction = snapshot.direction.takeUnless { it == GsmCallDirection.UNKNOWN } ?: existing.direction,
                lifecycle = snapshot.lifecycle,
                phoneAccountId = existing.phoneAccountId ?: snapshot.phoneAccountId,
                simSlotIndex = existing.simSlotIndex ?: snapshot.simSlotIndex,
                lastUpdatedAtMillis = snapshot.capturedAtMillis,
                answeredAtMillis = existing.answeredAtMillis ?: snapshot.capturedAtMillis.takeIf {
                    snapshot.lifecycle == GsmCallLifecycle.ACTIVE
                },
            ) ?: snapshot.toSession()

            _sessions.value = _sessions.value + (session.telecomCallHash to session)
        }
    }

    private fun GsmCallSnapshot.toSession(): GsmTelecomSession {
        return GsmTelecomSession(
            telecomCallHash = telecomCallHash,
            phoneNumber = phoneNumber,
            direction = direction,
            lifecycle = lifecycle,
            phoneAccountId = phoneAccountId,
            simSlotIndex = simSlotIndex,
            firstSeenAtMillis = capturedAtMillis,
            lastUpdatedAtMillis = capturedAtMillis,
            answeredAtMillis = capturedAtMillis.takeIf { lifecycle == GsmCallLifecycle.ACTIVE },
            disconnectedAtMillis = capturedAtMillis.takeIf { lifecycle == GsmCallLifecycle.DISCONNECTED },
            endReason = null,
        )
    }

    private fun endReason(
        existing: GsmTelecomSession?,
        disconnectCauseCode: Int?,
    ): GsmCallEndReason {
        return when (disconnectCauseCode) {
            DisconnectCause.REJECTED -> GsmCallEndReason.REJECTED
            DisconnectCause.ERROR -> GsmCallEndReason.ERROR
            DisconnectCause.MISSED -> GsmCallEndReason.MISSED
            else -> when {
                existing?.answeredAtMillis != null -> GsmCallEndReason.ENDED
                existing?.direction == GsmCallDirection.INCOMING -> GsmCallEndReason.MISSED
                else -> GsmCallEndReason.UNKNOWN
            }
        }
    }
}

private class MutableDerivedStateFlow<T, R>(
    private val source: StateFlow<T>,
    private val transform: (T) -> R,
) : StateFlow<R> {
    override val replayCache: List<R>
        get() = listOf(value)

    override val value: R
        get() = transformSource()

    private val transformSource = { transform(source.value) }

    override suspend fun collect(collector: kotlinx.coroutines.flow.FlowCollector<R>): Nothing {
        source.map(transform).collect(collector)
        error("StateFlow collection completed unexpectedly.")
    }
}
