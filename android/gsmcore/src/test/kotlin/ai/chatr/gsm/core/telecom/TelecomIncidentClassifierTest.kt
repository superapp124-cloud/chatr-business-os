package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TelecomIncidentClassifierTest {
    @Test
    fun watchdogForceDetachForInactiveCallIsOverlayLeak() {
        val classifier = TelecomIncidentClassifier()

        val incident = classifier.classify(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION,
                sessionKey = 1,
                timestampMillis = 100L,
                manufacturer = "Google",
                androidSdk = 35,
                activationPath = "test",
                attributes = mapOf(
                    "action" to "FORCE_DETACH",
                    "reason" to "overlay_call_not_active",
                ),
            ),
        )

        assertEquals(TelecomIncidentType.OVERLAY_LEAK, incident?.type)
        assertEquals(TelecomIncidentSeverity.HIGH, incident?.severity)
    }

    @Test
    fun sessionOverlayMismatchIsLifecycleDesync() {
        val classifier = TelecomIncidentClassifier()

        val incident = classifier.classify(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.SESSION_CONSISTENCY_AUDIT,
                sessionKey = null,
                timestampMillis = 100L,
                activationPath = "test",
                attributes = mapOf(
                    "consistent" to "false",
                    "issues" to "SESSION_OVERLAY_MISMATCH",
                ),
            ),
        )

        assertEquals(TelecomIncidentType.LIFECYCLE_DESYNC, incident?.type)
    }

    @Test
    fun recentSummaryCountsIncidentTypes() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.TELECOM_HEALTH_REPORTED,
                sessionKey = null,
                timestampMillis = 100L,
                activationPath = "test",
                attributes = mapOf("violations" to "CALLBACK_STORM"),
            ),
        )
        val classifier = TelecomIncidentClassifier(
            recorder = recorder,
            now = { 200L },
        )

        val summary = classifier.classifyRecent("test", windowMillis = 500L)

        assertEquals(1, summary.totalCount)
        assertTrue(TelecomIncidentType.CALLBACK_DRIFT in summary.byType)
    }
}
