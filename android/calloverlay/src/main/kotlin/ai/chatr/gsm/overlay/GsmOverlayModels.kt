package ai.chatr.gsm.overlay

import ai.chatr.gsm.shield.ShieldAnalysis

enum class GsmOverlayMode {
    COLLAPSED,
    EXPANDED,
    FRAUD_ALERT,
}

data class GsmOverlayState(
    val callId: String,
    val mode: GsmOverlayMode,
    val title: String,
    val subtitle: String?,
    val shieldAnalysis: ShieldAnalysis?,
)
