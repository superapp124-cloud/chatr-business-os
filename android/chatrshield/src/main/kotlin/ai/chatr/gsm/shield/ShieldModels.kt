package ai.chatr.gsm.shield

import ai.chatr.gsm.scam.ScamSignal

enum class ShieldVerdict {
    TRUSTED,
    KNOWN_CONTACT,
    UNKNOWN,
    SUSPICIOUS,
    POTENTIAL_SCAM,
}

data class CallerReputation(
    val phoneNumber: String?,
    val isKnownContact: Boolean,
    val localSpamScore: Float,
    val reportCount: Int,
    val robocallProbability: Float,
)

data class ShieldAnalysis(
    val verdict: ShieldVerdict,
    val trustScore: Float,
    val title: String,
    val reason: String,
    val scamSignal: ScamSignal?,
)
