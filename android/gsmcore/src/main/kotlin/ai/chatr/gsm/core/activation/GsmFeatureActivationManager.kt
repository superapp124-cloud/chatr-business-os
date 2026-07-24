package ai.chatr.gsm.core.activation

import android.content.Context
import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.GsmFeatureFlagProvider
import ai.chatr.gsm.core.StaticGsmFeatureFlagProvider
import ai.chatr.gsm.core.compat.TelecomSupportLevel
import ai.chatr.gsm.core.diagnostics.GsmCapabilityReport
import ai.chatr.gsm.core.diagnostics.GsmCapabilityReportGenerator
import ai.chatr.gsm.core.permissions.GsmPermissionStatus
import ai.chatr.gsm.core.safety.GsmSafetyGate
import ai.chatr.gsm.core.safety.RemoteConfigGsmSafety
import ai.chatr.gsm.core.safety.DisabledRemoteConfigGsmSafety
import ai.chatr.gsm.core.safety.GsmSafetyRecoveryManager
import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class GsmActivationStage {
    OFF,
    PASSIVE_OBSERVATION,
    SHIELD_VERDICT,
    PASSIVE_OVERLAY,
    CHATR_PEER_ENRICHMENT,
}

enum class GsmActivationDecisionReason {
    ALLOWED,
    STATIC_FLAG_DISABLED,
    USER_NOT_OPTED_IN,
    STAGE_NOT_REACHED,
    REMOTE_KILL_SWITCH,
    TELEPHONY_UNAVAILABLE,
    UNSUPPORTED_ANDROID_VERSION,
    PERMISSION_MISSING,
    OEM_DELAYED,
    OVERLAY_UNSUPPORTED,
    LOCKSCREEN_RISK,
    BATTERY_RESTRICTION_RISK,
    FEATURE_DEFERRED,
    SAFETY_RECOVERY_DISABLED,
    DOGFOOD_NOT_ALLOWED,
    PILOT_NOT_ALLOWED,
    DEVICE_NOT_READY,
}

data class GsmUserActivationState(
    val optedIn: Boolean = false,
    val requestedStage: GsmActivationStage = GsmActivationStage.OFF,
    val passiveOverlayEnabled: Boolean = false,
    val spamProtectionEnabled: Boolean = false,
    val peerEnrichmentEnabled: Boolean = false,
)

data class GsmActivationDecision(
    val allowed: Boolean,
    val reason: GsmActivationDecisionReason,
    val stage: GsmActivationStage,
    val feature: GsmFeature,
)

interface GsmUserActivationStore {
    fun current(): GsmUserActivationState
}

object DisabledGsmUserActivationStore : GsmUserActivationStore {
    override fun current(): GsmUserActivationState = GsmUserActivationState()
}

class InMemoryGsmUserActivationStore(
    private var state: GsmUserActivationState = GsmUserActivationState(),
) : GsmUserActivationStore {
    override fun current(): GsmUserActivationState = state

    fun update(state: GsmUserActivationState) {
        this.state = state
    }
}

class GsmFeatureActivationManager(
    private val flags: GsmFeatureFlagProvider = StaticGsmFeatureFlagProvider,
    private val activationStore: GsmUserActivationStore = DisabledGsmUserActivationStore,
    private val reportGenerator: GsmCapabilityReportGenerator = GsmCapabilityReportGenerator(),
    remoteConfig: RemoteConfigGsmSafety = DisabledRemoteConfigGsmSafety,
    private val recoveryManager: GsmSafetyRecoveryManager = GsmSafetyRecoveryManager(),
    private val dogfoodActivationPolicy: DogfoodActivationPolicy = DisabledDogfoodActivationPolicy,
    private val pilotRolloutController: GsmPilotRolloutController = DisabledGsmPilotRolloutController,
    private val deviceReadinessValidator: DeviceReadinessValidator = DeviceReadinessValidator(
        recoveryManager = recoveryManager,
    ),
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
) {
    private val safetyGate = GsmSafetyGate(remoteConfig)

    fun canActivate(context: Context, feature: GsmFeature): GsmActivationDecision {
        val report = reportGenerator.generate(context)
        return canActivate(feature, activationStore.current(), report)
    }

    fun canActivate(
        feature: GsmFeature,
        userState: GsmUserActivationState,
        report: GsmCapabilityReport,
    ): GsmActivationDecision {
        val stage = feature.requiredStage()
        val decision = evaluate(feature, stage, userState, report)
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.ACTIVATION_DECISION,
                attributes = mapOf(
                    "feature" to feature.name,
                    "allowed" to decision.allowed.toString(),
                    "reason" to decision.reason.name,
                    "stage" to decision.stage.name,
                    "oem" to report.compatibilityProfile.manufacturer,
                    "android_sdk" to report.capabilities.androidVersion.toString(),
                ),
            ),
        )
        return decision
    }

    fun activationPlan(
        userState: GsmUserActivationState,
        report: GsmCapabilityReport,
    ): List<GsmActivationDecision> {
        return listOf(
            GsmFeature.PASSIVE_CALL_OBSERVATION,
            GsmFeature.SHIELD,
            GsmFeature.OVERLAY,
            GsmFeature.GSM_INTELLIGENCE,
        ).map { feature ->
            canActivate(feature, userState, report)
        }
    }

    private fun evaluate(
        feature: GsmFeature,
        stage: GsmActivationStage,
        userState: GsmUserActivationState,
        report: GsmCapabilityReport,
    ): GsmActivationDecision {
        if (!flags.isEnabled(GsmFeature.GSM_INTELLIGENCE) || !flags.isEnabled(feature)) {
            return deny(feature, stage, GsmActivationDecisionReason.STATIC_FLAG_DISABLED)
        }
        if (!userState.optedIn) {
            return deny(feature, stage, GsmActivationDecisionReason.USER_NOT_OPTED_IN)
        }
        if (userState.requestedStage.ordinal < stage.ordinal) {
            return deny(feature, stage, GsmActivationDecisionReason.STAGE_NOT_REACHED)
        }

        val safety = safetyGate.check(feature.safetyKey(), report.compatibilityProfile.manufacturer)
        if (!safety.allowed) {
            return deny(feature, stage, GsmActivationDecisionReason.REMOTE_KILL_SWITCH)
        }
        val dogfoodDecision = dogfoodActivationPolicy.evaluate(feature, report)
        if (!dogfoodDecision.allowed) {
            return deny(feature, stage, GsmActivationDecisionReason.DOGFOOD_NOT_ALLOWED)
        }
        val pilotDecision = pilotRolloutController.evaluate(feature, report)
        if (!pilotDecision.allowed) {
            return deny(feature, stage, GsmActivationDecisionReason.PILOT_NOT_ALLOWED)
        }
        if (recoveryManager.isFeatureAutoDisabled(feature)) {
            return deny(feature, stage, GsmActivationDecisionReason.SAFETY_RECOVERY_DISABLED)
        }

        if (!report.capabilities.hasTelephony) {
            return deny(feature, stage, GsmActivationDecisionReason.TELEPHONY_UNAVAILABLE)
        }
        if (report.capabilities.androidVersion < 24) {
            return deny(feature, stage, GsmActivationDecisionReason.UNSUPPORTED_ANDROID_VERSION)
        }

        if (feature == GsmFeature.SHIELD && !userState.spamProtectionEnabled) {
            return deny(feature, stage, GsmActivationDecisionReason.USER_NOT_OPTED_IN)
        }
        if (feature == GsmFeature.OVERLAY && !userState.passiveOverlayEnabled) {
            return deny(feature, stage, GsmActivationDecisionReason.USER_NOT_OPTED_IN)
        }
        if (feature == GsmFeature.GSM_INTELLIGENCE && !userState.peerEnrichmentEnabled) {
            return deny(feature, stage, GsmActivationDecisionReason.USER_NOT_OPTED_IN)
        }

        if (feature == GsmFeature.AI ||
            feature == GsmFeature.TRANSCRIPTION ||
            feature == GsmFeature.RECORDING
        ) {
            return deny(feature, stage, GsmActivationDecisionReason.FEATURE_DEFERRED)
        }

        if (report.compatibilityProfile.batteryRestrictionRisk == TelecomSupportLevel.RISKY &&
            feature == GsmFeature.OVERLAY
        ) {
            return deny(feature, stage, GsmActivationDecisionReason.BATTERY_RESTRICTION_RISK)
        }

        if (feature == GsmFeature.OVERLAY) {
            if (report.compatibilityProfile.overlaySupport == TelecomSupportLevel.UNSUPPORTED) {
                return deny(feature, stage, GsmActivationDecisionReason.OVERLAY_UNSUPPORTED)
            }
            if (report.compatibilityProfile.overlaySupport == TelecomSupportLevel.RISKY) {
                return deny(feature, stage, GsmActivationDecisionReason.OEM_DELAYED)
            }
            if (report.compatibilityProfile.shouldSuppressOverlayWhenLocked) {
                return deny(feature, stage, GsmActivationDecisionReason.LOCKSCREEN_RISK)
            }
        }

        if (feature == GsmFeature.PASSIVE_CALL_OBSERVATION &&
            report.permissionPlan.defaultDialerNeeded
        ) {
            return deny(feature, stage, GsmActivationDecisionReason.PERMISSION_MISSING)
        }

        val requiredPermissions = feature.requiredRuntimePermissions()
        val missingRuntimePermissions = report.permissionPlan.requirements
            .filter { it.permission in requiredPermissions }
            .filter { it.status == GsmPermissionStatus.MISSING }
        if (missingRuntimePermissions.isNotEmpty()) {
            return deny(feature, stage, GsmActivationDecisionReason.PERMISSION_MISSING)
        }

        val readiness = deviceReadinessValidator.validate(
            reason = "activation_${feature.name.lowercase()}",
            report = report,
            requiredFeatures = setOf(feature),
        )
        if (!readiness.ready) {
            return deny(feature, stage, GsmActivationDecisionReason.DEVICE_NOT_READY)
        }

        return GsmActivationDecision(
            allowed = true,
            reason = GsmActivationDecisionReason.ALLOWED,
            stage = stage,
            feature = feature,
        )
    }

    private fun deny(
        feature: GsmFeature,
        stage: GsmActivationStage,
        reason: GsmActivationDecisionReason,
    ): GsmActivationDecision {
        return GsmActivationDecision(
            allowed = false,
            reason = reason,
            stage = stage,
            feature = feature,
        )
    }

    private fun GsmFeature.requiredStage(): GsmActivationStage {
        return when (this) {
            GsmFeature.PASSIVE_CALL_OBSERVATION -> GsmActivationStage.PASSIVE_OBSERVATION
            GsmFeature.SHIELD,
            GsmFeature.CALL_SCREENING -> GsmActivationStage.SHIELD_VERDICT
            GsmFeature.OVERLAY -> GsmActivationStage.PASSIVE_OVERLAY
            GsmFeature.GSM_INTELLIGENCE -> GsmActivationStage.CHATR_PEER_ENRICHMENT
            GsmFeature.SMART_DIALER,
            GsmFeature.AI,
            GsmFeature.TRANSCRIPTION,
            GsmFeature.RECORDING -> GsmActivationStage.OFF
        }
    }

    private fun GsmFeature.safetyKey(): String {
        return when (this) {
            GsmFeature.OVERLAY -> "overlay"
            GsmFeature.SHIELD,
            GsmFeature.CALL_SCREENING -> "shield"
            GsmFeature.GSM_INTELLIGENCE -> "metadata"
            GsmFeature.PASSIVE_CALL_OBSERVATION -> "passive_observation"
            else -> name.lowercase()
        }
    }

    private fun GsmFeature.requiredRuntimePermissions(): Set<String> {
        return when (this) {
            GsmFeature.PASSIVE_CALL_OBSERVATION -> setOf(
                android.Manifest.permission.READ_PHONE_STATE,
            )
            GsmFeature.SHIELD,
            GsmFeature.CALL_SCREENING,
            GsmFeature.OVERLAY -> setOf(
                android.Manifest.permission.READ_PHONE_STATE,
                android.Manifest.permission.READ_CONTACTS,
            )
            GsmFeature.GSM_INTELLIGENCE -> setOf(
                android.Manifest.permission.READ_PHONE_STATE,
                android.Manifest.permission.READ_CONTACTS,
            )
            GsmFeature.AI,
            GsmFeature.TRANSCRIPTION -> setOf(
                android.Manifest.permission.READ_PHONE_STATE,
                android.Manifest.permission.RECORD_AUDIO,
            )
            GsmFeature.RECORDING -> setOf(
                android.Manifest.permission.READ_PHONE_STATE,
                android.Manifest.permission.RECORD_AUDIO,
            )
            GsmFeature.SMART_DIALER -> setOf(
                android.Manifest.permission.READ_CONTACTS,
                android.Manifest.permission.READ_CALL_LOG,
            )
        }
    }
}
