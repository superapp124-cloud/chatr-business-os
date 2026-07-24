package ai.chatr.gsm.core.activation

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.capability.GsmCapabilities
import ai.chatr.gsm.core.compat.TelecomCompatibilityProfile
import ai.chatr.gsm.core.compat.TelecomSupportLevel
import ai.chatr.gsm.core.diagnostics.GsmCapabilityReport
import ai.chatr.gsm.core.permissions.GsmPermissionPlan
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DogfoodActivationPolicyTest {
    @Test
    fun pixelDebugEngineerCanDogfoodPassiveOverlay() {
        val policy = StaticDogfoodActivationPolicy(
            identity = DogfoodDeviceIdentity(
                manufacturer = "Google",
                model = "Pixel 8",
                androidSdk = 35,
                buildType = "debug",
                engineerGroup = "qa",
            ),
            optIn = DogfoodEngineerOptIn(optedIn = true, acceptedRiskAtMillis = 1L),
            rules = DogfoodActivationRules.pixelOnly(),
        )

        val decision = policy.evaluate(GsmFeature.OVERLAY, report("Google"))

        assertTrue(decision.allowed)
        assertEquals(DogfoodActivationReason.ALLOWED, decision.reason)
    }

    @Test
    fun samsungOnlyPolicyRejectsPixel() {
        val policy = StaticDogfoodActivationPolicy(
            identity = DogfoodDeviceIdentity(
                manufacturer = "Google",
                model = "Pixel 8",
                androidSdk = 35,
                buildType = "debug",
            ),
            optIn = DogfoodEngineerOptIn(optedIn = true, acceptedRiskAtMillis = 1L),
            rules = DogfoodActivationRules.samsungOnly(),
        )

        val decision = policy.evaluate(GsmFeature.OVERLAY, report("Google"))

        assertFalse(decision.allowed)
        assertEquals(DogfoodActivationReason.OEM_NOT_ALLOWED, decision.reason)
    }

    @Test
    fun xiaomiIsBlockedEvenWhenRulesIncludeManufacturer() {
        val policy = StaticDogfoodActivationPolicy(
            identity = DogfoodDeviceIdentity(
                manufacturer = "Xiaomi",
                model = "Test",
                androidSdk = 35,
                buildType = "debug",
            ),
            optIn = DogfoodEngineerOptIn(optedIn = true, acceptedRiskAtMillis = 1L),
            rules = DogfoodActivationRules(
                enabled = true,
                allowedManufacturerFamilies = setOf("Xiaomi"),
            ),
        )

        val decision = policy.evaluate(GsmFeature.OVERLAY, report("Xiaomi"))

        assertFalse(decision.allowed)
        assertEquals(DogfoodActivationReason.OEM_PROFILE_BLOCKED, decision.reason)
    }

    private fun report(manufacturer: String): GsmCapabilityReport {
        return GsmCapabilityReport(
            capabilities = GsmCapabilities(
                androidVersion = 35,
                hasTelephony = true,
                canRequestDefaultDialerRole = true,
                isDefaultDialer = true,
                supportsCallScreening = true,
                supportsInCallService = true,
                supportsCallRedirection = true,
                supportsOverlay = true,
                supportsAudioEffects = true,
            ),
            compatibilityProfile = TelecomCompatibilityProfile(
                manufacturer = manufacturer,
                overlaySupport = TelecomSupportLevel.FULL,
                callScreeningSupport = TelecomSupportLevel.FULL,
                roleBehavior = TelecomSupportLevel.FULL,
                lockscreenBehavior = TelecomSupportLevel.FULL,
                batteryRestrictionRisk = TelecomSupportLevel.FULL,
                shouldUseHeadsUpOnlyOnLockscreen = false,
                shouldSuppressOverlayWhenLocked = false,
                notes = emptyList(),
            ),
            permissionPlan = GsmPermissionPlan(
                defaultDialerNeeded = false,
                requirements = emptyList(),
            ),
            batteryOptimizationIgnored = true,
            foregroundServiceRestrictionsLikely = false,
            generatedAtMillis = 1L,
        )
    }
}
