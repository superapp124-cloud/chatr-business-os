package ai.chatr.gsm.core.safety

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.telecom.BoundedInMemoryTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import ai.chatr.gsm.core.telemetry.InMemoryGsmTelemetrySink
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GsmSafetyRecoveryManagerTest {
    @Test
    fun repeatedOverlayFailuresAutoDisableOverlay() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        val telemetry = InMemoryGsmTelemetrySink()
        val manager = GsmSafetyRecoveryManager(
            recorder = recorder,
            telemetrySink = telemetry,
        )

        manager.report(GsmRecoverySignal.OVERLAY_RENDER_FAILURE, GsmFeature.OVERLAY, "first")
        manager.report(GsmRecoverySignal.OVERLAY_RENDER_FAILURE, GsmFeature.OVERLAY, "second")
        val decision = manager.report(GsmRecoverySignal.OVERLAY_RENDER_FAILURE, GsmFeature.OVERLAY, "third")

        assertEquals(GsmRecoveryAction.DISABLE_OVERLAY, decision.action)
        assertTrue(manager.isFeatureAutoDisabled(GsmFeature.OVERLAY))
        assertTrue(recorder.snapshot().any { it.type == TelecomRecordedEventType.SAFETY_RECOVERY_ACTION })
        assertTrue(telemetry.events.any { it.name == GsmTelemetryEventName.AUTO_DISABLED_FOR_SAFETY })
    }

    @Test
    fun callbackFailuresAutoDisableWholeGsmLayer() {
        val manager = GsmSafetyRecoveryManager()

        manager.report(GsmRecoverySignal.TELECOM_CALLBACK_FAILURE, GsmFeature.PASSIVE_CALL_OBSERVATION, "first")
        val decision = manager.report(
            signal = GsmRecoverySignal.TELECOM_CALLBACK_FAILURE,
            feature = GsmFeature.PASSIVE_CALL_OBSERVATION,
            reason = "second",
        )

        assertEquals(GsmRecoveryAction.DISABLE_GSM_LAYER, decision.action)
        assertTrue(manager.isFeatureAutoDisabled(GsmFeature.OVERLAY))
        assertTrue(manager.isFeatureAutoDisabled(GsmFeature.SHIELD))
    }
}
