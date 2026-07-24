package ai.chatr.gsm.shield

data class LocalReputationEvidence(
    val phoneNumber: String?,
    val isSavedContact: Boolean,
    val isChatrVerifiedPeer: Boolean,
    val localSpamScore: Float,
    val localReportCount: Int,
    val robocallProbability: Float,
    val suspiciousPrefix: Boolean = false,
    val unusualCallTime: Boolean = false,
)

data class ShieldVerdictResult(
    val verdict: ShieldVerdict,
    val trustScore: Float,
    val reason: String,
)

class ShieldVerdictEngine {
    fun score(evidence: LocalReputationEvidence): ShieldVerdictResult {
        if (evidence.isChatrVerifiedPeer) {
            return ShieldVerdictResult(
                verdict = ShieldVerdict.TRUSTED,
                trustScore = 0.98f,
                reason = "Verified CHATR profile.",
            )
        }

        if (evidence.isSavedContact) {
            return ShieldVerdictResult(
                verdict = ShieldVerdict.KNOWN_CONTACT,
                trustScore = 0.92f,
                reason = "Saved contact on this device.",
            )
        }

        val reportRisk = (evidence.localReportCount / 50f).coerceIn(0f, 1f)
        val heuristicRisk = listOf(
            evidence.localSpamScore * 0.46f,
            reportRisk * 0.24f,
            evidence.robocallProbability * 0.18f,
            if (evidence.suspiciousPrefix) 0.07f else 0f,
            if (evidence.unusualCallTime) 0.05f else 0f,
        ).sum().coerceIn(0f, 1f)

        return when {
            heuristicRisk >= 0.72f -> ShieldVerdictResult(
                verdict = ShieldVerdict.POTENTIAL_SCAM,
                trustScore = 1f - heuristicRisk,
                reason = "High local spam, report, or robocall risk.",
            )
            heuristicRisk >= 0.42f -> ShieldVerdictResult(
                verdict = ShieldVerdict.SUSPICIOUS,
                trustScore = 1f - heuristicRisk,
                reason = "Some local risk signals found.",
            )
            else -> ShieldVerdictResult(
                verdict = ShieldVerdict.UNKNOWN,
                trustScore = 1f - heuristicRisk,
                reason = "Unknown caller with no strong local risk signal.",
            )
        }
    }
}
