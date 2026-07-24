package ai.chatr.gsm.shield

import org.junit.Assert.assertEquals
import org.junit.Test

class ShieldVerdictEngineTest {
    private val engine = ShieldVerdictEngine()

    @Test
    fun savedContactReturnsKnownContact() {
        val result = engine.score(
            LocalReputationEvidence(
                phoneNumber = "+919999999999",
                isSavedContact = true,
                isChatrVerifiedPeer = false,
                localSpamScore = 0f,
                localReportCount = 0,
                robocallProbability = 0f,
            ),
        )

        assertEquals(ShieldVerdict.KNOWN_CONTACT, result.verdict)
    }

    @Test
    fun highSpamSignalsReturnPotentialScam() {
        val result = engine.score(
            LocalReputationEvidence(
                phoneNumber = "+910000000000",
                isSavedContact = false,
                isChatrVerifiedPeer = false,
                localSpamScore = 0.95f,
                localReportCount = 80,
                robocallProbability = 0.9f,
            ),
        )

        assertEquals(ShieldVerdict.POTENTIAL_SCAM, result.verdict)
    }
}
