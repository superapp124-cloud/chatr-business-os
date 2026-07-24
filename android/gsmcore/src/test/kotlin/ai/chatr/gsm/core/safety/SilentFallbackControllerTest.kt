package ai.chatr.gsm.core.safety

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.telecom.BoundedInMemoryTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import ai.chatr.gsm.core.telecom.TelecomReliabilityComponents
import ai.chatr.gsm.core.telecom.TelecomReliabilityConcern
import ai.chatr.gsm.core.telecom.TelecomReliabilityGrade
import ai.chatr.gsm.core.telecom.TelecomReliabilityScoreReport
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SilentFallbackControllerTest {
    @Test
    fun slowOverlayFallsBackByDisablingOverlayFirst() {
        val recoveryManager = GsmSafetyRecoveryManager()
        val controller = SilentFallbackController(recoveryManager = recoveryManager)

        val decision = controller.evaluateAndApply(
            feature = GsmFeature.OVERLAY,
            reliability = reliability(
                grade = TelecomReliabilityGrade.UNSTABLE,
                concerns = setOf(TelecomReliabilityConcern.SLOW_OVERLAY_ATTACH),
            ),
            reason = "slow_overlay",
        )

        assertEquals(SilentFallbackAction.DISABLE_OVERLAY, decision.action)
        assertTrue(recoveryManager.isFeatureAutoDisabled(GsmFeature.OVERLAY))
        assertTrue(decision.preservesCarrierCalling)
    }

    @Test
    fun criticalReliabilityDisablesGsmLayer() {
        val recoveryManager = GsmSafetyRecoveryManager()
        val controller = SilentFallbackController(recoveryManager = recoveryManager)

        val decision = controller.evaluateAndApply(
            feature = GsmFeature.PASSIVE_CALL_OBSERVATION,
            reliability = reliability(
                grade = TelecomReliabilityGrade.CRITICAL,
                concerns = setOf(TelecomReliabilityConcern.CALLBACK_INSTABILITY),
            ),
            reason = "critical",
        )

        assertEquals(SilentFallbackAction.DISABLE_GSM_LAYER, decision.action)
        assertTrue(recoveryManager.isFeatureAutoDisabled(GsmFeature.GSM_INTELLIGENCE))
    }

    @Test
    fun fallbackRecordsPrivacySafeAction() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        val controller = SilentFallbackController(recorder = recorder)

        controller.apply(
            SilentFallbackDecision(
                action = SilentFallbackAction.NONE,
                feature = GsmFeature.OVERLAY,
                reason = "noop",
            ),
        )

        assertTrue(
            recorder.snapshot().any {
                it.type == TelecomRecordedEventType.SILENT_FALLBACK_APPLIED &&
                    "number" !in it.attributes
            },
        )
    }

    private fun reliability(
        grade: TelecomReliabilityGrade,
        concerns: Set<TelecomReliabilityConcern>,
    ): TelecomReliabilityScoreReport {
        return TelecomReliabilityScoreReport(
            score = if (grade == TelecomReliabilityGrade.CRITICAL) 40 else 60,
            grade = grade,
            shouldAutoDisable = true,
            concerns = concerns,
            components = TelecomReliabilityComponents(
                cleanupCorrectness = 60,
                overlayLatency = 60,
                callbackStability = 60,
                memoryHealth = 60,
                watchdogStability = 60,
                oemStability = 90,
            ),
            overlayAttachP95Millis = 300L,
            watchdogInterventionCount = 1,
            callbackIssueCount = 1,
            cleanupFailureCount = 0,
        )
    }
}
