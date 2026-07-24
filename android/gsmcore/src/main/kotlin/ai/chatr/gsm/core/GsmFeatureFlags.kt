package ai.chatr.gsm.core

enum class GsmFeature {
    GSM_INTELLIGENCE,
    SHIELD,
    AI,
    CALL_SCREENING,
    SMART_DIALER,
    TRANSCRIPTION,
    OVERLAY,
    RECORDING,
    PASSIVE_CALL_OBSERVATION,
}

interface GsmFeatureFlagProvider {
    fun isEnabled(feature: GsmFeature): Boolean
}

object StaticGsmFeatureFlagProvider : GsmFeatureFlagProvider {
    override fun isEnabled(feature: GsmFeature): Boolean {
        if (!GsmIntelligenceFlags.enabled) return false

        return when (feature) {
            GsmFeature.GSM_INTELLIGENCE -> GsmIntelligenceFlags.enabled
            GsmFeature.SHIELD -> GsmIntelligenceFlags.shieldEnabled
            GsmFeature.AI -> GsmIntelligenceFlags.aiEnabled
            GsmFeature.CALL_SCREENING -> GsmIntelligenceFlags.callScreeningEnabled
            GsmFeature.SMART_DIALER -> GsmIntelligenceFlags.smartDialerEnabled
            GsmFeature.TRANSCRIPTION -> GsmIntelligenceFlags.transcriptionEnabled
            GsmFeature.OVERLAY -> GsmIntelligenceFlags.overlayEnabled
            GsmFeature.RECORDING -> GsmIntelligenceFlags.recordingEnabled
            GsmFeature.PASSIVE_CALL_OBSERVATION -> GsmIntelligenceFlags.passiveCallObservationEnabled
        }
    }
}
