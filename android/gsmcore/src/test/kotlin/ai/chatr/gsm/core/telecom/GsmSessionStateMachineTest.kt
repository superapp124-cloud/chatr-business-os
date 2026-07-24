package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GsmSessionStateMachineTest {
    @Test
    fun activeCallRemovedRequiresCleanupThenCanBeConfirmed() {
        var time = 100L
        val recorder = BoundedInMemoryTelecomEventRecorder()
        val machine = GsmSessionStateMachine(
            recorder = recorder,
            now = { time },
        )

        machine.onSnapshot(snapshot(GsmCallLifecycle.RINGING, 100))
        machine.onSnapshot(snapshot(GsmCallLifecycle.ACTIVE, 160))
        val removed = machine.onRemoved(snapshot(GsmCallLifecycle.DISCONNECTED, 220))

        assertEquals(GsmSessionState.ACTIVE, removed.from)
        assertEquals(GsmSessionState.ENDED, removed.to)
        assertTrue(removed.cleanupRequired)

        time = 260
        machine.markCleanupComplete(
            telecomCallHash = 10,
            success = true,
            reason = "overlay_detached",
        )

        val session = machine.sessions.value.getValue(10)
        assertEquals(GsmSessionState.ENDED, session.state)
        assertFalse(session.cleanupRequired)
        assertEquals(260L, session.cleanupCompletedAtMillis)
        assertTrue(recorder.snapshot().any { it.type == TelecomRecordedEventType.CLEANUP_SUCCEEDED })
    }

    @Test
    fun terminalSessionIgnoresLateActiveCallback() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        val machine = GsmSessionStateMachine(recorder = recorder)

        machine.onSnapshot(snapshot(GsmCallLifecycle.RINGING, 100))
        machine.onRemoved(snapshot(GsmCallLifecycle.DISCONNECTED, 150))
        val late = machine.onSnapshot(snapshot(GsmCallLifecycle.ACTIVE, 180))

        assertFalse(late.accepted)
        assertEquals(GsmSessionState.ENDED, late.to)
        assertTrue(recorder.snapshot().any { it.type == TelecomRecordedEventType.CALLBACK_IGNORED })
    }

    private fun snapshot(
        lifecycle: GsmCallLifecycle,
        capturedAtMillis: Long,
    ): GsmCallSnapshot {
        return GsmCallSnapshot(
            telecomCallHash = 10,
            phoneNumber = "+919999999999",
            direction = GsmCallDirection.INCOMING,
            lifecycle = lifecycle,
            phoneAccountId = "sim-1",
            simSlotIndex = 0,
            capturedAtMillis = capturedAtMillis,
        )
    }
}
