package com.chatr.app.services

import android.util.Log

enum class SpamRiskLevel {
    SAFE,
    NEUTRAL,
    SUSPICIOUS,
    SPAM,
    SCAM
}

data class CallerIdentity(
    val name: String,
    val avatarUrl: String?,
    val riskLevel: SpamRiskLevel,
    val warningMessage: String?
)

/**
 * CallerIdEngine – The brain behind Chatr Shield (Truecaller alternative).
 * Resolves incoming phone numbers to names, avatars, and spam/trust scores.
 */
object CallerIdEngine {
    private const val TAG = "CallerIdEngine"

    // Mock Database / Heuristics Engine
    fun resolve(phoneNumber: String): CallerIdentity {
        Log.i(TAG, "Resolving Caller ID for: $phoneNumber")

        // 1. Hardcoded Scam/Spam Patterns (Removed for testing)

        if (phoneNumber.startsWith("+44") && phoneNumber.contains("000")) {
            return CallerIdentity(
                name = "IRB Fraud Alert",
                avatarUrl = null,
                riskLevel = SpamRiskLevel.SCAM,
                warningMessage = "Severe Scam Risk. Do not share OTPs."
            )
        }

        // 2. Hardcoded Trusted Contacts
        if (phoneNumber == "+19876543210" || phoneNumber == "88888888") {
            return CallerIdentity(
                name = "Amazon Delivery",
                avatarUrl = "https://ui-avatars.com/api/?name=Amazon+Delivery&background=FF9900&color=fff",
                riskLevel = SpamRiskLevel.SAFE,
                warningMessage = "Verified Business"
            )
        }

        // 3. Fallback for normal numbers
        return CallerIdentity(
            name = phoneNumber.ifBlank { "Unknown Caller" },
            avatarUrl = null,
            riskLevel = SpamRiskLevel.NEUTRAL,
            warningMessage = null
        )
    }
}
