package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MultiCallConflictResolverTest {
    @Test
    fun secondIncomingCallBecomesOverlayCandidateWithoutDuplicatingOverlays() {
        val resolver = MultiCallConflictResolver()
        val active = session(1, GsmSessionState.ACTIVE, 100L)
        val ringing = session(2, GsmSessionState.RINGING, 200L)

        val decision = resolver.resolve(
            sessions = listOf(active, ringing),
            currentOverlaySessionKey = 1,
        )

        assertEquals(1, decision.primarySessionKey)
        assertEquals(2, decision.overlaySessionKey)
        assertTrue(MultiCallConflictAction.SHOW_RINGING_OVERLAY in decision.actions)
        assertTrue(MultiCallConflictAction.DETACH_STALE_OVERLAY in decision.actions)
        assertTrue(1 in decision.suppressedSessionKeys)
    }

    @Test
    fun terminalCleanupIsReportedAsStale() {
        val resolver = MultiCallConflictResolver()
        val ended = session(3, GsmSessionState.ENDED, 300L, cleanupRequired = true)

        val decision = resolver.resolve(
            sessions = listOf(ended),
            currentOverlaySessionKey = null,
        )

        assertTrue(MultiCallConflictAction.CLEANUP_TERMINAL_SESSIONS in decision.actions)
        assertTrue(3 in decision.staleSessionKeys)
    }

    private fun session(
        key: Int,
        state: GsmSessionState,
        transitionedAt: Long,
        cleanupRequired: Boolean = false,
    ): GsmSessionRuntimeState {
        return GsmSessionRuntimeState(
            telecomCallHash = key,
            state = state,
            direction = GsmCallDirection.INCOMING,
            phoneAccountId = "sim-1",
            simSlotIndex = 0,
            firstSeenAtMillis = 100L,
            lastTransitionAtMillis = transitionedAt,
            ringingAtMillis = null,
            activeAtMillis = transitionedAt.takeIf { state == GsmSessionState.ACTIVE },
            disconnectingAtMillis = null,
            endedAtMillis = transitionedAt.takeIf { state == GsmSessionState.ENDED },
            cleanupRequired = cleanupRequired,
            cleanupCompletedAtMillis = null,
            lastReason = GsmSessionTransitionReason.SNAPSHOT,
        )
    }
}
