package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class TelecomEventRecorderTest {
    @Test
    fun recorderKeepsLifecycleMetadataButDropsSensitiveKeys() {
        val recorder = BoundedInMemoryTelecomEventRecorder()

        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.SESSION_TRANSITION,
                sessionKey = 42,
                timestampMillis = 100,
                activationPath = "phase_1c_internal_validation",
                attributes = mapOf(
                    "from" to "RINGING",
                    "to" to "ACTIVE",
                    "phone_number" to "+919999999999",
                    "transcript" to "private",
                ),
            ),
        )

        val event = recorder.snapshot().single()
        assertEquals("RINGING", event.attributes["from"])
        assertEquals("ACTIVE", event.attributes["to"])
        assertFalse("phone_number" in event.attributes)
        assertFalse("transcript" in event.attributes)
    }
}
