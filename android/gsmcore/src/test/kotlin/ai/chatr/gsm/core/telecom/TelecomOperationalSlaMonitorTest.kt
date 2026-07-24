package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TelecomOperationalSlaMonitorTest {
    @Test
    fun cleanOperationalWindowPassesSla() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(event(TelecomRecordedEventType.OVERLAY_ATTACHED, duration = 90L))
        recorder.record(event(TelecomRecordedEventType.CLEANUP_SUCCEEDED))
        val monitor = monitor(recorder)

        val report = monitor.monitor("clean", windowMillis = 1_000L)

        assertEquals(TelecomOperationalSlaStatus.PASS, report.status)
        assertEquals(TelecomOperationalSlaEnforcement.NONE, report.enforcement)
        assertTrue(report.breaches.isEmpty())
        assertTrue(recorder.snapshot().any { it.type == TelecomRecordedEventType.TELECOM_OPERATIONAL_SLA_MONITORED })
    }

    @Test
    fun slowAttachLatencyPausesOverlayExpansion() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(event(TelecomRecordedEventType.OVERLAY_ATTACHED, duration = 220L))
        recorder.record(event(TelecomRecordedEventType.CLEANUP_SUCCEEDED))
        val monitor = monitor(recorder)

        val report = monitor.monitor("slow_overlay", windowMillis = 1_000L)

        assertEquals(TelecomOperationalSlaStatus.WATCH, report.status)
        assertEquals(TelecomOperationalSlaEnforcement.PAUSE_OVERLAY_EXPANSION, report.enforcement)
        assertTrue(TelecomOperationalSlaBreach.ATTACH_LATENCY in report.breaches)
    }

    private fun monitor(recorder: TelecomEventRecorder): TelecomOperationalSlaMonitor {
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
        val confidenceEngine = PilotConfidenceEngine(
            recorder = recorder,
            stabilityBaseline = baseline,
            operationalDashboard = dashboard,
            trendAnalyzer = trendAnalyzer,
            now = { 1_000L },
        )
        return TelecomOperationalSlaMonitor(
            stabilityBaseline = baseline,
            confidenceEngine = confidenceEngine,
            recorder = recorder,
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
