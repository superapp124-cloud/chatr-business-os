package ai.chatr.gsm.core.compat

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Test

class OemTelecomBehaviorProfilesTest {
    @Test
    fun pixelIsReferenceDogfoodProfile() {
        val profile = OemTelecomBehaviorProfiles.forManufacturer("Google")

        assertEquals(OemRolloutTier.PIXEL_REFERENCE, profile.rolloutTier)
        assertTrue(profile.allowInternalDogfood)
        assertFalse(profile.suppressOverlayOnLockscreen)
    }

    @Test
    fun xiaomiIsDelayedAndConservative() {
        val profile = OemTelecomBehaviorProfiles.forManufacturer("Xiaomi")

        assertEquals(OemRolloutTier.DELAYED_VALIDATION, profile.rolloutTier)
        assertFalse(profile.allowInternalDogfood)
        assertTrue(profile.suppressOverlayOnLockscreen)
        assertTrue(profile.requiresBatteryEducation)
    }
}
