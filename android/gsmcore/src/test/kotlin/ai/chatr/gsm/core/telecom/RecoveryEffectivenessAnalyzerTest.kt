package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RecoveryEffectivenessAnalyzerTest {
    @Test
    fun fallbackAndWatchdogCleanupSuccessAreEffective() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(
            event(
                type = TelecomRecordedEventType.SILENT_FALLBACK_APPLIED,
                timestamp = 100L,
                attributes = mapOf("action" to "DISABLE_OVERLAY"),
            ),
        )
        recorder.record(
            event(
                type = TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION,
                timestamp = 120L,
                sessionKey = 7,
                attributes = mapOf("action" to "FORCE_DETACH"),
            ),
        )
        recorder.record(event(TelecomRecordedEventType.OVERLAY_DETACHED, timestamp = 150L, sessionKey = 7))
        recorder.record(event(TelecomRecordedEventType.CLEANUP_SUCCEEDED, timestamp = 160L))
        val analyzer = RecoveryEffectivenessAnalyzer(
            recorder = recorder,
            now = { 1_000L },
        )

        val report = analyzer.analyze("success", windowMillis = 1_000L)

        assertTrue(report.containmentEffective)
        assertFalse(report.recommendedEscalation)
        assertEquals(100, report.fallbackSuccessRate.percent.toInt())
        assertEquals(100, report.watchdogRecoveryRate.percent.toInt())
        assertTrue(recorder.snapshot().any { it.type == TelecomRecordedEventType.RECOVERY_EFFECTIVENESS_ANALYZED })
    }

    @Test
    fun repeatedFailedRecoveryRecommendsEscalation() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(
            event(
                type = TelecomRecordedEventType.SILENT_FALLBACK_APPLIED,
                timestamp = 100L,
                attributes = mapOf("action" to "DISABLE_OVERLAY"),
            ),
        )
        recorder.record(
            event(
                type = TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION,
                timestamp = 200L,
                attributes = mapOf("action" to "FORCE_DETACH"),
            ),
        )
        recorder.record(
            event(
                type = TelecomRecordedEventType.SILENT_ROLLBACK_ORCHESTRATED,
                timestamp = 300L,
                attributes = mapOf("stage" to "EMERGENCY_TELECOM_DISABLE"),
            ),
        )
        recorder.record(event(TelecomRecordedEventType.CALLBACK_FAILURE, timestamp = 320L))
        val analyzer = RecoveryEffectivenessAnalyzer(
            recorder = recorder,
            now = { 1_000L },
        )

        val report = analyzer.analyze("failure", windowMillis = 1_000L)

        assertFalse(report.containmentEffective)
        assertTrue(report.recommendedEscalation)
        assertTrue(report.failedRecoveryCount >= 2)
    }

    private fun event(
        type: TelecomRecordedEventType,
        timestamp: Long,
        sessionKey: Int? = null,
        attributes: Map<String, String> = emptyMap(),
    ): TelecomRecordedEvent {
        return TelecomRecordedEvent(
            type = type,
            sessionKey = sessionKey,
            timestampMillis = timestamp,
            activationPath = "test",
            attributes = attributes,
        )
    }
}
