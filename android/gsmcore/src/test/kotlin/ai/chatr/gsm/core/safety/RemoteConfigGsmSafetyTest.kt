package ai.chatr.gsm.core.safety

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RemoteConfigGsmSafetyTest {
    @Test
    fun defaultSnapshotBlocksEverything() {
        val decision = GsmSafetyGate().check("passive_observation", "Google")

        assertFalse(decision.allowed)
        assertEquals(GsmSafetyBlockReason.GLOBAL_KILL_SWITCH, decision.reason)
    }

    @Test
    fun perFeatureOverlayKillSwitchBlocksOnlyOverlay() {
        val gate = GsmSafetyGate(
            StaticRemoteConfigGsmSafety(
                RemoteConfigGsmSafetySnapshot(
                    globalDisable = false,
                    overlayDisable = true,
                    shieldDisable = false,
                    metadataEnrichmentDisable = false,
                    passiveObservationDisable = false,
                ),
            ),
        )

        val overlayDecision = gate.check("overlay", "Google")
        val shieldDecision = gate.check("shield", "Google")

        assertFalse(overlayDecision.allowed)
        assertEquals(GsmSafetyBlockReason.OVERLAY_KILL_SWITCH, overlayDecision.reason)
        assertTrue(shieldDecision.allowed)
    }

    @Test
    fun manufacturerKillSwitchIsCaseInsensitive() {
        val gate = GsmSafetyGate(
            StaticRemoteConfigGsmSafety(
                RemoteConfigGsmSafetySnapshot(
                    globalDisable = false,
                    disabledManufacturers = setOf("Samsung"),
                    overlayDisable = false,
                    shieldDisable = false,
                    metadataEnrichmentDisable = false,
                    passiveObservationDisable = false,
                ),
            ),
        )

        val decision = gate.check("passive_observation", "samsung")

        assertFalse(decision.allowed)
        assertEquals(GsmSafetyBlockReason.OEM_KILL_SWITCH, decision.reason)
    }
}
