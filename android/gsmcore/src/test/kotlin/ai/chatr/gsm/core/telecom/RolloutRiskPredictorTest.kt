package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RolloutRiskPredictorTest {
    @Test
    fun stableHistoryPredictsLowRisk() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(event(TelecomRecordedEventType.OVERLAY_ATTACHED, timestamp = 200L, duration = 80L))
        recorder.record(event(TelecomRecordedEventType.CLEANUP_SUCCEEDED, timestamp = 300L))
        recorder.record(confidence(score = 96, timestamp = 800L))
        val predictor = predictor(recorder)

        val prediction = predictor.predict("stable", windowMillis = 1_000L)

        assertEquals(RolloutRiskLevel.LOW, prediction.riskLevel)
        assertEquals(RolloutRiskAction.CONTINUE, prediction.recommendedAction)
        assertTrue(prediction.affectedOems.isEmpty())
    }

    @Test
    fun lifecycleDriftAndOemClustersPredictHighRisk() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(health(timestamp = 700L, healthy = false, violations = "LIFECYCLE_DRIFT"))
        recorder.record(health(timestamp = 800L, healthy = false, violations = "CALLBACK_STORM"))
        repeat(2) {
            recorder.record(
                event(
                    type = TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION,
                    timestamp = 850L + it,
                    manufacturer = "Samsung",
                    attributes = mapOf(
                        "action" to "FORCE_DETACH",
                        "reason" to "overlay_call_not_active",
                    ),
                ),
            )
        }
        recorder.record(confidence(score = 92, timestamp = 100L, manufacturer = "Samsung"))
        recorder.record(confidence(score = 72, timestamp = 900L, manufacturer = "Samsung"))
        val predictor = predictor(recorder)

        val prediction = predictor.predict("risk", windowMillis = 1_000L)

        assertEquals(RolloutRiskLevel.CRITICAL, prediction.riskLevel)
        assertEquals(RolloutRiskAction.REQUEST_ROLLBACK, prediction.recommendedAction)
        assertTrue("Samsung" in prediction.affectedOems)
        assertTrue(prediction.lifecycleDegradationProbability > 0f)
    }

    private fun predictor(recorder: TelecomEventRecorder): RolloutRiskPredictor {
        val incidentClassifier = TelecomIncidentClassifier(recorder, now = { 1_000L })
        return RolloutRiskPredictor(
            trendAnalyzer = ReliabilityTrendAnalyzer(recorder = recorder, now = { 1_000L }),
            anomalyCorrelator = TelecomAnomalyCorrelator(
                recorder = recorder,
                incidentClassifier = incidentClassifier,
                now = { 1_000L },
            ),
            reliabilityLedger = TelecomReliabilityLedger(
                recorder = recorder,
                now = { 1_000L },
            ),
            recorder = recorder,
            now = { 1_000L },
        )
    }

    private fun confidence(
        score: Int,
        timestamp: Long,
        manufacturer: String = "Pixel",
    ): TelecomRecordedEvent {
        return event(
            type = TelecomRecordedEventType.PILOT_CONFIDENCE_REPORTED,
            timestamp = timestamp,
            manufacturer = manufacturer,
            attributes = mapOf(
                "score" to score.toString(),
                "level" to if (score < 55) "ROLLBACK" else "READY",
            ),
        )
    }

    private fun health(
        timestamp: Long,
        healthy: Boolean,
        violations: String,
    ): TelecomRecordedEvent {
        return event(
            type = TelecomRecordedEventType.TELECOM_HEALTH_REPORTED,
            timestamp = timestamp,
            attributes = mapOf(
                "healthy" to healthy.toString(),
                "violations" to violations,
            ),
        )
    }

    private fun event(
        type: TelecomRecordedEventType,
        timestamp: Long,
        manufacturer: String = "Pixel",
        androidSdk: Int = 35,
        attributes: Map<String, String> = emptyMap(),
        duration: Long? = null,
    ): TelecomRecordedEvent {
        return TelecomRecordedEvent(
            type = type,
            sessionKey = null,
            timestampMillis = timestamp,
            manufacturer = manufacturer,
            androidSdk = androidSdk,
            activationPath = "test",
            attributes = attributes,
            durationMillis = duration,
        )
    }
}
