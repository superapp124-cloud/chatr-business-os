package ai.chatr.gsm.scam

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OfflineScamPhraseDetectorTest {
    private val detector = OfflineScamPhraseDetector()

    @Test
    fun detectsOtpScamPhrase() {
        val signal = detector.analyze("Sir, OTP bata do account verify karna hai.")

        assertEquals(ScamType.OTP_REQUEST, signal.scamType)
        assertEquals(ScamRiskLevel.CRITICAL, signal.riskLevel)
        assertTrue(signal.confidence > 0.9f)
    }

    @Test
    fun returnsNoneForSafeText() {
        val signal = detector.analyze("Kal meeting ke baad invoice bhej dena.")

        assertEquals(ScamRiskLevel.NONE, signal.riskLevel)
        assertEquals(null, signal.scamType)
    }
}
