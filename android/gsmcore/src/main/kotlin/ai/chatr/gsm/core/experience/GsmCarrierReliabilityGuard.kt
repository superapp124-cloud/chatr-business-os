package ai.chatr.gsm.core.experience

import android.net.Uri
import android.telecom.PhoneAccountHandle

data class GsmCarrierCallDecision(
    val allowCarrierFlow: Boolean,
    val reason: String,
)

class GsmCarrierReliabilityGuard(
    private val contract: GsmCallExperienceContract = GsmCallExperienceContract.passivePhaseOne,
) {
    fun validateOutgoingCarrierCall(
        handle: Uri?,
        phoneAccountHandle: PhoneAccountHandle?,
    ): GsmCarrierCallDecision {
        if (contract.mayRouteAudioOverInternet || contract.mayModifyCarrierConnection) {
            return GsmCarrierCallDecision(
                allowCarrierFlow = false,
                reason = "Invalid GSM contract: attempted to modify carrier audio path.",
            )
        }

        if (handle?.scheme == "tel" || phoneAccountHandle != null) {
            return GsmCarrierCallDecision(
                allowCarrierFlow = true,
                reason = "Carrier-native call path preserved.",
            )
        }

        return GsmCarrierCallDecision(
            allowCarrierFlow = true,
            reason = "No carrier routing changes requested.",
        )
    }
}
