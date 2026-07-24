package ai.chatr.gsm.core.compat

import ai.chatr.gsm.core.capability.GsmCapabilities
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TelecomCompatibilityMatrixTest {
    @Test
    fun xiaomiProfileIsConservative() {
        val profile = TelecomCompatibilityMatrix.forManufacturer(
            manufacturer = "Xiaomi",
            capabilities = capabilities(),
        )

        assertEquals(TelecomSupportLevel.RISKY, profile.overlaySupport)
        assertTrue(profile.shouldSuppressOverlayWhenLocked)
    }

    @Test
    fun missingOverlayPermissionOverridesManufacturerSupport() {
        val profile = TelecomCompatibilityMatrix.forManufacturer(
            manufacturer = "Google",
            capabilities = capabilities(supportsOverlay = false),
        )

        assertEquals(TelecomSupportLevel.UNSUPPORTED, profile.overlaySupport)
    }

    private fun capabilities(
        supportsOverlay: Boolean = true,
    ): GsmCapabilities {
        return GsmCapabilities(
            androidVersion = 35,
            hasTelephony = true,
            canRequestDefaultDialerRole = true,
            isDefaultDialer = false,
            supportsCallScreening = true,
            supportsInCallService = true,
            supportsCallRedirection = true,
            supportsOverlay = supportsOverlay,
            supportsAudioEffects = true,
        )
    }
}
