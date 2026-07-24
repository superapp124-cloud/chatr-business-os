package ai.chatr.gsm.core.activation

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.compat.OemTelecomBehaviorProfiles
import ai.chatr.gsm.core.diagnostics.GsmCapabilityReport
import ai.chatr.gsm.core.telecom.NoOpTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEvent
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import ai.chatr.gsm.core.telecom.TelecomReliabilityScoreReport
import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink
import java.security.MessageDigest
import kotlin.math.absoluteValue

enum class GsmPilotRolloutReason {
    ALLOWED,
    PILOT_DISABLED,
    FEATURE_NOT_ALLOWED,
    OEM_NOT_APPROVED,
    ANDROID_VERSION_NOT_APPROVED,
    ROLLOUT_BUCKET_EXCLUDED,
    CRASH_RATE_ROLLBACK,
    LATENCY_ROLLBACK,
    HEALTH_ROLLBACK,
    RELIABILITY_SCORE_ROLLBACK,
}

data class GsmPilotRolloutRules(
    val enabled: Boolean = false,
    val allowedManufacturerFamilies: Set<String> = setOf("Pixel", "Samsung"),
    val allowedAndroidSdks: Set<Int> = setOf(34, 35),
    val allowedFeatures: Set<GsmFeature> = setOf(
        GsmFeature.PASSIVE_CALL_OBSERVATION,
        GsmFeature.SHIELD,
        GsmFeature.CALL_SCREENING,
        GsmFeature.OVERLAY,
    ),
    val rolloutPercentage: Int = 0,
    val featureRolloutPercentages: Map<GsmFeature, Int> = emptyMap(),
    val minimumCrashFreeRate: Float = 0.995f,
    val minimumReliabilityScore: Int = 80,
    val maxOverlayAttachP95Millis: Long = 180L,
) {
    companion object {
        fun pixelAndSamsungInternal(percent: Int = 5): GsmPilotRolloutRules {
            return GsmPilotRolloutRules(
                enabled = true,
                allowedManufacturerFamilies = setOf("Pixel", "Samsung"),
                rolloutPercentage = percent.coerceIn(0, 100),
            )
        }
    }
}

data class GsmPilotHealthSnapshot(
    val crashFreeRate: Float = 1.0f,
    val telecomHealthHealthy: Boolean = true,
    val memoryHealthy: Boolean = true,
    val reliabilityScore: TelecomReliabilityScoreReport? = null,
    val overlayAttachP95Millis: Long? = null,
)

data class GsmPilotRolloutDecision(
    val allowed: Boolean,
    val reason: GsmPilotRolloutReason,
    val feature: GsmFeature,
    val manufacturerFamily: String,
    val androidSdk: Int,
    val rolloutBucket: Int,
    val rolloutPercentage: Int,
)

interface GsmPilotRolloutController {
    fun evaluate(
        feature: GsmFeature,
        report: GsmCapabilityReport,
    ): GsmPilotRolloutDecision
}

object DisabledGsmPilotRolloutController : GsmPilotRolloutController {
    override fun evaluate(
        feature: GsmFeature,
        report: GsmCapabilityReport,
    ): GsmPilotRolloutDecision {
        val profile = OemTelecomBehaviorProfiles.forManufacturer(report.compatibilityProfile.manufacturer)
        return GsmPilotRolloutDecision(
            allowed = false,
            reason = GsmPilotRolloutReason.PILOT_DISABLED,
            feature = feature,
            manufacturerFamily = profile.manufacturerFamily,
            androidSdk = report.capabilities.androidVersion,
            rolloutBucket = 100,
            rolloutPercentage = 0,
        )
    }
}

object PermissiveGsmPilotRolloutController : GsmPilotRolloutController {
    override fun evaluate(
        feature: GsmFeature,
        report: GsmCapabilityReport,
    ): GsmPilotRolloutDecision {
        val profile = OemTelecomBehaviorProfiles.forManufacturer(report.compatibilityProfile.manufacturer)
        return GsmPilotRolloutDecision(
            allowed = true,
            reason = GsmPilotRolloutReason.ALLOWED,
            feature = feature,
            manufacturerFamily = profile.manufacturerFamily,
            androidSdk = report.capabilities.androidVersion,
            rolloutBucket = 0,
            rolloutPercentage = 100,
        )
    }
}

class StaticGsmPilotRolloutController(
    private val identity: DogfoodDeviceIdentity,
    private val rules: GsmPilotRolloutRules,
    private val healthProvider: () -> GsmPilotHealthSnapshot = { GsmPilotHealthSnapshot() },
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) : GsmPilotRolloutController {
    override fun evaluate(
        feature: GsmFeature,
        report: GsmCapabilityReport,
    ): GsmPilotRolloutDecision {
        val profile = OemTelecomBehaviorProfiles.forManufacturer(report.compatibilityProfile.manufacturer)
        val health = healthProvider()
        val percentage = rules.featureRolloutPercentages[feature]
            ?: rules.rolloutPercentage
        val bucket = rolloutBucket(identity, report)
        val reason = when {
            !rules.enabled -> GsmPilotRolloutReason.PILOT_DISABLED
            feature !in rules.allowedFeatures -> GsmPilotRolloutReason.FEATURE_NOT_ALLOWED
            profile.manufacturerFamily !in rules.allowedManufacturerFamilies -> GsmPilotRolloutReason.OEM_NOT_APPROVED
            report.capabilities.androidVersion !in rules.allowedAndroidSdks -> GsmPilotRolloutReason.ANDROID_VERSION_NOT_APPROVED
            bucket >= percentage.coerceIn(0, 100) -> GsmPilotRolloutReason.ROLLOUT_BUCKET_EXCLUDED
            health.crashFreeRate < rules.minimumCrashFreeRate -> GsmPilotRolloutReason.CRASH_RATE_ROLLBACK
            health.overlayAttachP95Millis?.let { it > rules.maxOverlayAttachP95Millis } == true ->
                GsmPilotRolloutReason.LATENCY_ROLLBACK
            health.telecomHealthHealthy.not() || health.memoryHealthy.not() -> GsmPilotRolloutReason.HEALTH_ROLLBACK
            (health.reliabilityScore?.score ?: 100) < rules.minimumReliabilityScore ->
                GsmPilotRolloutReason.RELIABILITY_SCORE_ROLLBACK
            health.reliabilityScore?.shouldAutoDisable == true -> GsmPilotRolloutReason.RELIABILITY_SCORE_ROLLBACK
            else -> GsmPilotRolloutReason.ALLOWED
        }

        val decision = GsmPilotRolloutDecision(
            allowed = reason == GsmPilotRolloutReason.ALLOWED,
            reason = reason,
            feature = feature,
            manufacturerFamily = profile.manufacturerFamily,
            androidSdk = report.capabilities.androidVersion,
            rolloutBucket = bucket,
            rolloutPercentage = percentage.coerceIn(0, 100),
        )
        record(decision)
        return decision
    }

    private fun rolloutBucket(
        identity: DogfoodDeviceIdentity,
        report: GsmCapabilityReport,
    ): Int {
        val key = identity.deviceKeyHash
            ?: listOf(
                identity.manufacturer,
                identity.model,
                identity.androidSdk.toString(),
                identity.buildType,
                report.compatibilityProfile.manufacturer,
            ).joinToString(":")
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(key.toByteArray())
        val firstInt = digest.take(4).fold(0) { acc, byte ->
            (acc shl 8) or (byte.toInt() and 0xff)
        }
        return firstInt.absoluteValue % 100
    }

    private fun record(decision: GsmPilotRolloutDecision) {
        val attributes = mapOf(
            "feature" to decision.feature.name,
            "allowed" to decision.allowed.toString(),
            "reason" to decision.reason.name,
            "oem" to decision.manufacturerFamily,
            "android_sdk" to decision.androidSdk.toString(),
            "rollout_bucket" to decision.rolloutBucket.toString(),
            "rollout_percentage" to decision.rolloutPercentage.toString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.PILOT_ROLLOUT_DECISION,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_2a_internal_telecom_pilot",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.PILOT_ROLLOUT_DECISION,
                attributes = attributes,
            ),
        )
    }
}
