package ai.chatr.gsm.core.experience

enum class GsmAudioPath {
    CARRIER_NATIVE_SIM,
}

enum class GsmExperienceLayer {
    CALLER_IDENTITY,
    SHIELD_TRUST_STATE,
    PASSIVE_OVERLAY,
    AI_INDICATOR,
    SMART_ACTIONS,
    METADATA_HANDSHAKE,
}

data class GsmCallExperienceContract(
    val audioPath: GsmAudioPath = GsmAudioPath.CARRIER_NATIVE_SIM,
    val allowedLayers: Set<GsmExperienceLayer> = emptySet(),
    val mayRouteAudioOverInternet: Boolean = false,
    val mayInterceptEmergencyCalls: Boolean = false,
    val mayModifyCarrierConnection: Boolean = false,
) {
    init {
        require(audioPath == GsmAudioPath.CARRIER_NATIVE_SIM) {
            "GSM intelligence must preserve carrier-native SIM audio."
        }
        require(!mayRouteAudioOverInternet) {
            "GSM intelligence must never silently convert carrier calls into VoIP."
        }
        require(!mayInterceptEmergencyCalls) {
            "GSM intelligence must never intercept emergency call reliability."
        }
        require(!mayModifyCarrierConnection) {
            "GSM intelligence is an experience layer only."
        }
    }

    companion object {
        val passivePhaseOne = GsmCallExperienceContract(
            allowedLayers = setOf(
                GsmExperienceLayer.CALLER_IDENTITY,
                GsmExperienceLayer.SHIELD_TRUST_STATE,
                GsmExperienceLayer.PASSIVE_OVERLAY,
                GsmExperienceLayer.AI_INDICATOR,
                GsmExperienceLayer.SMART_ACTIONS,
            ),
        )
    }
}
