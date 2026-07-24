package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TelecomAnomalyCorrelatorTest {
    @Test
    fun correlatesSystemicOemOverlayLeaks() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        repeat(2) {
            recorder.record(
                event(
                    type = TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION,
                    manufacturer = "Samsung",
                    attributes = mapOf(
                        "action" to "FORCE_DETACH",
                        "reason" to "overlay_call_not_active",
                    ),
                ),
            )
        }
        val correlator = TelecomAnomalyCorrelator(
            recorder = recorder,
            now = { 1_000L },
        )

        val report = correlator.correlate("oem", windowMillis = 1_000L, minClusterSize = 2)

        assertTrue(report.hasSystemicAnomaly)
        assertTrue("Samsung" in report.affectedOems)
        assertTrue(
            report.clusters.any {
                it.dimension == TelecomAnomalyDimension.OEM_MODEL &&
                    it.incidentTypes.contains(TelecomIncidentType.OVERLAY_LEAK)
            },
        )
    }

    @Test
    fun correlatesBluetoothUnknownRouteIncidents() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        repeat(2) {
            recorder.record(
                event(
                    type = TelecomRecordedEventType.BLUETOOTH_STATE_REPORTED,
                    attributes = mapOf(
                        "route" to "UNKNOWN",
                        "audio_mode" to "3",
                    ),
                ),
            )
        }
        val correlator = TelecomAnomalyCorrelator(
            recorder = recorder,
            now = { 1_000L },
        )

        val report = correlator.correlate("bluetooth", windowMillis = 1_000L, minClusterSize = 2)

        assertEquals(setOf("UNKNOWN"), report.bluetoothStates)
        assertTrue(
            report.clusters.any {
                it.dimension == TelecomAnomalyDimension.BLUETOOTH_STATE &&
                    it.incidentTypes.contains(TelecomIncidentType.BLUETOOTH_INSTABILITY)
            },
        )
    }

    private fun event(
        type: TelecomRecordedEventType,
        manufacturer: String = "Pixel",
        androidSdk: Int = 35,
        attributes: Map<String, String> = emptyMap(),
    ): TelecomRecordedEvent {
        return TelecomRecordedEvent(
            type = type,
            sessionKey = null,
            timestampMillis = 500L,
            manufacturer = manufacturer,
            androidSdk = androidSdk,
            activationPath = "test",
            attributes = attributes,
        )
    }
}
