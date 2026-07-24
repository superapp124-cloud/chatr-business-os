package ai.chatr.gsm.overlay

import ai.chatr.gsm.core.compat.OemTelecomBehaviorProfiles
import ai.chatr.gsm.core.telecom.BoundedInMemoryTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OverlayWatchdogTest {
    @Test
    fun visibleOverlayWithoutActiveSessionIsForceDetached() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        val watchdog = OverlayWatchdog(
            oemProfile = OemTelecomBehaviorProfiles.forManufacturer("Google"),
            recorder = recorder,
            now = { 500L },
        )

        val decision = watchdog.evaluate(
            overlaySnapshot = OverlayLifecycleSnapshot(
                callId = "10",
                state = OverlayLifecycleState.ATTACHED,
                requestedAtMillis = 100L,
                attachedAtMillis = 120L,
                detachedAtMillis = null,
                lastReason = "attached",
            ),
            activeOverlayCallIds = emptySet(),
        )

        assertEquals(OverlayWatchdogAction.FORCE_DETACH, decision.action)
        assertTrue(recorder.snapshot().any { it.type == TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION })
    }

    @Test
    fun slowAttachIsReportedAsStuckOverlay() {
        val watchdog = OverlayWatchdog(
            oemProfile = OemTelecomBehaviorProfiles.forManufacturer("Google"),
            now = { 400L },
        )

        val decision = watchdog.evaluate(
            overlaySnapshot = OverlayLifecycleSnapshot(
                callId = "10",
                state = OverlayLifecycleState.ATTACHING,
                requestedAtMillis = 100L,
                attachedAtMillis = null,
                detachedAtMillis = null,
                lastReason = "attach_requested",
            ),
            activeOverlayCallIds = setOf("10"),
        )

        assertEquals(OverlayWatchdogAction.REPORT_STUCK_OVERLAY, decision.action)
        assertEquals("attach_timeout", decision.reason)
    }
}
