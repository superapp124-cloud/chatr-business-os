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
import ai.chatr.gsm.core.safety.GsmSafeMode
import ai.chatr.gsm.core.safety.GsmSafeModeTrigger
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeviceReadinessValidatorTest {
    @Test
    fun pixelAndroid15WithPermissionsIsReady() {
        val validator = DeviceReadinessValidator()

        val report = validator.validate(
            reason = "pixel",
            report = report(),
            requiredFeatures = setOf(GsmFeature.PASSIVE_CALL_OBSERVATION, GsmFeature.OVERLAY),
        )

        assertTrue(report.ready)
        assertTrue(report.blockers.isEmpty())
        assertTrue(report.failClosed)
    }

    @Test
    fun unknownOrDelayedOemFailsClosedBeforeActivation() {
        val validator = DeviceReadinessValidator()

        val report = validator.validate(
            reason = "xiaomi",
            report = report(
                manufacturer = "Xiaomi",
                overlay = TelecomSupportLevel.RISKY,
                battery = TelecomSupportLevel.RISKY,
            ),
            requiredFeatures = setOf(GsmFeature.OVERLAY),
        )

        assertFalse(report.ready)
        assertTrue(DeviceReadinessBlocker.OEM_NOT_ALLOWLISTED in report.blockers)
        assertTrue(DeviceReadinessBlocker.OVERLAY_NOT_VERIFIED in report.blockers)
        assertTrue(DeviceReadinessBlocker.BATTERY_RESTRICTION_RISK in report.blockers)
    }

    @Test
    fun safeModeBlocksReadinessUntilManualReenable() {
        val safeMode = GsmSafeMode()
        safeMode.enter(
            trigger = GsmSafeModeTrigger.DEADMAN_SWITCH,
            reason = "deadman",
        )
        val validator = DeviceReadinessValidator(safeMode = safeMode)

        val report = validator.validate(
            reason = "safe_mode",
            report = report(),
            requiredFeatures = setOf(GsmFeature.PASSIVE_CALL_OBSERVATION),
        )

        assertFalse(report.ready)
        assertTrue(DeviceReadinessBlocker.SAFE_MODE_ACTIVE in report.blockers)
    }

    private fun report(
        manufacturer: String = "Google",
        androidSdk: Int = 35,
        overlay: TelecomSupportLevel = TelecomSupportLevel.FULL,
        battery: TelecomSupportLevel = TelecomSupportLevel.FULL,
        permissionPlan: GsmPermissionPlan = permissionPlan(),
    ): GsmCapabilityReport {
        return GsmCapabilityReport(
            capabilities = GsmCapabilities(
                androidVersion = androidSdk,
                hasTelephony = true,
                canRequestDefaultDialerRole = true,
                isDefaultDialer = true,
                supportsCallScreening = true,
                supportsInCallService = true,
                supportsCallRedirection = true,
                supportsOverlay = overlay != TelecomSupportLevel.UNSUPPORTED,
                supportsAudioEffects = true,
            ),
            compatibilityProfile = TelecomCompatibilityProfile(
                manufacturer = manufacturer,
                overlaySupport = overlay,
                callScreeningSupport = TelecomSupportLevel.FULL,
                roleBehavior = TelecomSupportLevel.FULL,
                lockscreenBehavior = TelecomSupportLevel.FULL,
                batteryRestrictionRisk = battery,
                shouldUseHeadsUpOnlyOnLockscreen = false,
                shouldSuppressOverlayWhenLocked = false,
                notes = emptyList(),
            ),
            permissionPlan = permissionPlan,
            batteryOptimizationIgnored = true,
            foregroundServiceRestrictionsLikely = false,
            generatedAtMillis = 1L,
        )
    }

    private fun permissionPlan(): GsmPermissionPlan {
        return GsmPermissionPlan(
            defaultDialerNeeded = false,
            requirements = listOf(
                GsmPermissionRequirement(
                    permission = Manifest.permission.READ_PHONE_STATE,
                    plainLanguageReason = "Detect normal SIM calls.",
                    status = GsmPermissionStatus.GRANTED,
                ),
                GsmPermissionRequirement(
                    permission = Manifest.permission.READ_CONTACTS,
                    plainLanguageReason = "Recognize saved contacts.",
                    status = GsmPermissionStatus.GRANTED,
                ),
            ),
        )
    }
}
