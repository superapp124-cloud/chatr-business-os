package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OverlayLatencyProfilerTest {
    @Test
    fun profilerComputesAttachLatencyPercentiles() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        listOf(70L, 90L, 120L, 180L).forEach { latency ->
            recorder.record(
                TelecomRecordedEvent(
                    type = TelecomRecordedEventType.OVERLAY_ATTACHED,
                    sessionKey = latency.toInt(),
                    timestampMillis = 1_000L + latency,
                    activationPath = "test",
                    durationMillis = latency,
                ),
            )
        }
        val profiler = OverlayLatencyProfiler(
            recorder = recorder,
            targetAttachMillis = 150L,
        )

        val profile = profiler.profile("test")

        assertEquals(4, profile.attach.sampleCount)
        assertEquals(90L, profile.attach.p50Millis)
        assertEquals(120L, profile.attach.p95Millis)
        assertTrue(profile.attach.withinTarget)
    }

    @Test
    fun profilerFlagsSlowAttachP95() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        listOf(120L, 170L, 220L).forEach { latency ->
            recorder.record(
                TelecomRecordedEvent(
                    type = TelecomRecordedEventType.OVERLAY_ATTACHED,
                    sessionKey = latency.toInt(),
                    timestampMillis = 1_000L + latency,
                    activationPath = "test",
                    durationMillis = latency,
                ),
            )
        }
        val profiler = OverlayLatencyProfiler(
            recorder = recorder,
            targetAttachMillis = 150L,
        )

        val profile = profiler.profile("test")

        assertFalse(profile.attach.withinTarget)
    }
}
