package ai.chatr.gsm.smartdialer

import ai.chatr.gsm.shield.ShieldAnalysis

data class SmartDialerContact(
    val id: String,
    val displayName: String,
    val phoneNumber: String,
    val t9Key: String,
    val shieldAnalysis: ShieldAnalysis?,
)

data class SmartDialerSuggestion(
    val phoneNumber: String,
    val displayName: String?,
    val reason: String,
    val shieldAnalysis: ShieldAnalysis?,
)
