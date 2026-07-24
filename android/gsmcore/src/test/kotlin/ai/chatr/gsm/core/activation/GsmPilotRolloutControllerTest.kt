package ai.chatr.gsm.core.activation

import android.Manifest
import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.capability.GsmCapabilities
import ai.chatr.gsm.core.compat.TelecomCompatibilityProfile
import ai.chatr.gsm.core.compat.TelecomSupportLevel
import ai.chatr.gsm.core.diagnostics.GsmCapabilityReport
import ai.chatr.gsm.core.permissions.GsmPermissionPlan
import ai.chatr.gsm.core.permissions.GsmPermissionRequirement
import ai.chatr.gsm.core.permissions.GsmPermissionStatus
import ai.chatr.gsm.core.telecom.TelecomReliabilityComponents
import ai.chatr.gsm.core.telecom.TelecomReliabilityGrade
import ai.chatr.gsm.core.telecom.TelecomReliabilityScoreReport
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GsmPilotRolloutControllerTest {
    @Test
    fun pixelAndroid15AllowedWhenRolloutAndHealthPass() {
        val controller = StaticGsmPilotRolloutController(
            identity = identity(),
            rules = rules(percent = 100),
        )

        val decision = controller.evaluate(GsmFeature.OVERLAY, report())

        assertTrue(decision.allowed)
        assertEquals(GsmPilotRolloutReason.ALLOWED, decision.reason)
    }

    @Test
    fun android12IsBlockedForInitialPilot() {
        val controller = StaticGsmPilotRolloutController(
            identity = identity(androidSdk = 31),
            rules = rules(percent = 100),
        )

        val decision = controller.evaluate(
            GsmFeature.PASSIVE_CALL_OBSERVATION,
            report(androidSdk = 31),
        )

        assertFalse(decision.allowed)
        assertEquals(GsmPilotRolloutReason.ANDROID_VERSION_NOT_APPROVED, decision.reason)
    }

    @Test
    fun lowReliabilityScoreRollsBackPilot() {
        val controller = StaticGsmPilotRolloutController(
            identity = identity(),
            rules = rules(percent = 100),
            healthProvider = {
                GsmPilotHealthSnapshot(
                    reliabilityScore = reliability(score = 62),
                )
            },
        )

        val decision = controller.evaluate(GsmFeature.OVERLAY, report())

        assertFalse(decision.allowed)
        assertEquals(GsmPilotRolloutReason.RELIABILITY_SCORE_ROLLBACK, decision.reason)
    }

    private fun rules(percent: Int): GsmPilotRolloutRules {
        return GsmPilotRolloutRules(
            enabled = true,
            allowedManufacturerFamilies = setOf("Pixel", "Samsung"),
            allowedAndroidSdks = setOf(34, 35),
            rolloutPercentage = percent,
        )
    }

    private fun identity(androidSdk: Int = 35): DogfoodDeviceIdentity {
        return DogfoodDeviceIdentity(
            manufacturer = "Google",
            model = "Pixel 9",
            androidSdk = androidSdk,
            buildType = "internal",
            deviceKeyHash = "pilot-device",
            engineerGroup = "qa",
        )
    }

    private fun report(androidSdk: Int = 35): GsmCapabilityReport {
        return GsmCapabilityReport(
            capabilities = GsmCapabilities(
                androidVersion = androidSdk,
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
                manufacturer = "Google",
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
                requirements = listOf(
                    GsmPermissionRequirement(
                        permission = Manifest.permission.READ_PHONE_STATE,
                        plainLanguageReason = "Detect normal SIM calls.",
                        status = GsmPermissionStatus.GRANTED,
                    ),
                ),
            ),
            batteryOptimizationIgnored = true,
            foregroundServiceRestrictionsLikely = false,
            generatedAtMillis = 1L,
        )
    }

    private fun reliability(score: Int): TelecomReliabilityScoreReport {
        return TelecomReliabilityScoreReport(
            score = score,
            grade = TelecomReliabilityGrade.UNSTABLE,
            shouldAutoDisable = true,
            concerns = emptySet(),
            components = TelecomReliabilityComponents(
                cleanupCorrectness = score,
                overlayLatency = score,
                callbackStability = score,
                memoryHealth = score,
                watchdogStability = score,
                oemStability = score,
            ),
            overlayAttachP95Millis = 100L,
            watchdogInterventionCount = 0,
            callbackIssueCount = 0,
            cleanupFailureCount = 0,
        )
    }
}
