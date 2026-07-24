package ai.chatr.gsm.core.experience

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GsmCallExperienceContractTest {
    @Test
    fun passivePhaseOnePreservesCarrierAudio() {
        val contract = GsmCallExperienceContract.passivePhaseOne

        assertFalse(contract.mayRouteAudioOverInternet)
        assertFalse(contract.mayModifyCarrierConnection)
        assertFalse(contract.mayInterceptEmergencyCalls)
        assertTrue(contract.allowedLayers.contains(GsmExperienceLayer.PASSIVE_OVERLAY))
    }
}
