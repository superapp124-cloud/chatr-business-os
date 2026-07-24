package ai.chatr.gsm.core.capability

data class GsmCapabilities(
    val androidVersion: Int,
    val hasTelephony: Boolean,
    val canRequestDefaultDialerRole: Boolean,
    val isDefaultDialer: Boolean,
    val supportsCallScreening: Boolean,
    val supportsInCallService: Boolean,
    val supportsCallRedirection: Boolean,
    val supportsOverlay: Boolean,
    val supportsAudioEffects: Boolean,
)

interface GsmCapabilityChecker {
    fun getCapabilities(): GsmCapabilities
}
