package ai.chatr.gsm.core.activation

import android.Manifest
import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.compat.OemTelecomBehaviorProfiles
import ai.chatr.gsm.core.compat.TelecomSupportLevel
import ai.chatr.gsm.core.diagnostics.GsmCapabilityReport
import ai.chatr.gsm.core.permissions.GsmPermissionStatus
import ai.chatr.gsm.core.safety.GsmSafeMode
import ai.chatr.gsm.core.safety.GsmSafetyRecoveryManager
import ai.chatr.gsm.core.safety.TelecomCrashLoopProtector
import ai.chatr.gsm.core.telecom.NoOpTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEvent
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class DeviceReadinessBlocker {
    SAFE_MODE_ACTIVE,
    CRASH_LOOP_COOLDOWN_ACTIVE,
    OEM_NOT_ALLOWLISTED,
    ANDROID_VERSION_UNSUPPORTED,
    TELEPHONY_UNAVAILABLE,
    DEFAULT_DIALER_REQUIRED,
    RUNTIME_PERMISSION_MISSING,
    BATTERY_RESTRICTION_RISK,
    FOREGROUND_SERVICE_RESTRICTION_RISK,
    OVERLAY_UNSUPPORTED,
    OVERLAY_NOT_VERIFIED,
    CALL_SCREENING_UNSUPPORTED,
    LOCKSCREEN_OVERLAY_RISK,
    SAFETY_RECOVERY_DISABLED,
}

data class DeviceReadinessPolicy(
    val allowedManufacturerFamilies: Set<String> = setOf("Pixel", "Samsung", "OnePlus"),
    val supportedAndroidSdks: Set<Int> = setOf(34, 35),
    val allowLimitedOverlaySupport: Boolean = true,
    val failOnForegroundServiceRestrictionRisk: Boolean = true,
)

data class DeviceReadinessReport(
    val ready: Boolean,
    val failClosed: Boolean,
    val blockers: Set<DeviceReadinessBlocker>,
    val manufacturerFamily: String,
    val androidSdk: Int,
    val requiredFeatures: Set<GsmFeature>,
)

class DeviceReadinessValidator(
    private val safeMode: GsmSafeMode = GsmSafeMode(),
    private val recoveryManager: GsmSafetyRecoveryManager = GsmSafetyRecoveryManager(),
    private val crashLoopProtector: TelecomCrashLoopProtector? = null,
    private val policy: DeviceReadinessPolicy = DeviceReadinessPolicy(),
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun validate(
        reason: String,
        report: GsmCapabilityReport,
        requiredFeatures: Set<GsmFeature>,
    ): DeviceReadinessReport {
        val oemProfile = OemTelecomBehaviorProfiles.forManufacturer(report.compatibilityProfile.manufacturer)
        val requiredPermissions = requiredFeatures.flatMap { it.requiredPermissions() }.toSet()
        val missingRequiredPermissions = report.permissionPlan.requirements.any { requirement ->
            requirement.permission in requiredPermissions &&
                requirement.status == GsmPermissionStatus.MISSING
        }
        val blockers = buildSet {
            if (safeMode.isActive()) add(DeviceReadinessBlocker.SAFE_MODE_ACTIVE)
            if (crashLoopProtector?.isRestartSuppressed() == true) {
                add(DeviceReadinessBlocker.CRASH_LOOP_COOLDOWN_ACTIVE)
            }
            if (oemProfile.manufacturerFamily !in policy.allowedManufacturerFamilies) {
                add(DeviceReadinessBlocker.OEM_NOT_ALLOWLISTED)
            }
            if (report.capabilities.androidVersion !in policy.supportedAndroidSdks) {
                add(DeviceReadinessBlocker.ANDROID_VERSION_UNSUPPORTED)
            }
            if (!report.capabilities.hasTelephony) add(DeviceReadinessBlocker.TELEPHONY_UNAVAILABLE)
            if (report.permissionPlan.defaultDialerNeeded) add(DeviceReadinessBlocker.DEFAULT_DIALER_REQUIRED)
            if (missingRequiredPermissions) add(DeviceReadinessBlocker.RUNTIME_PERMISSION_MISSING)
            if (policy.failOnForegroundServiceRestrictionRisk &&
                report.foregroundServiceRestrictionsLikely
            ) {
                add(DeviceReadinessBlocker.FOREGROUND_SERVICE_RESTRICTION_RISK)
            }
            if (report.compatibilityProfile.batteryRestrictionRisk == TelecomSupportLevel.RISKY ||
                report.compatibilityProfile.batteryRestrictionRisk == TelecomSupportLevel.UNSUPPORTED ||
                report.compatibilityProfile.batteryRestrictionRisk == TelecomSupportLevel.UNKNOWN
            ) {
                add(DeviceReadinessBlocker.BATTERY_RESTRICTION_RISK)
            }
            if (GsmFeature.OVERLAY in requiredFeatures) {
                if (!report.capabilities.supportsOverlay ||
                    report.compatibilityProfile.overlaySupport == TelecomSupportLevel.UNSUPPORTED
                ) {
                    add(DeviceReadinessBlocker.OVERLAY_UNSUPPORTED)
                }
                if (!report.overlaySupportAcceptable()) {
                    add(DeviceReadinessBlocker.OVERLAY_NOT_VERIFIED)
                }
                if (report.compatibilityProfile.shouldSuppressOverlayWhenLocked) {
                    add(DeviceReadinessBlocker.LOCKSCREEN_OVERLAY_RISK)
                }
            }
            if (GsmFeature.CALL_SCREENING in requiredFeatures &&
                (!report.capabilities.supportsCallScreening ||
                    report.compatibilityProfile.callScreeningSupport == TelecomSupportLevel.UNSUPPORTED)
            ) {
                add(DeviceReadinessBlocker.CALL_SCREENING_UNSUPPORTED)
            }
            if (requiredFeatures.any { recoveryManager.isFeatureAutoDisabled(it) }) {
                add(DeviceReadinessBlocker.SAFETY_RECOVERY_DISABLED)
            }
        }
        val readiness = DeviceReadinessReport(
            ready = blockers.isEmpty(),
            failClosed = true,
            blockers = blockers,
            manufacturerFamily = oemProfile.manufacturerFamily,
            androidSdk = report.capabilities.androidVersion,
            requiredFeatures = requiredFeatures,
        )
        record(reason, readiness)
        return readiness
    }

    private fun GsmCapabilityReport.overlaySupportAcceptable(): Boolean {
        return when (compatibilityProfile.overlaySupport) {
            TelecomSupportLevel.FULL -> true
            TelecomSupportLevel.LIMITED -> policy.allowLimitedOverlaySupport
            TelecomSupportLevel.RISKY,
            TelecomSupportLevel.UNSUPPORTED,
            TelecomSupportLevel.UNKNOWN -> false
        }
    }

    private fun GsmFeature.requiredPermissions(): Set<String> {
        return when (this) {
            GsmFeature.PASSIVE_CALL_OBSERVATION -> setOf(Manifest.permission.READ_PHONE_STATE)
            GsmFeature.SHIELD,
            GsmFeature.CALL_SCREENING,
            GsmFeature.OVERLAY,
            GsmFeature.GSM_INTELLIGENCE -> setOf(
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.READ_CONTACTS,
            )
            GsmFeature.SMART_DIALER -> setOf(
                Manifest.permission.READ_CONTACTS,
                Manifest.permission.READ_CALL_LOG,
            )
            GsmFeature.AI,
            GsmFeature.TRANSCRIPTION,
            GsmFeature.RECORDING -> setOf(
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.RECORD_AUDIO,
            )
        }
    }

    private fun record(
        reason: String,
        readiness: DeviceReadinessReport,
    ) {
        val attributes = mapOf(
            "reason" to reason,
            "ready" to readiness.ready.toString(),
            "fail_closed" to readiness.failClosed.toString(),
            "blockers" to readiness.blockers.joinToString { it.name },
            "oem" to readiness.manufacturerFamily,
            "android_sdk" to readiness.androidSdk.toString(),
            "features" to readiness.requiredFeatures.joinToString { it.name },
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.DEVICE_READINESS_VALIDATED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_2e_device_ship_readiness",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.DEVICE_READINESS_VALIDATED,
                attributes = attributes,
            ),
        )
    }
}
