package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReliabilityTrendAnalyzerTest {
    @Test
    fun increasingLifecycleDriftRecommendsRollback() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(healthEvent(timestamp = 100L, healthy = true, violations = ""))
        recorder.record(healthEvent(timestamp = 800L, healthy = false, violations = "LIFECYCLE_DRIFT"))
        recorder.record(healthEvent(timestamp = 850L, healthy = false, violations = "CALLBACK_STORM"))
        val analyzer = ReliabilityTrendAnalyzer(
            recorder = recorder,
            now = { 1_000L },
        )

        val report = analyzer.analyze("test", windowMillis = 1_000L)

        assertFalse(report.healthy)
        assertTrue(ReliabilityTrendSignal.LIFECYCLE_DRIFT_INCREASE in report.signals)
        assertTrue(report.recommendedRollback)
    }

    @Test
    fun stableCleanWindowHasNoSignals() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(healthEvent(timestamp = 100L, healthy = true, violations = ""))
        recorder.record(healthEvent(timestamp = 800L, healthy = true, violations = ""))
        val analyzer = ReliabilityTrendAnalyzer(
            recorder = recorder,
            now = { 1_000L },
        )

        val report = analyzer.analyze("test", windowMillis = 1_000L)

        assertTrue(report.healthy)
        assertTrue(report.signals.isEmpty())
    }

    @Test
    fun overlayP95IncreaseFlagsDegradation() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(overlayAttached(timestamp = 100L, duration = 80L))
        recorder.record(overlayAttached(timestamp = 800L, duration = 260L))
        val analyzer = ReliabilityTrendAnalyzer(
            recorder = recorder,
            now = { 1_000L },
        )

        val report = analyzer.analyze("test", windowMillis = 1_000L)

        assertTrue(ReliabilityTrendSignal.OVERLAY_DEGRADATION in report.signals)
    }

    private fun healthEvent(
        timestamp: Long,
        healthy: Boolean,
        violations: String,
    ): TelecomRecordedEvent {
        return TelecomRecordedEvent(
            type = TelecomRecordedEventType.TELECOM_HEALTH_REPORTED,
            sessionKey = null,
            timestampMillis = timestamp,
            activationPath = "test",
            attributes = mapOf(
                "healthy" to healthy.toString(),
                "violations" to violations,
            ),
        )
    }

    private fun overlayAttached(
        timestamp: Long,
        duration: Long,
    ): TelecomRecordedEvent {
        return TelecomRecordedEvent(
            type = TelecomRecordedEventType.OVERLAY_ATTACHED,
            sessionKey = null,
            timestampMillis = timestamp,
            activationPath = "test",
            durationMillis = duration,
        )
    }
}
