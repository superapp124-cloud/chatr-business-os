package ai.chatr.gsm.core.diagnostics

import ai.chatr.gsm.core.telecom.BoundedInMemoryTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GsmDeviceValidationMatrixTest {
    @Test
    fun missingRealDeviceEvidenceBlocksActivePilotReadiness() {
        val matrix = GsmDeviceValidationMatrix()

        val report = matrix.evaluate(
            reason = "empty",
            evidence = emptyList(),
        )

        assertFalse(report.readyForPassiveObservationPilot)
        assertEquals(report.requiredCaseCount, report.missingCases.size)
        assertEquals(0, report.passedCaseCount)
    }

    @Test
    fun allMandatoryEvidenceAllowsPassiveObservationPilotReadiness() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        val matrix = GsmDeviceValidationMatrix(
            recorder = recorder,
            now = { 1_000L },
        )
        val evidence = matrix.requiredCases().map { requiredCase ->
            GsmValidationEvidence(
                case = requiredCase,
                passed = true,
                notes = "validated",
            )
        }

        val report = matrix.evaluate(
            reason = "complete",
            evidence = evidence,
        )

        assertTrue(report.readyForPassiveObservationPilot)
        assertTrue(report.missingCases.isEmpty())
        assertTrue(report.failedCases.isEmpty())
        assertEquals(report.requiredCaseCount, report.passedCaseCount)
        assertTrue(recorder.snapshot().any { it.type == TelecomRecordedEventType.DEVICE_VALIDATION_MATRIX_EVALUATED })
    }

    @Test
    fun failedEvidenceBlocksPilotEvenWhenCoverageIsComplete() {
        val matrix = GsmDeviceValidationMatrix()
        val evidence = matrix.requiredCases().mapIndexed { index, requiredCase ->
            GsmValidationEvidence(
                case = requiredCase,
                passed = index != 0,
            )
        }

        val report = matrix.evaluate(
            reason = "failure",
            evidence = evidence,
        )

        assertFalse(report.readyForPassiveObservationPilot)
        assertTrue(report.missingCases.isEmpty())
        assertEquals(1, report.failedCases.size)
    }
}
