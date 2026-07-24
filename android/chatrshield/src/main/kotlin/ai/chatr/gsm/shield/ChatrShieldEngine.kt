package ai.chatr.gsm.shield

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.GsmFeatureFlagProvider
import ai.chatr.gsm.core.StaticGsmFeatureFlagProvider
import ai.chatr.gsm.scam.OfflineScamPhraseDetector
import ai.chatr.gsm.scam.ScamPhraseDetector
import ai.chatr.gsm.scam.ScamRiskLevel

class ChatrShieldEngine(
    private val flags: GsmFeatureFlagProvider = StaticGsmFeatureFlagProvider,
    private val scamPhraseDetector: ScamPhraseDetector = OfflineScamPhraseDetector(),
    private val verdictEngine: ShieldVerdictEngine = ShieldVerdictEngine(),
) {
    fun analyzeIncomingCaller(reputation: CallerReputation): ShieldAnalysis {
        if (!flags.isEnabled(GsmFeature.SHIELD)) {
            return disabledAnalysis(reputation.phoneNumber)
        }

        val result = verdictEngine.score(
            LocalReputationEvidence(
                phoneNumber = reputation.phoneNumber,
                isSavedContact = reputation.isKnownContact,
                isChatrVerifiedPeer = false,
                localSpamScore = reputation.localSpamScore,
                localReportCount = reputation.reportCount,
                robocallProbability = reputation.robocallProbability,
            ),
        )

        return ShieldAnalysis(
            verdict = result.verdict,
            trustScore = result.trustScore,
            title = result.verdict.title,
            reason = result.reason,
            scamSignal = null,
        )
    }

    fun analyzeTranscriptChunk(text: String): ShieldAnalysis {
        if (!flags.isEnabled(GsmFeature.SHIELD)) {
            return disabledAnalysis(null)
        }

        val signal = scamPhraseDetector.analyze(text)
        return when (signal.riskLevel) {
            ScamRiskLevel.CRITICAL, ScamRiskLevel.HIGH -> ShieldAnalysis(
                verdict = ShieldVerdict.POTENTIAL_SCAM,
                trustScore = 0.05f,
                title = "Potential Scam",
                reason = signal.userSafeMessage,
                scamSignal = signal,
            )
            ScamRiskLevel.MEDIUM, ScamRiskLevel.LOW -> ShieldAnalysis(
                verdict = ShieldVerdict.SUSPICIOUS,
                trustScore = 0.35f,
                title = "Suspicious",
                reason = signal.userSafeMessage,
                scamSignal = signal,
            )
            ScamRiskLevel.NONE -> disabledAnalysis(null).copy(
                verdict = ShieldVerdict.UNKNOWN,
                trustScore = 0.7f,
                title = "No Scam Phrase",
                reason = "No scam phrase detected.",
            )
        }
    }

    private fun disabledAnalysis(phoneNumber: String?): ShieldAnalysis {
        return ShieldAnalysis(
            verdict = if (phoneNumber.isNullOrBlank()) ShieldVerdict.UNKNOWN else ShieldVerdict.TRUSTED,
            trustScore = 1f,
            title = "CHATR Shield Off",
            reason = "GSM intelligence is disabled.",
            scamSignal = null,
        )
    }

    private val ShieldVerdict.title: String
        get() = when (this) {
            ShieldVerdict.TRUSTED -> "Trusted"
            ShieldVerdict.KNOWN_CONTACT -> "Known Contact"
            ShieldVerdict.UNKNOWN -> "Unknown Caller"
            ShieldVerdict.SUSPICIOUS -> "Suspicious"
            ShieldVerdict.POTENTIAL_SCAM -> "Potential Scam"
        }
}
