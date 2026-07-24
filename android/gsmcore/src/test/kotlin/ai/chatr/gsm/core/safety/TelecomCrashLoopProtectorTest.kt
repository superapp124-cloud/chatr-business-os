package ai.chatr.gsm.core.safety

import ai.chatr.gsm.core.telecom.BoundedInMemoryTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TelecomCrashLoopProtectorTest {
    @Test
    fun repeatedOverlayAttachFailuresEnterSafeModeAndSuppressRestarts() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        val safeMode = GsmSafeMode(recorder = recorder, now = { 1_000L })
        val protector = TelecomCrashLoopProtector(
            safeMode = safeMode,
            recorder = recorder,
            now = { 1_000L },
        )

        protector.report(TelecomCrashLoopSignal.OVERLAY_ATTACH_FAILURE, "overlay_1")
        protector.report(TelecomCrashLoopSignal.OVERLAY_ATTACH_FAILURE, "overlay_2")
        val decision = protector.report(TelecomCrashLoopSignal.OVERLAY_ATTACH_FAILURE, "overlay_3")

        assertTrue(decision.loopDetected)
        assertEquals(TelecomCrashLoopAction.ENTER_SAFE_MODE, decision.action)
        assertTrue(safeMode.isActive())
        assertTrue(protector.isRestartSuppressed())
        assertTrue(recorder.snapshot().any { it.type == TelecomRecordedEventType.TELECOM_CRASH_LOOP_PROTECTED })
    }

    @Test
    fun activeCooldownSuppressesFurtherRestartAttempts() {
        val safeMode = GsmSafeMode(now = { 1_000L })
        val store = InMemoryTelecomCrashLoopStore()
        val protector = TelecomCrashLoopProtector(
            store = store,
            safeMode = safeMode,
            now = { 1_000L },
        )
        repeat(3) {
            protector.report(TelecomCrashLoopSignal.WATCHDOG_ESCALATION, "watchdog_$it")
        }

        val decision = protector.report(TelecomCrashLoopSignal.SERVICE_CRASH, "during_cooldown")

        assertEquals(TelecomCrashLoopAction.SUPPRESS_RESTARTS, decision.action)
        assertTrue(decision.loopDetected)
    }
}
