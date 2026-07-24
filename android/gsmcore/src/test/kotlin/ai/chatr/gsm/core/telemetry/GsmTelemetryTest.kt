package ai.chatr.gsm.core.telemetry

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class GsmTelemetryTest {
    @Test
    fun telemetrySinkDropsSensitiveContentKeys() {
        val sink = InMemoryGsmTelemetrySink()

        sink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.OVERLAY_RENDER_FAILURE,
                attributes = mapOf(
                    "reason" to "permission_missing",
                    "phone_number" to "+919999999999",
                    "transcript" to "private words",
                    "caller_name" to "Private Contact",
                ),
            ),
        )

        val attributes = sink.events.single().attributes
        assertEquals("permission_missing", attributes["reason"])
        assertFalse("phone_number" in attributes)
        assertFalse("transcript" in attributes)
        assertFalse("caller_name" in attributes)
    }
}
