package ai.chatr.gsm.core.diagnostics

import android.Manifest
import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.GsmFeatureFlagProvider
import ai.chatr.gsm.core.capability.GsmCapabilities
import ai.chatr.gsm.core.compat.TelecomCompatibilityProfile
import ai.chatr.gsm.core.compat.TelecomSupportLevel
import ai.chatr.gsm.core.permissions.GsmPermissionPlan
import ai.chatr.gsm.core.permissions.GsmPermissionRequirement
import ai.chatr.gsm.core.permissions.GsmPermissionStatus
import ai.chatr.gsm.core.telecom.BoundedInMemoryTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GsmDormantShipVerifierTest {
    @Test
    fun staticDormantFlagsAreSafeForInternalQaShip() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        val verifier = GsmDormantShipVerifier(recorder = recorder, now = { 1_000L })

        val report = verifier.verify(
            reason = "qa_build",
            capabilityReport = capabilityReport(),
        )

        assertTrue(report.readyToShipDormant)
        assertTrue(report.blockers.isEmpty())
        assertTrue(report.activationDecisions.all { !it.allowed })
        assertTrue(recorder.snapshot().any { it.type == TelecomRecordedEventType.DORMANT_SHIP_VERIFIED })
    }

    @Test
    fun anyEnabledGsmFlagBlocksDormantShip() {
        val verifier = GsmDormantShipVerifier(
            flags = object : GsmFeatureFlagProvider {
                override fun isEnabled(feature: GsmFeature): Boolean {
                    return feature == GsmFeature.PASSIVE_CALL_OBSERVATION
                }
            },
        )

        val report = verifier.verify("bad_flag")

        assertFalse(report.readyToShipDormant)
        assertTrue(GsmDormantShipBlocker.FEATURE_FLAG_ENABLED in report.blockers)
        assertTrue(GsmDormantShipBlocker.TELECOM_OBSERVATION_ENABLED in report.blockers)
    }

    @Test
    fun aiAudioOrRecordingFlagsBlockDormantShipExplicitly() {
        val verifier = GsmDormantShipVerifier(
            flags = object : GsmFeatureFlagProvider {
                override fun isEnabled(feature: GsmFeature): Boolean {
                    return feature == GsmFeature.AI || feature == GsmFeature.RECORDING
                }
            },
        )

        val report = verifier.verify("bad_ai")

        assertFalse(report.readyToShipDormant)
        assertTrue(GsmDormantShipBlocker.AI_OR_AUDIO_ENABLED in report.blockers)
        assertTrue(GsmDormantShipBlocker.RECORDING_ENABLED in report.blockers)
    }

    private fun capabilityReport(): GsmCapabilityReport {
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
                    GsmPermissionRequirement(
                        permission = Manifest.permission.READ_CONTACTS,
                        plainLanguageReason = "Recognize contacts.",
                        status = GsmPermissionStatus.GRANTED,
                    ),
                ),
            ),
            batteryOptimizationIgnored = true,
            foregroundServiceRestrictionsLikely = false,
            generatedAtMillis = 1L,
        )
    }
}
