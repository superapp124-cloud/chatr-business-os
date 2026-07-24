package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PilotDiagnosticsExporterTest {
    @Test
    fun exporterRedactsPersonalCallAttributes() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.SESSION_TRANSITION,
                sessionKey = 99,
                timestampMillis = 100L,
                activationPath = "test",
                attributes = mapOf(
                    "from" to "RINGING",
                    "to" to "ACTIVE",
                    "phone_number" to "+911234567890",
                    "contact_name" to "Private",
                ),
            ),
        )
        val exporter = PilotDiagnosticsExporter(recorder = recorder, now = { 200L })

        val export = exporter.export("unit")

        assertEquals(1, export.lifecycleEvents.size)
        assertTrue(export.lifecycleEvents.first().hasSession)
        assertFalse(export.lifecycleEvents.first().attributes.containsKey("phone_number"))
        assertFalse(export.lifecycleEvents.first().attributes.containsKey("contact_name"))
    }

    @Test
    fun exporterBuildsOverlayTimingHistogram() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        listOf(80L, 130L, 180L, 300L).forEach { duration ->
            recorder.record(
                TelecomRecordedEvent(
                    type = TelecomRecordedEventType.OVERLAY_ATTACHED,
                    sessionKey = duration.toInt(),
                    timestampMillis = 100L + duration,
                    activationPath = "test",
                    durationMillis = duration,
                ),
            )
        }
        val exporter = PilotDiagnosticsExporter(recorder = recorder)

        val export = exporter.export("unit")

        assertEquals(4, export.overlayAttachHistogram.sampleCount)
        assertEquals(1, export.overlayAttachHistogram.under100Millis)
        assertEquals(1, export.overlayAttachHistogram.under150Millis)
        assertEquals(1, export.overlayAttachHistogram.under250Millis)
        assertEquals(1, export.overlayAttachHistogram.over250Millis)
    }
}
