package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TelecomHealthMonitorTest {
    @Test
    fun repeatedOverlayFailuresMakeHealthUnhealthy() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        repeat(3) { index ->
            recorder.record(
                TelecomRecordedEvent(
                    type = TelecomRecordedEventType.OVERLAY_ATTACH_FAILED,
                    sessionKey = index,
                    timestampMillis = 100L + index,
                    activationPath = "test",
                    attributes = mapOf("reason" to "test"),
                ),
            )
        }
        val monitor = TelecomHealthMonitor(
            stateMachine = GsmSessionStateMachine(recorder = recorder),
            recorder = recorder,
            now = { 200L },
        )

        val report = monitor.evaluate("test")

        assertFalse(report.healthy)
        assertTrue(TelecomHealthViolation.OVERLAY_FAILURES in report.violations)
    }

    @Test
    fun overdueCleanupIsHealthViolation() {
        val machine = GsmSessionStateMachine(now = { 100L })
        machine.onSnapshot(snapshot(GsmCallLifecycle.ACTIVE, 100L))
        machine.onRemoved(snapshot(GsmCallLifecycle.DISCONNECTED, 150L))
        val monitor = TelecomHealthMonitor(
            stateMachine = machine,
            thresholds = TelecomHealthThresholds(cleanupOverdueMillis = 50L),
            now = { 300L },
        )

        val report = monitor.evaluate("test")

        assertFalse(report.healthy)
        assertTrue(TelecomHealthViolation.CLEANUP_OVERDUE in report.violations)
    }

    private fun snapshot(
        lifecycle: GsmCallLifecycle,
        capturedAtMillis: Long,
    ): GsmCallSnapshot {
        return GsmCallSnapshot(
            telecomCallHash = 77,
            phoneNumber = null,
            direction = GsmCallDirection.INCOMING,
            lifecycle = lifecycle,
            phoneAccountId = "sim-1",
            simSlotIndex = 0,
            capturedAtMillis = capturedAtMillis,
        )
    }
}
