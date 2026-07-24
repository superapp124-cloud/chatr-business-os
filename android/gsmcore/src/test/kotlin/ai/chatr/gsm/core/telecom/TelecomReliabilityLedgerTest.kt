package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TelecomReliabilityLedgerTest {
    @Test
    fun ledgerMaintainsRollingOemAndroidAndConfidenceHistory() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(confidence(score = 94, timestamp = 100L, manufacturer = "Samsung", androidSdk = 35))
        recorder.record(confidence(score = 82, timestamp = 800L, manufacturer = "Samsung", androidSdk = 35))
        recorder.record(
            event(
                type = TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION,
                timestamp = 850L,
                manufacturer = "Samsung",
                androidSdk = 35,
                attributes = mapOf("action" to "FORCE_DETACH"),
            ),
        )
        recorder.record(
            event(
                type = TelecomRecordedEventType.SILENT_ROLLBACK_ORCHESTRATED,
                timestamp = 900L,
                manufacturer = "Samsung",
                androidSdk = 35,
                attributes = mapOf("stage" to "OEM_TARGETED_ROLLBACK"),
            ),
        )
        val ledger = TelecomReliabilityLedger(
            recorder = recorder,
            now = { 1_000L },
        )

        val snapshot = ledger.snapshot("history", windowMillis = 1_000L)

        assertEquals(1, snapshot.rollbackFrequency)
        assertEquals(1, snapshot.watchdogEventCount)
        assertEquals(ReliabilityTrendDirection.DEGRADING, snapshot.confidenceTrend.direction)
        assertEquals("Samsung", snapshot.oemStability.first().key)
        assertEquals("35", snapshot.androidVersionStability.first().key)
        assertTrue(recorder.snapshot().any { it.type == TelecomRecordedEventType.TELECOM_RELIABILITY_LEDGER_UPDATED })
    }

    @Test
    fun ledgerIgnoresEventsOutsideRollingWindow() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(confidence(score = 60, timestamp = 100L))
        recorder.record(confidence(score = 98, timestamp = 950L))
        val ledger = TelecomReliabilityLedger(
            recorder = recorder,
            now = { 1_000L },
        )

        val snapshot = ledger.snapshot("window", windowMillis = 100L)

        assertEquals(1, snapshot.confidenceTrend.reportCount)
        assertEquals(98, snapshot.confidenceTrend.latestScore)
    }

    private fun confidence(
        score: Int,
        timestamp: Long,
        manufacturer: String = "Pixel",
        androidSdk: Int = 35,
    ): TelecomRecordedEvent {
        return event(
            type = TelecomRecordedEventType.PILOT_CONFIDENCE_REPORTED,
            timestamp = timestamp,
            manufacturer = manufacturer,
            androidSdk = androidSdk,
            attributes = mapOf("score" to score.toString()),
        )
    }

    private fun event(
        type: TelecomRecordedEventType,
        timestamp: Long,
        manufacturer: String = "Pixel",
        androidSdk: Int = 35,
        attributes: Map<String, String> = emptyMap(),
    ): TelecomRecordedEvent {
        return TelecomRecordedEvent(
            type = type,
            sessionKey = null,
            timestampMillis = timestamp,
            manufacturer = manufacturer,
            androidSdk = androidSdk,
            activationPath = "test",
            attributes = attributes,
        )
    }
}
