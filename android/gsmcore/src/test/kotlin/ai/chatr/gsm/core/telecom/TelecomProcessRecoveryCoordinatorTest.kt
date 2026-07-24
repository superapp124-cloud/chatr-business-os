package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TelecomProcessRecoveryCoordinatorTest {
    @Test
    fun processRecoveryEndsStaleSessionWhenTelecomReportsNoCall() {
        var time = 100L
        val recorder = BoundedInMemoryTelecomEventRecorder()
        val machine = GsmSessionStateMachine(
            recorder = recorder,
            now = { time },
        )
        machine.onSnapshot(snapshot(GsmCallLifecycle.ACTIVE, 100L))
        time = 500L

        val coordinator = TelecomProcessRecoveryCoordinator(
            stateMachine = machine,
            telecomStateProbe = fakeProbe(isInCall = false),
            recorder = recorder,
            now = { time },
        )

        val decision = coordinator.reconcile(TelecomProcessRecoveryReason.PROCESS_RECREATED)

        assertTrue(TelecomProcessRecoveryAction.END_STALE_SESSIONS in decision.actions)
        assertTrue(TelecomProcessRecoveryAction.MARK_CLEANUP_COMPLETE in decision.actions)
        assertEquals(GsmSessionState.ENDED, machine.sessions.value.getValue(99).state)
        assertTrue(recorder.snapshot().any { it.type == TelecomRecordedEventType.PROCESS_RECOVERY_RECONCILED })
    }

    @Test
    fun processRecoveryRequestsOverlayDetachWhenNoCallIsActive() {
        val machine = GsmSessionStateMachine()
        val coordinator = TelecomProcessRecoveryCoordinator(
            stateMachine = machine,
            telecomStateProbe = fakeProbe(isInCall = false),
        )

        val decision = coordinator.reconcile(
            reason = TelecomProcessRecoveryReason.OVERLAY_SERVICE_RECREATED,
            overlaySnapshot = ProcessRecoveryOverlaySnapshot(
                callId = "99",
                isVisible = true,
                attachedAtMillis = 100L,
                lastReason = "attached",
            ),
        )

        assertTrue(TelecomProcessRecoveryAction.DETACH_ORPHAN_OVERLAY in decision.actions)
    }

    @Test
    fun processRecoveryWaitsForCallbacksWhenTelecomHasCallButNoSession() {
        val coordinator = TelecomProcessRecoveryCoordinator(
            stateMachine = GsmSessionStateMachine(),
            telecomStateProbe = fakeProbe(isInCall = true),
        )

        val decision = coordinator.reconcile(TelecomProcessRecoveryReason.APP_START)

        assertTrue(TelecomProcessRecoveryAction.WAIT_FOR_TELECOM_CALLBACKS in decision.actions)
    }

    private fun fakeProbe(isInCall: Boolean): AndroidTelecomStateProbe {
        return object : AndroidTelecomStateProbe {
            override fun currentState(): AndroidTelecomState {
                return AndroidTelecomState(
                    canValidate = true,
                    isInCall = isInCall,
                    source = "fake",
                    capturedAtMillis = 200L,
                )
            }
        }
    }

    private fun snapshot(
        lifecycle: GsmCallLifecycle,
        capturedAtMillis: Long,
    ): GsmCallSnapshot {
        return GsmCallSnapshot(
            telecomCallHash = 99,
            phoneNumber = "+919999999999",
            direction = GsmCallDirection.INCOMING,
            lifecycle = lifecycle,
            phoneAccountId = "sim-1",
            simSlotIndex = 0,
            capturedAtMillis = capturedAtMillis,
        )
    }
}
