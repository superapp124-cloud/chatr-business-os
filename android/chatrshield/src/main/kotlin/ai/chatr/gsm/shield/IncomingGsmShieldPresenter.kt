package ai.chatr.gsm.shield

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.GsmFeatureFlagProvider
import ai.chatr.gsm.core.StaticGsmFeatureFlagProvider

data class IncomingGsmShieldState(
    val callerIdentity: CallerIdentity,
    val analysis: ShieldAnalysis,
    val primaryLabel: String,
    val secondaryLabel: String,
    val shouldShowWarning: Boolean,
)

class IncomingGsmShieldPresenter(
    private val flags: GsmFeatureFlagProvider = StaticGsmFeatureFlagProvider,
    private val shieldEngine: ChatrShieldEngine = ChatrShieldEngine(flags),
) {
    fun present(
        callerIdentity: CallerIdentity,
        localSpamScore: Float,
        localReportCount: Int,
        robocallProbability: Float,
    ): IncomingGsmShieldState {
        val reputation = CallerReputation(
            phoneNumber = callerIdentity.phoneNumber,
            isKnownContact = callerIdentity.isSavedContact ||
                callerIdentity.verifiedProfile?.verificationLevel == VerificationLevel.CHATR_VERIFIED,
            localSpamScore = localSpamScore,
            reportCount = localReportCount,
            robocallProbability = robocallProbability,
        )
        val analysis = shieldEngine.analyzeIncomingCaller(reputation)
        val displayName = callerIdentity.bestDisplayName
            ?: callerIdentity.phoneNumber
            ?: "Unknown Caller"

        return IncomingGsmShieldState(
            callerIdentity = callerIdentity,
            analysis = analysis,
            primaryLabel = displayName,
            secondaryLabel = if (flags.isEnabled(GsmFeature.SHIELD)) {
                analysis.title
            } else {
                "Normal GSM call"
            },
            shouldShowWarning = analysis.verdict == ShieldVerdict.POTENTIAL_SCAM ||
                analysis.verdict == ShieldVerdict.SUSPICIOUS,
        )
    }
}
