package ai.chatr.gsm.overlay

import ai.chatr.gsm.core.compat.TelecomCompatibilityProfile
import ai.chatr.gsm.core.compat.TelecomSupportLevel
import ai.chatr.gsm.core.telecom.BoundedInMemoryTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OverlayLifecycleCoordinatorTest {
    @Test
    fun supportedPixelOverlayRequestsAttachAndRecordsLatency() {
        var time = 220L
        val recorder = BoundedInMemoryTelecomEventRecorder()
        val coordinator = OverlayLifecycleCoordinator(
            recorder = recorder,
            now = { time },
        )

        val decision = coordinator.onOverlayRequested(
            callId = "call-1",
            telecomRingingAtMillis = 100L,
            compatibilityProfile = compatibility(),
            isDeviceLocked = false,
            canDrawOverlay = true,
        )

        assertEquals(OverlayLifecycleCommand.ATTACH, decision.command)
        time = 240L
        coordinator.onAttachSucceeded("call-1")

        val attached = recorder.snapshot().first { it.type == TelecomRecordedEventType.OVERLAY_ATTACHED }
        assertEquals(140L, attached.durationMillis)
        assertEquals(OverlayLifecycleState.ATTACHED, coordinator.current().state)
    }

    @Test
    fun lockscreenRiskSuppressesOverlay() {
        val coordinator = OverlayLifecycleCoordinator()

        val decision = coordinator.onOverlayRequested(
            callId = "call-1",
            telecomRingingAtMillis = 100L,
            compatibilityProfile = compatibility(suppressWhenLocked = true),
            isDeviceLocked = true,
            canDrawOverlay = true,
        )

        assertEquals(OverlayLifecycleCommand.SUPPRESS, decision.command)
        assertEquals(OverlayLifecycleState.SUPPRESSED, coordinator.current().state)
    }

    @Test
    fun detachMovesAttachedOverlayToDetached() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        val coordinator = OverlayLifecycleCoordinator(recorder = recorder)

        coordinator.onOverlayRequested("call-1", 100L, compatibility(), false, true)
        coordinator.onAttachSucceeded("call-1")
        val decision = coordinator.onDetachRequested("call-1", "disconnect")
        coordinator.onDetached("call-1", success = true, reason = "disconnect")

        assertEquals(OverlayLifecycleCommand.DETACH, decision.command)
        assertEquals(OverlayLifecycleState.DETACHED, coordinator.current().state)
        assertTrue(recorder.snapshot().any { it.type == TelecomRecordedEventType.OVERLAY_DETACHED })
    }

    private fun compatibility(
        suppressWhenLocked: Boolean = false,
    ): TelecomCompatibilityProfile {
        return TelecomCompatibilityProfile(
            manufacturer = "Google",
            overlaySupport = TelecomSupportLevel.FULL,
            callScreeningSupport = TelecomSupportLevel.FULL,
            roleBehavior = TelecomSupportLevel.FULL,
            lockscreenBehavior = TelecomSupportLevel.FULL,
            batteryRestrictionRisk = TelecomSupportLevel.FULL,
            shouldUseHeadsUpOnlyOnLockscreen = false,
            shouldSuppressOverlayWhenLocked = suppressWhenLocked,
            notes = emptyList(),
        )
    }
}
