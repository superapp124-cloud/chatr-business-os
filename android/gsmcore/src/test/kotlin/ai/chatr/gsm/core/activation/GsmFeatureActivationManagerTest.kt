package ai.chatr.gsm.core.activation

import android.Manifest
import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.GsmFeatureFlagProvider
import ai.chatr.gsm.core.capability.GsmCapabilities
import ai.chatr.gsm.core.compat.TelecomCompatibilityProfile
import ai.chatr.gsm.core.compat.TelecomSupportLevel
import ai.chatr.gsm.core.diagnostics.GsmCapabilityReport
import ai.chatr.gsm.core.permissions.GsmPermissionPlan
import ai.chatr.gsm.core.permissions.GsmPermissionRequirement
import ai.chatr.gsm.core.permissions.GsmPermissionStatus
import ai.chatr.gsm.core.safety.RemoteConfigGsmSafetySnapshot
import ai.chatr.gsm.core.safety.StaticRemoteConfigGsmSafety
import ai.chatr.gsm.core.safety.GsmRecoverySignal
import ai.chatr.gsm.core.safety.GsmSafetyRecoveryManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GsmFeatureActivationManagerTest {
    @Test
    fun defaultStaticFlagsKeepGsmDormant() {
        val manager = GsmFeatureActivationManager(remoteConfig = permissiveRemoteConfig())

        val decision = manager.canActivate(
            feature = GsmFeature.PASSIVE_CALL_OBSERVATION,
            userState = optedIn(GsmActivationStage.PASSIVE_OBSERVATION),
            report = report(),
        )

        assertFalse(decision.allowed)
        assertEquals(GsmActivationDecisionReason.STATIC_FLAG_DISABLED, decision.reason)
    }

    @Test
    fun passiveObservationRequiresUserOptIn() {
        val manager = managerWithAllFlagsEnabled()

        val decision = manager.canActivate(
            feature = GsmFeature.PASSIVE_CALL_OBSERVATION,
            userState = GsmUserActivationState(),
            report = report(),
        )

        assertFalse(decision.allowed)
        assertEquals(GsmActivationDecisionReason.USER_NOT_OPTED_IN, decision.reason)
    }

    @Test
    fun passiveObservationActivatesWhenOptedInSafeAndPermitted() {
        val manager = managerWithAllFlagsEnabled()

        val decision = manager.canActivate(
            feature = GsmFeature.PASSIVE_CALL_OBSERVATION,
            userState = optedIn(GsmActivationStage.PASSIVE_OBSERVATION),
            report = report(),
        )

        assertTrue(decision.allowed)
        assertEquals(GsmActivationDecisionReason.ALLOWED, decision.reason)
    }

    @Test
    fun overlayWaitsForOverlayStage() {
        val manager = managerWithAllFlagsEnabled()

        val decision = manager.canActivate(
            feature = GsmFeature.OVERLAY,
            userState = optedIn(
                requestedStage = GsmActivationStage.SHIELD_VERDICT,
                passiveOverlayEnabled = true,
            ),
            report = report(),
        )

        assertFalse(decision.allowed)
        assertEquals(GsmActivationDecisionReason.STAGE_NOT_REACHED, decision.reason)
    }

    @Test
    fun riskyOverlayOemIsDelayed() {
        val manager = managerWithAllFlagsEnabled()

        val decision = manager.canActivate(
            feature = GsmFeature.OVERLAY,
            userState = optedIn(
                requestedStage = GsmActivationStage.PASSIVE_OVERLAY,
                passiveOverlayEnabled = true,
            ),
            report = report(
                compatibilityProfile = compatibility(
                    manufacturer = "Xiaomi",
                    overlay = TelecomSupportLevel.RISKY,
                    battery = TelecomSupportLevel.LIMITED,
                    suppressOverlayWhenLocked = false,
                ),
            ),
        )

        assertFalse(decision.allowed)
        assertEquals(GsmActivationDecisionReason.OEM_DELAYED, decision.reason)
    }

    @Test
    fun missingRuntimePermissionBlocksShieldVerdict() {
        val manager = managerWithAllFlagsEnabled()

        val decision = manager.canActivate(
            feature = GsmFeature.SHIELD,
            userState = optedIn(
                requestedStage = GsmActivationStage.SHIELD_VERDICT,
                spamProtectionEnabled = true,
            ),
            report = report(
                permissionPlan = permissionPlan(
                    GsmPermissionRequirement(
                        permission = Manifest.permission.READ_CONTACTS,
                        plainLanguageReason = "Recognize saved contacts.",
                        status = GsmPermissionStatus.MISSING,
                    ),
                ),
            ),
        )

        assertFalse(decision.allowed)
        assertEquals(GsmActivationDecisionReason.PERMISSION_MISSING, decision.reason)
    }

    @Test
    fun safetyRecoveryDisabledFeatureBlocksActivation() {
        val recoveryManager = GsmSafetyRecoveryManager()
        repeat(3) {
            recoveryManager.report(
                signal = GsmRecoverySignal.OVERLAY_RENDER_FAILURE,
                feature = GsmFeature.OVERLAY,
                reason = "window_failure",
            )
        }
        val manager = GsmFeatureActivationManager(
            flags = object : GsmFeatureFlagProvider {
                override fun isEnabled(feature: GsmFeature): Boolean = true
            },
            remoteConfig = permissiveRemoteConfig(),
            recoveryManager = recoveryManager,
            dogfoodActivationPolicy = PermissiveDogfoodActivationPolicy,
            pilotRolloutController = PermissiveGsmPilotRolloutController,
        )

        val decision = manager.canActivate(
            feature = GsmFeature.OVERLAY,
            userState = optedIn(
                requestedStage = GsmActivationStage.PASSIVE_OVERLAY,
                passiveOverlayEnabled = true,
            ),
            report = report(),
        )

        assertFalse(decision.allowed)
        assertEquals(GsmActivationDecisionReason.SAFETY_RECOVERY_DISABLED, decision.reason)
    }

    private fun managerWithAllFlagsEnabled(): GsmFeatureActivationManager {
        return GsmFeatureActivationManager(
            flags = object : GsmFeatureFlagProvider {
                override fun isEnabled(feature: GsmFeature): Boolean = true
            },
            remoteConfig = permissiveRemoteConfig(),
            dogfoodActivationPolicy = PermissiveDogfoodActivationPolicy,
            pilotRolloutController = PermissiveGsmPilotRolloutController,
        )
    }

    private fun optedIn(
        requestedStage: GsmActivationStage,
        passiveOverlayEnabled: Boolean = false,
        spamProtectionEnabled: Boolean = false,
        peerEnrichmentEnabled: Boolean = false,
    ): GsmUserActivationState {
        return GsmUserActivationState(
            optedIn = true,
            requestedStage = requestedStage,
            passiveOverlayEnabled = passiveOverlayEnabled,
            spamProtectionEnabled = spamProtectionEnabled,
            peerEnrichmentEnabled = peerEnrichmentEnabled,
        )
    }

    private fun permissiveRemoteConfig(): StaticRemoteConfigGsmSafety {
        return StaticRemoteConfigGsmSafety(
            RemoteConfigGsmSafetySnapshot(
                globalDisable = false,
                overlayDisable = false,
                shieldDisable = false,
                metadataEnrichmentDisable = false,
                passiveObservationDisable = false,
            ),
        )
    }

    private fun report(
        compatibilityProfile: TelecomCompatibilityProfile = compatibility(),
        permissionPlan: GsmPermissionPlan = permissionPlan(),
    ): GsmCapabilityReport {
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
            compatibilityProfile = compatibilityProfile,
            permissionPlan = permissionPlan,
            batteryOptimizationIgnored = true,
            foregroundServiceRestrictionsLikely = false,
            generatedAtMillis = 1L,
        )
    }

    private fun compatibility(
        manufacturer: String = "Google",
        overlay: TelecomSupportLevel = TelecomSupportLevel.FULL,
        battery: TelecomSupportLevel = TelecomSupportLevel.FULL,
        suppressOverlayWhenLocked: Boolean = false,
    ): TelecomCompatibilityProfile {
        return TelecomCompatibilityProfile(
            manufacturer = manufacturer,
            overlaySupport = overlay,
            callScreeningSupport = TelecomSupportLevel.FULL,
            roleBehavior = TelecomSupportLevel.FULL,
            lockscreenBehavior = TelecomSupportLevel.FULL,
            batteryRestrictionRisk = battery,
            shouldUseHeadsUpOnlyOnLockscreen = false,
            shouldSuppressOverlayWhenLocked = suppressOverlayWhenLocked,
            notes = emptyList(),
        )
    }

    private fun permissionPlan(
        vararg requirements: GsmPermissionRequirement,
    ): GsmPermissionPlan {
        val effectiveRequirements = requirements.toList().ifEmpty {
            listOf(
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
            )
        }
        return GsmPermissionPlan(
            defaultDialerNeeded = false,
            requirements = effectiveRequirements,
        )
    }
}
