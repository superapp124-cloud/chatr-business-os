package ai.chatr.gsm.scam

interface ScamPhraseDetector {
    fun analyze(text: String): ScamSignal
}

class OfflineScamPhraseDetector(
    private val phrases: List<ScamPhrase> = defaultPhrases,
) : ScamPhraseDetector {

    override fun analyze(text: String): ScamSignal {
        val normalized = text.lowercase()
        val match = phrases.firstOrNull { phrase ->
            normalized.contains(phrase.text.lowercase())
        }

        return match?.toSignal() ?: ScamSignal(
            riskLevel = ScamRiskLevel.NONE,
            scamType = null,
            triggerPhrase = null,
            confidence = 0f,
            userSafeMessage = "No scam phrase detected.",
        )
    }

    private fun ScamPhrase.toSignal(): ScamSignal {
        return ScamSignal(
            riskLevel = riskLevel,
            scamType = scamType,
            triggerPhrase = text,
            confidence = confidence,
            userSafeMessage = message,
        )
    }

    data class ScamPhrase(
        val text: String,
        val scamType: ScamType,
        val riskLevel: ScamRiskLevel,
        val confidence: Float,
        val message: String,
    )

    companion object {
        val defaultPhrases = listOf(
            ScamPhrase("otp bata do", ScamType.OTP_REQUEST, ScamRiskLevel.CRITICAL, 0.96f, "Never share OTPs on a call."),
            ScamPhrase("share your otp", ScamType.OTP_REQUEST, ScamRiskLevel.CRITICAL, 0.96f, "Never share OTPs on a call."),
            ScamPhrase("verify your account", ScamType.BANK_FRAUD, ScamRiskLevel.HIGH, 0.78f, "Verify bank requests from the official app or branch."),
            ScamPhrase("bank account block", ScamType.BANK_FRAUD, ScamRiskLevel.HIGH, 0.84f, "Do not share bank details with callers."),
            ScamPhrase("rbi calling", ScamType.BANK_FRAUD, ScamRiskLevel.CRITICAL, 0.92f, "RBI does not call customers for account verification."),
            ScamPhrase("freeze your account", ScamType.BANK_FRAUD, ScamRiskLevel.HIGH, 0.82f, "Hang up and call your bank directly."),
            ScamPhrase("police case registered", ScamType.IMPERSONATION, ScamRiskLevel.HIGH, 0.85f, "Verify official claims independently."),
            ScamPhrase("arrest warrant", ScamType.IMPERSONATION, ScamRiskLevel.CRITICAL, 0.9f, "Do not panic or transfer money."),
            ScamPhrase("abhi karo", ScamType.URGENCY_PRESSURE, ScamRiskLevel.MEDIUM, 0.68f, "Urgency pressure is a common scam pattern."),
            ScamPhrase("last warning", ScamType.URGENCY_PRESSURE, ScamRiskLevel.MEDIUM, 0.65f, "Pause before taking action."),
            ScamPhrase("package seized", ScamType.COURIER_SCAM, ScamRiskLevel.HIGH, 0.82f, "Courier seizure calls are commonly abused by scammers."),
            ScamPhrase("customs department", ScamType.COURIER_SCAM, ScamRiskLevel.MEDIUM, 0.66f, "Verify courier issues through the official tracking page."),
            ScamPhrase("gpay link bhejo", ScamType.UPI_FRAUD, ScamRiskLevel.CRITICAL, 0.91f, "Do not open or send payment links under pressure."),
            ScamPhrase("scan this qr", ScamType.UPI_FRAUD, ScamRiskLevel.HIGH, 0.8f, "Scanning QR codes can authorize payments."),
        )
    }
}
