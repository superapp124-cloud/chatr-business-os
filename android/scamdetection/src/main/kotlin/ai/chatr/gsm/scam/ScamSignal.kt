package ai.chatr.gsm.scam

enum class ScamType {
    OTP_REQUEST,
    BANK_FRAUD,
    IMPERSONATION,
    URGENCY_PRESSURE,
    COURIER_SCAM,
    UPI_FRAUD,
    UNKNOWN,
}

enum class ScamRiskLevel {
    NONE,
    LOW,
    MEDIUM,
    HIGH,
    CRITICAL,
}

data class ScamSignal(
    val riskLevel: ScamRiskLevel,
    val scamType: ScamType?,
    val triggerPhrase: String?,
    val confidence: Float,
    val userSafeMessage: String,
)
