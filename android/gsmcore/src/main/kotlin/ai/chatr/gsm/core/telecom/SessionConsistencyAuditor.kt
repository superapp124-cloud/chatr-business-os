package ai.chatr.gsm.core.telecom

enum class SessionConsistencyIssue {
    ORPHAN_ACTIVE_SESSION,
    TERMINAL_SESSION_REQUIRES_CLEANUP,
    INVALID_TRANSITION_RECORDED,
    OVERLAY_WITHOUT_SESSION,
    SESSION_OVERLAY_MISMATCH,
}

data class SessionAuditOverlaySnapshot(
    val callId: String?,
    val isVisible: Boolean,
)

data class SessionConsistencyReport(
    val consistent: Boolean,
    val issues: Set<SessionConsistencyIssue>,
    val activeSessionCount: Int,
    val terminalCleanupCount: Int,
)

class SessionConsistencyAuditor(
    private val stateMachine: GsmSessionStateMachine,
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun audit(
        reason: String,
        overlaySnapshot: SessionAuditOverlaySnapshot? = null,
    ): SessionConsistencyReport {
        val sessions = stateMachine.sessions.value.values
        val activeSessions = sessions.filterNot { it.isTerminal }
        val terminalCleanup = sessions.filter { it.isTerminal && it.cleanupRequired }
        val invalidTransitionSeen = recorder.snapshot().any {
            it.type == TelecomRecordedEventType.CALLBACK_IGNORED
        }
        val overlayVisible = overlaySnapshot?.isVisible == true
        val overlayMatchesSession = overlaySnapshot?.callId?.let { callId ->
            activeSessions.any { it.telecomCallHash.toString() == callId }
        } ?: true

        val issues = buildSet {
            if (activeSessions.size > 2) add(SessionConsistencyIssue.ORPHAN_ACTIVE_SESSION)
            if (terminalCleanup.isNotEmpty()) add(SessionConsistencyIssue.TERMINAL_SESSION_REQUIRES_CLEANUP)
            if (invalidTransitionSeen) add(SessionConsistencyIssue.INVALID_TRANSITION_RECORDED)
            if (overlayVisible && activeSessions.isEmpty()) add(SessionConsistencyIssue.OVERLAY_WITHOUT_SESSION)
            if (overlayVisible && !overlayMatchesSession) add(SessionConsistencyIssue.SESSION_OVERLAY_MISMATCH)
        }

        val report = SessionConsistencyReport(
            consistent = issues.isEmpty(),
            issues = issues,
            activeSessionCount = activeSessions.size,
            terminalCleanupCount = terminalCleanup.size,
        )
        record(reason, report)
        return report
    }

    private fun record(
        reason: String,
        report: SessionConsistencyReport,
    ) {
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.SESSION_CONSISTENCY_AUDIT,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_1e_dogfood_readiness",
                attributes = mapOf(
                    "reason" to reason,
                    "consistent" to report.consistent.toString(),
                    "issues" to report.issues.joinToString { it.name },
                    "active_session_count" to report.activeSessionCount.toString(),
                    "terminal_cleanup_count" to report.terminalCleanupCount.toString(),
                ),
            ),
        )
    }
}
