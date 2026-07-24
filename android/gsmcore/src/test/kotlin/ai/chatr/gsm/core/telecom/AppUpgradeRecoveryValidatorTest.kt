package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppUpgradeRecoveryValidatorTest {
    @Test
    fun upgradeDuringDormantStateIsSafe() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        val machine = GsmSessionStateMachine(recorder = recorder)
        val validator = validator(
            recorder = recorder,
            machine = machine,
            telecomInCall = false,
        )

        val report = validator.validate(AppUpgradeRecoveryScenario.DORMANT_GSM_STATE)

        assertTrue(report.safeToContinue)
        assertTrue(report.risks.isEmpty())
    }

    @Test
    fun upgradeWithVisibleOverlayRequestsOrphanDetach() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        val machine = GsmSessionStateMachine(recorder = recorder)
        val validator = validator(
            recorder = recorder,
            machine = machine,
            telecomInCall = false,
        )

        val report = validator.validate(
            scenario = AppUpgradeRecoveryScenario.OVERLAY_VISIBLE_DURING_UPGRADE,
            overlaySnapshot = ProcessRecoveryOverlaySnapshot(
                callId = "77",
                isVisible = true,
                attachedAtMillis = 100L,
                lastReason = "package_replace",
            ),
        )

        assertTrue(report.safeToContinue)
        assertTrue(AppUpgradeRecoveryRisk.ORPHAN_OVERLAY_REQUIRES_DETACH in report.risks)
    }

    @Test
    fun upgradeWithMemoryRetentionRequiresReview() {
        var now = 100L
        val recorder = BoundedInMemoryTelecomEventRecorder()
        val machine = GsmSessionStateMachine(recorder = recorder, now = { now })
        val memoryGuard = TelecomMemoryGuard(
            stateMachine = machine,
            recorder = recorder,
            thresholds = TelecomMemoryGuardThresholds(callbackRetentionMillis = 50L),
            now = { now },
        )
        memoryGuard.onCallbackRegistered(8)
        now = 200L
        val validator = AppUpgradeRecoveryValidator(
            recoveryCoordinator = TelecomProcessRecoveryCoordinator(
                stateMachine = machine,
                telecomStateProbe = fakeProbe(false, now),
                recorder = recorder,
                now = { now },
            ),
            memoryGuard = memoryGuard,
            recorder = recorder,
            now = { now },
        )

        val report = validator.validate(AppUpgradeRecoveryScenario.SERVICE_RECREATED_AFTER_PACKAGE_REPLACE)

        assertFalse(report.safeToContinue)
        assertTrue(AppUpgradeRecoveryRisk.MEMORY_RETENTION_DETECTED in report.risks)
    }

    private fun validator(
        recorder: TelecomEventRecorder,
        machine: GsmSessionStateMachine,
        telecomInCall: Boolean,
    ): AppUpgradeRecoveryValidator {
        val memoryGuard = TelecomMemoryGuard(
            stateMachine = machine,
            recorder = recorder,
        )
        return AppUpgradeRecoveryValidator(
            recoveryCoordinator = TelecomProcessRecoveryCoordinator(
                stateMachine = machine,
                telecomStateProbe = fakeProbe(telecomInCall, 100L),
                recorder = recorder,
            ),
            memoryGuard = memoryGuard,
            recorder = recorder,
        )
    }

    private fun fakeProbe(
        inCall: Boolean,
        timestamp: Long,
    ): AndroidTelecomStateProbe {
        return object : AndroidTelecomStateProbe {
            override fun currentState(): AndroidTelecomState {
                return AndroidTelecomState(
                    canValidate = true,
                    isInCall = inCall,
                    source = "test",
                    capturedAtMillis = timestamp,
                )
            }
        }
    }
}
