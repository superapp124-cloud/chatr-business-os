package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TelecomOperationalDashboardTest {
    @Test
    fun dashboardAggregatesActivationOverlayAndCleanupMetrics() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(event(TelecomRecordedEventType.PILOT_ROLLOUT_DECISION, mapOf("allowed" to "true")))
        recorder.record(event(TelecomRecordedEventType.PILOT_ROLLOUT_DECISION, mapOf("allowed" to "false")))
        recorder.record(event(TelecomRecordedEventType.OVERLAY_ATTACHED, duration = 90L))
        recorder.record(event(TelecomRecordedEventType.OVERLAY_ATTACH_FAILED, mapOf("reason" to "oem_overlay_risky")))
        recorder.record(event(TelecomRecordedEventType.CLEANUP_FAILED))
        val dashboard = TelecomOperationalDashboard(
            recorder = recorder,
            now = { 200L },
        )

        val snapshot = dashboard.snapshot("test", windowMillis = 500L)

        assertEquals(1, snapshot.activationAllowedCount)
        assertEquals(1, snapshot.activationDeniedCount)
        assertEquals(1, snapshot.cleanupFailures)
        assertEquals(50, snapshot.overlaySuccessRate.percent.toInt())
        assertEquals(90L, snapshot.attachLatencyTrend.p95Millis)
    }

    @Test
    fun dashboardKeepsOemAggregationWithoutSessionDetails() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION,
                sessionKey = 123,
                timestampMillis = 100L,
                manufacturer = "Samsung",
                androidSdk = 35,
                activationPath = "test",
                attributes = mapOf(
                    "action" to "FORCE_DETACH",
                    "reason" to "overlay_call_not_active",
                    "phone_number" to "+911234567890",
                ),
            ),
        )
        val dashboard = TelecomOperationalDashboard(
            recorder = recorder,
            now = { 200L },
        )

        val snapshot = dashboard.snapshot("test", windowMillis = 500L)

        assertEquals("Samsung", snapshot.oemStability.first().manufacturer)
        assertTrue(snapshot.oemStability.first().incidentCount >= 1)
    }

    private fun event(
        type: TelecomRecordedEventType,
        attributes: Map<String, String> = emptyMap(),
        duration: Long? = null,
    ): TelecomRecordedEvent {
        return TelecomRecordedEvent(
            type = type,
            sessionKey = null,
            timestampMillis = 100L,
            activationPath = "test",
            attributes = attributes,
            durationMillis = duration,
        )
    }
}
