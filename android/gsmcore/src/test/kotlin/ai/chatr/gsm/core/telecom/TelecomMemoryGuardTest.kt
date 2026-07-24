package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TelecomMemoryGuardTest {
    @Test
    fun retainedCallbackIsReportedAsMemoryRisk() {
        var now = 100L
        val guard = TelecomMemoryGuard(
            stateMachine = GsmSessionStateMachine(now = { now }),
            thresholds = TelecomMemoryGuardThresholds(callbackRetentionMillis = 50L),
            now = { now },
        )
        guard.onCallbackRegistered(42)
        now = 200L

        val report = guard.evaluate("test")

        assertFalse(report.healthy)
        assertTrue(TelecomMemoryRisk.RETAINED_CALLBACKS in report.risks)
    }

    @Test
    fun clearedOverlayReferenceDoesNotLeak() {
        var now = 100L
        val guard = TelecomMemoryGuard(
            stateMachine = GsmSessionStateMachine(now = { now }),
            thresholds = TelecomMemoryGuardThresholds(overlayReferenceRetentionMillis = 50L),
            now = { now },
        )
        guard.onOverlayReferenceAttached("call-1")
        guard.onOverlayReferenceCleared("call-1")
        now = 200L

        val report = guard.evaluate("test")

        assertTrue(report.healthy)
    }

    @Test
    fun longLivedActiveSessionIsReported() {
        var now = 100L
        val machine = GsmSessionStateMachine(now = { now })
        machine.onSnapshot(
            GsmCallSnapshot(
                telecomCallHash = 7,
                phoneNumber = null,
                direction = GsmCallDirection.INCOMING,
                lifecycle = GsmCallLifecycle.ACTIVE,
                phoneAccountId = "sim-1",
                simSlotIndex = 0,
                capturedAtMillis = now,
            ),
        )
        now = 1_000L
        val guard = TelecomMemoryGuard(
            stateMachine = machine,
            thresholds = TelecomMemoryGuardThresholds(longLivedSessionMillis = 100L),
            now = { now },
        )

        val report = guard.evaluate("test")

        assertFalse(report.healthy)
        assertTrue(TelecomMemoryRisk.LONG_LIVED_SESSION in report.risks)
    }
}
