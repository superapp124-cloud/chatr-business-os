package ai.chatr.gsm.core.safety

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.telecom.BoundedInMemoryTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GsmSafeModeTest {
    @Test
    fun enteringSafeModeSuppressesEnhancementsButPreservesDiagnosticsIntent() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        val safeMode = GsmSafeMode(
            recorder = recorder,
            now = { 1_000L },
        )

        val state = safeMode.enter(
            trigger = GsmSafeModeTrigger.DEADMAN_SWITCH,
            reason = "watchdog_loop",
        )

        assertTrue(state.active)
        assertTrue(state.manualReenableRequired)
        assertTrue(safeMode.isFeatureSuppressed(GsmFeature.OVERLAY))
        assertTrue(safeMode.isFeatureSuppressed(GsmFeature.CALL_SCREENING))
        assertFalse(safeMode.isFeatureSuppressed(GsmFeature.PASSIVE_CALL_OBSERVATION))
        assertTrue(safeMode.canCollectPassiveDiagnostics())
        assertTrue(recorder.snapshot().any { it.type == TelecomRecordedEventType.GSM_SAFE_MODE_CHANGED })
    }

    @Test
    fun safeModeRequiresExplicitManualExit() {
        val safeMode = GsmSafeMode(now = { 1_000L })
        safeMode.enter(
            trigger = GsmSafeModeTrigger.CRASH_LOOP,
            reason = "loop",
        )

        val state = safeMode.exitManually("engineer_reenabled")

        assertFalse(state.active)
        assertFalse(safeMode.isActive())
        assertFalse(safeMode.isFeatureSuppressed(GsmFeature.OVERLAY))
    }
}
