package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionConsistencyAuditorTest {
    @Test
    fun visibleOverlayWithoutActiveSessionIsInconsistent() {
        val auditor = SessionConsistencyAuditor(
            stateMachine = GsmSessionStateMachine(),
        )

        val report = auditor.audit(
            reason = "test",
            overlaySnapshot = SessionAuditOverlaySnapshot(
                callId = "11",
                isVisible = true,
            ),
        )

        assertFalse(report.consistent)
        assertTrue(SessionConsistencyIssue.OVERLAY_WITHOUT_SESSION in report.issues)
    }

    @Test
    fun callbackIgnoredEventIsInconsistencySignal() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.CALLBACK_IGNORED,
                sessionKey = 1,
                timestampMillis = 100L,
                activationPath = "test",
            ),
        )
        val auditor = SessionConsistencyAuditor(
            stateMachine = GsmSessionStateMachine(recorder = recorder),
            recorder = recorder,
        )

        val report = auditor.audit("test")

        assertFalse(report.consistent)
        assertTrue(SessionConsistencyIssue.INVALID_TRANSITION_RECORDED in report.issues)
    }
}
