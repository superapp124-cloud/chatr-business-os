package ai.chatr.gsm.core.safety

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.telecom.BoundedInMemoryTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEvent
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TelecomDeadmanSwitchTest {
    @Test
    fun repeatedWatchdogLoopsTripSafeModeAndDisableGsmEnhancements() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        repeat(3) {
            recorder.record(
                event(
                    type = TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION,
                    attributes = mapOf("action" to "FORCE_DETACH"),
                ),
            )
        }
        val safeMode = GsmSafeMode(recorder = recorder, now = { 1_000L })
        val recoveryManager = GsmSafetyRecoveryManager(recorder = recorder, now = { 1_000L })
        val switch = TelecomDeadmanSwitch(
            safeMode = safeMode,
            recoveryManager = recoveryManager,
            recorder = recorder,
            now = { 1_000L },
        )

        val decision = switch.evaluateAndTripIfNeeded("watchdog", windowMillis = 1_000L)

        assertTrue(decision.tripped)
        assertEquals(TelecomDeadmanTrigger.WATCHDOG_RECOVERY_LOOP, decision.trigger)
        assertTrue(safeMode.isActive())
        assertTrue(safeMode.current().manualReenableRequired)
        assertTrue(recoveryManager.isFeatureAutoDisabled(GsmFeature.GSM_INTELLIGENCE))
        assertTrue(recorder.snapshot().any { it.type == TelecomRecordedEventType.TELECOM_DEADMAN_SWITCH_TRIPPED })
    }

    @Test
    fun stateMachineCorruptionTripsImmediately() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(
            event(
                type = TelecomRecordedEventType.SESSION_CONSISTENCY_AUDIT,
                attributes = mapOf(
                    "consistent" to "false",
                    "issues" to "INVALID_TRANSITION_RECORDED",
                ),
            ),
        )
        val switch = TelecomDeadmanSwitch(
            safeMode = GsmSafeMode(recorder = recorder, now = { 1_000L }),
            recorder = recorder,
            now = { 1_000L },
        )

        val decision = switch.evaluateAndTripIfNeeded("corruption", windowMillis = 1_000L)

        assertTrue(decision.tripped)
        assertEquals(TelecomDeadmanTrigger.STATE_MACHINE_CORRUPTION, decision.trigger)
    }

    private fun event(
        type: TelecomRecordedEventType,
        attributes: Map<String, String>,
    ): TelecomRecordedEvent {
        return TelecomRecordedEvent(
            type = type,
            sessionKey = null,
            timestampMillis = 500L,
            activationPath = "test",
            attributes = attributes,
        )
    }
}
