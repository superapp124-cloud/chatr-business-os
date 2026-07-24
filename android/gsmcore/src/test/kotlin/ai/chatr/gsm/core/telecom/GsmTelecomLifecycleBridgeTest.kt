package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertEquals
import org.junit.Test

class GsmTelecomLifecycleBridgeTest {
    @Test
    fun incomingRingingRemovedWithoutAnswerIsMissed() {
        val bridge = ThreadSafeGsmTelecomLifecycleBridge()
        val ringing = snapshot(GsmCallLifecycle.RINGING)

        bridge.onCallAdded(ringing)
        bridge.onCallRemoved(ringing.copy(lifecycle = GsmCallLifecycle.DISCONNECTED), disconnectCauseCode = null)

        val session = bridge.sessions.value.getValue(10)
        assertEquals(GsmCallLifecycle.DISCONNECTED, session.lifecycle)
        assertEquals(GsmCallEndReason.MISSED, session.endReason)
    }

    @Test
    fun activeCallRemovedIsEnded() {
        val bridge = ThreadSafeGsmTelecomLifecycleBridge()
        val ringing = snapshot(GsmCallLifecycle.RINGING)
        val active = ringing.copy(lifecycle = GsmCallLifecycle.ACTIVE, capturedAtMillis = 200)

        bridge.onCallAdded(ringing)
        bridge.onCallChanged(active)
        bridge.onCallRemoved(active.copy(lifecycle = GsmCallLifecycle.DISCONNECTED, capturedAtMillis = 300), null)

        val session = bridge.sessions.value.getValue(10)
        assertEquals(200L, session.answeredAtMillis)
        assertEquals(GsmCallEndReason.ENDED, session.endReason)
    }

    private fun snapshot(lifecycle: GsmCallLifecycle): GsmCallSnapshot {
        return GsmCallSnapshot(
            telecomCallHash = 10,
            phoneNumber = "+919999999999",
            direction = GsmCallDirection.INCOMING,
            lifecycle = lifecycle,
            phoneAccountId = "sim-1",
            simSlotIndex = 0,
            capturedAtMillis = 100,
        )
    }
}
