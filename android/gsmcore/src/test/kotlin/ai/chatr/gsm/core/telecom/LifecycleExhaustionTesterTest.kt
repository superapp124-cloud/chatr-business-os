package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LifecycleExhaustionTesterTest {
    @Test
    fun deterministicStressRunLeavesNoActiveOrDirtySessions() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        val tester = LifecycleExhaustionTester(recorder = recorder)

        val result = tester.run(
            reason = "unit_test",
            config = LifecycleExhaustionConfig(
                repeatedRingingLoops = 3,
                answerRejectLoops = 3,
                rapidDisconnectLoops = 3,
                processRecreationStorms = 2,
                multiCallChurnLoops = 2,
                orientationStorms = 2,
            ),
        )

        assertTrue(result.passed)
        assertEquals(0, result.activeSessionCount)
        assertEquals(0, result.cleanupRequiredCount)
        assertTrue(
            recorder.snapshot().any {
                it.type == TelecomRecordedEventType.LIFECYCLE_EXHAUSTION_TEST_REPORTED
            },
        )
    }
}
