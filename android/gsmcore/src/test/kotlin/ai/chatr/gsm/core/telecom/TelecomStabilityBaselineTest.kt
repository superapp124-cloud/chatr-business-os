package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TelecomStabilityBaselineTest {
    @Test
    fun cleanOperationalWindowIsAcceptable() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(event(TelecomRecordedEventType.OVERLAY_ATTACHED, duration = 90L))
        recorder.record(event(TelecomRecordedEventType.CLEANUP_SUCCEEDED))
        val baseline = TelecomStabilityBaseline(
            recorder = recorder,
            now = { 1_000L },
        )

        val report = baseline.evaluate("clean", windowMillis = 1_000L)

        assertTrue(report.acceptable)
        assertTrue(report.violations.isEmpty())
        assertEquals(100, report.overlaySuccessRate.percent.toInt())
        assertTrue(recorder.snapshot().any { it.type == TelecomRecordedEventType.STABILITY_BASELINE_EVALUATED })
    }

    @Test
    fun overlayLeaksAndSlowP95ViolateBaseline() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(event(TelecomRecordedEventType.OVERLAY_ATTACHED, duration = 90L))
        recorder.record(event(TelecomRecordedEventType.OVERLAY_ATTACHED, duration = 260L))
        recorder.record(event(TelecomRecordedEventType.OVERLAY_ATTACHED, duration = 270L))
        recorder.record(
            event(
                type = TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION,
                attributes = mapOf(
                    "action" to "FORCE_DETACH",
                    "reason" to "overlay_call_not_active",
                ),
            ),
        )
        val baseline = TelecomStabilityBaseline(
            recorder = recorder,
            now = { 1_000L },
        )

        val report = baseline.evaluate("overlay_risk", windowMillis = 1_000L)

        assertTrue(TelecomStabilityViolation.OVERLAY_LEAK_THRESHOLD in report.violations)
        assertTrue(TelecomStabilityViolation.OVERLAY_ATTACH_P95_THRESHOLD in report.violations)
        assertEquals(1, report.overlayLeakIncidents)
    }

    private fun event(
        type: TelecomRecordedEventType,
        attributes: Map<String, String> = emptyMap(),
        duration: Long? = null,
    ): TelecomRecordedEvent {
        return TelecomRecordedEvent(
            type = type,
            sessionKey = null,
            timestampMillis = 500L,
            activationPath = "test",
            attributes = attributes,
            durationMillis = duration,
        )
    }
}
