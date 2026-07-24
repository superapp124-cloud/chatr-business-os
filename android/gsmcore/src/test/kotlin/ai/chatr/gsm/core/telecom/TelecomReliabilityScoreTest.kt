package ai.chatr.gsm.core.telecom

import ai.chatr.gsm.core.compat.OemTelecomBehaviorProfiles
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TelecomReliabilityScoreTest {
    @Test
    fun cleanRecorderProducesStableScore() {
        val scorer = scorer(BoundedInMemoryTelecomEventRecorder())

        val report = scorer.calculate("test")

        assertTrue(report.score >= 90)
        assertFalse(report.shouldAutoDisable)
    }

    @Test
    fun cleanupFailureForcesAutoDisableConcern() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.CLEANUP_FAILED,
                sessionKey = 1,
                timestampMillis = 100L,
                activationPath = "test",
                attributes = mapOf("reason" to "unit"),
            ),
        )

        val report = scorer(recorder).calculate("test")

        assertTrue(report.shouldAutoDisable)
        assertTrue(TelecomReliabilityConcern.CLEANUP_FAILURES in report.concerns)
    }

    @Test
    fun watchdogInterventionReducesReliability() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION,
                sessionKey = 1,
                timestampMillis = 100L,
                activationPath = "test",
                attributes = mapOf("action" to "FORCE_DETACH"),
            ),
        )

        val report = scorer(recorder).calculate("test")

        assertTrue(TelecomReliabilityConcern.WATCHDOG_INTERVENTIONS in report.concerns)
        assertTrue(report.score < 100)
    }

    private fun scorer(recorder: TelecomEventRecorder): TelecomReliabilityScore {
        val machine = GsmSessionStateMachine(recorder = recorder)
        val healthMonitor = TelecomHealthMonitor(
            stateMachine = machine,
            recorder = recorder,
        )
        val memoryGuard = TelecomMemoryGuard(
            stateMachine = machine,
            recorder = recorder,
        )
        return TelecomReliabilityScore(
            recorder = recorder,
            healthMonitor = healthMonitor,
            memoryGuard = memoryGuard,
            overlayLatencyProfiler = OverlayLatencyProfiler(recorder = recorder),
            oemProfileProvider = { OemTelecomBehaviorProfiles.forManufacturer("Google") },
        )
    }
}
