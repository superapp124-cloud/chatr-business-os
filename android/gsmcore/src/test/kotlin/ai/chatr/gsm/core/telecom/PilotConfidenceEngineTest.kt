package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PilotConfidenceEngineTest {
    @Test
    fun cleanOperationalWindowAllowsExpansion() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(event(TelecomRecordedEventType.OVERLAY_ATTACHED, duration = 90L))
        recorder.record(event(TelecomRecordedEventType.CLEANUP_SUCCEEDED))
        val engine = engine(recorder)

        val report = engine.evaluate("clean", windowMillis = 1_000L)

        assertEquals(PilotConfidenceLevel.READY, report.level)
        assertTrue(report.expansionAllowed)
        assertTrue(report.reasons.isEmpty())
        assertTrue(recorder.snapshot().any { it.type == TelecomRecordedEventType.PILOT_CONFIDENCE_REPORTED })
    }

    @Test
    fun callbackFailureForcesRollbackConfidence() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(event(TelecomRecordedEventType.CALLBACK_FAILURE))
        val engine = engine(recorder)

        val report = engine.evaluate("callback_failure", windowMillis = 1_000L)

        assertEquals(PilotConfidenceLevel.ROLLBACK, report.level)
        assertFalse(report.expansionAllowed)
        assertTrue(PilotConfidenceReason.CRASH_RISK in report.reasons)
    }

    private fun engine(recorder: TelecomEventRecorder): PilotConfidenceEngine {
        val incidentClassifier = TelecomIncidentClassifier(recorder, now = { 1_000L })
        val baseline = TelecomStabilityBaseline(
            recorder = recorder,
            incidentClassifier = incidentClassifier,
            now = { 1_000L },
        )
        val dashboard = TelecomOperationalDashboard(
            recorder = recorder,
            incidentClassifier = incidentClassifier,
            now = { 1_000L },
        )
        val trendAnalyzer = ReliabilityTrendAnalyzer(
            recorder = recorder,
            now = { 1_000L },
        )
        return PilotConfidenceEngine(
            recorder = recorder,
            stabilityBaseline = baseline,
            operationalDashboard = dashboard,
            trendAnalyzer = trendAnalyzer,
            now = { 1_000L },
        )
    }

    private fun event(
        type: TelecomRecordedEventType,
        duration: Long? = null,
    ): TelecomRecordedEvent {
        return TelecomRecordedEvent(
            type = type,
            sessionKey = null,
            timestampMillis = 500L,
            activationPath = "test",
            durationMillis = duration,
        )
    }
}
