package ai.chatr.gsm.core.telecom

enum class MultiCallConflictAction {
    NONE,
    USE_SINGLE_PRIMARY_SESSION,
    SHOW_RINGING_OVERLAY,
    KEEP_ACTIVE_CALL_PRIMARY,
    SUPPRESS_DUPLICATE_OVERLAYS,
    DETACH_STALE_OVERLAY,
    CLEANUP_TERMINAL_SESSIONS,
    WAIT_FOR_STABLE_STATE,
}

data class MultiCallConflictDecision(
    val primarySessionKey: Int?,
    val overlaySessionKey: Int?,
    val actions: Set<MultiCallConflictAction>,
    val suppressedSessionKeys: Set<Int>,
    val staleSessionKeys: Set<Int>,
)

class MultiCallConflictResolver(
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun resolve(
        sessions: Collection<GsmSessionRuntimeState>,
        currentOverlaySessionKey: Int?,
    ): MultiCallConflictDecision {
        val nonTerminal = sessions
            .filterNot { it.isTerminal }
            .sortedByDescending { it.lastTransitionAtMillis }
        val ringing = nonTerminal.filter { it.state == GsmSessionState.RINGING }
        val activeLike = nonTerminal.filter {
            it.state == GsmSessionState.ACTIVE || it.state == GsmSessionState.HOLDING
        }
        val dialing = nonTerminal.filter { it.state == GsmSessionState.DIALING }
        val primary = activeLike.firstOrNull() ?: ringing.firstOrNull() ?: dialing.firstOrNull()
        val overlaySession = ringing.firstOrNull() ?: currentOverlaySessionKey
            ?.let { key -> nonTerminal.firstOrNull { it.telecomCallHash == key } }
            ?: primary
        val stale = sessions.filter { it.cleanupRequired || it.isTerminal }
        val suppressed = nonTerminal
            .filter { session -> session.telecomCallHash != overlaySession?.telecomCallHash }
            .map { it.telecomCallHash }
            .toSet()

        val actions = linkedSetOf<MultiCallConflictAction>()
        when {
            nonTerminal.isEmpty() -> actions += MultiCallConflictAction.NONE
            nonTerminal.size == 1 -> actions += MultiCallConflictAction.USE_SINGLE_PRIMARY_SESSION
            else -> actions += MultiCallConflictAction.WAIT_FOR_STABLE_STATE
        }
        if (ringing.isNotEmpty()) actions += MultiCallConflictAction.SHOW_RINGING_OVERLAY
        if (activeLike.isNotEmpty()) actions += MultiCallConflictAction.KEEP_ACTIVE_CALL_PRIMARY
        if (suppressed.isNotEmpty()) actions += MultiCallConflictAction.SUPPRESS_DUPLICATE_OVERLAYS
        if (currentOverlaySessionKey != null &&
            overlaySession?.telecomCallHash != null &&
            currentOverlaySessionKey != overlaySession.telecomCallHash
        ) {
            actions += MultiCallConflictAction.DETACH_STALE_OVERLAY
        }
        if (stale.isNotEmpty()) actions += MultiCallConflictAction.CLEANUP_TERMINAL_SESSIONS

        val decision = MultiCallConflictDecision(
            primarySessionKey = primary?.telecomCallHash,
            overlaySessionKey = overlaySession?.telecomCallHash,
            actions = actions,
            suppressedSessionKeys = suppressed,
            staleSessionKeys = stale.map { it.telecomCallHash }.toSet(),
        )
        record(decision)
        return decision
    }

    private fun record(decision: MultiCallConflictDecision) {
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.MULTI_CALL_CONFLICT_RESOLVED,
                sessionKey = decision.primarySessionKey,
                timestampMillis = now(),
                activationPath = "phase_1d_internal_hardening",
                attributes = mapOf(
                    "actions" to decision.actions.joinToString { it.name },
                    "suppressed_count" to decision.suppressedSessionKeys.size.toString(),
                    "stale_count" to decision.staleSessionKeys.size.toString(),
                    "has_overlay_session" to (decision.overlaySessionKey != null).toString(),
                ),
            ),
        )
    }
}
