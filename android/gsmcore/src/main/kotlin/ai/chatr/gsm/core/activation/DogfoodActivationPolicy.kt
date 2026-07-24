package ai.chatr.gsm.core.activation

import android.os.Build
import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.compat.OemTelecomBehaviorProfiles
import ai.chatr.gsm.core.diagnostics.GsmCapabilityReport

enum class DogfoodActivationReason {
    ALLOWED,
    INTERNAL_DOGFOOD_DISABLED,
    ENGINEER_OPT_IN_MISSING,
    BUILD_TYPE_NOT_ALLOWED,
    OEM_NOT_ALLOWED,
    OEM_PROFILE_BLOCKED,
    DEVICE_NOT_ALLOWLISTED,
    GROUP_NOT_ALLOWED,
    FEATURE_NOT_ALLOWED,
}

data class DogfoodDeviceIdentity(
    val manufacturer: String,
    val model: String,
    val androidSdk: Int,
    val buildType: String,
    val deviceKeyHash: String? = null,
    val engineerGroup: String? = null,
) {
    companion object {
        fun current(
            buildType: String = "unknown",
            deviceKeyHash: String? = null,
            engineerGroup: String? = null,
        ): DogfoodDeviceIdentity {
            return DogfoodDeviceIdentity(
                manufacturer = Build.MANUFACTURER.orEmpty(),
                model = Build.MODEL.orEmpty(),
                androidSdk = Build.VERSION.SDK_INT,
                buildType = buildType,
                deviceKeyHash = deviceKeyHash,
                engineerGroup = engineerGroup,
            )
        }
    }
}

data class DogfoodEngineerOptIn(
    val optedIn: Boolean = false,
    val acceptedRiskAtMillis: Long? = null,
)

data class DogfoodActivationRules(
    val enabled: Boolean = false,
    val allowedBuildTypes: Set<String> = setOf("debug", "internal", "dogfood", "qa"),
    val allowedManufacturerFamilies: Set<String> = emptySet(),
    val allowedDeviceKeyHashes: Set<String> = emptySet(),
    val allowedEngineerGroups: Set<String> = emptySet(),
    val allowedFeatures: Set<GsmFeature> = setOf(
        GsmFeature.PASSIVE_CALL_OBSERVATION,
        GsmFeature.SHIELD,
        GsmFeature.CALL_SCREENING,
        GsmFeature.OVERLAY,
    ),
) {
    companion object {
        fun pixelOnly() = DogfoodActivationRules(
            enabled = true,
            allowedManufacturerFamilies = setOf("Pixel"),
        )

        fun samsungOnly() = DogfoodActivationRules(
            enabled = true,
            allowedManufacturerFamilies = setOf("Samsung"),
        )

        fun onePlusOnly() = DogfoodActivationRules(
            enabled = true,
            allowedManufacturerFamilies = setOf("OnePlus"),
        )

        fun internalQaGroups(groups: Set<String>) = DogfoodActivationRules(
            enabled = true,
            allowedEngineerGroups = groups,
        )
    }
}

data class DogfoodActivationDecision(
    val allowed: Boolean,
    val reason: DogfoodActivationReason,
    val manufacturerFamily: String,
)

interface DogfoodActivationPolicy {
    fun evaluate(
        feature: GsmFeature,
        report: GsmCapabilityReport,
    ): DogfoodActivationDecision
}

object DisabledDogfoodActivationPolicy : DogfoodActivationPolicy {
    override fun evaluate(
        feature: GsmFeature,
        report: GsmCapabilityReport,
    ): DogfoodActivationDecision {
        val profile = OemTelecomBehaviorProfiles.forManufacturer(report.compatibilityProfile.manufacturer)
        return DogfoodActivationDecision(
            allowed = false,
            reason = DogfoodActivationReason.INTERNAL_DOGFOOD_DISABLED,
            manufacturerFamily = profile.manufacturerFamily,
        )
    }
}

object PermissiveDogfoodActivationPolicy : DogfoodActivationPolicy {
    override fun evaluate(
        feature: GsmFeature,
        report: GsmCapabilityReport,
    ): DogfoodActivationDecision {
        val profile = OemTelecomBehaviorProfiles.forManufacturer(report.compatibilityProfile.manufacturer)
        return DogfoodActivationDecision(
            allowed = true,
            reason = DogfoodActivationReason.ALLOWED,
            manufacturerFamily = profile.manufacturerFamily,
        )
    }
}

class StaticDogfoodActivationPolicy(
    private val identity: DogfoodDeviceIdentity,
    private val optIn: DogfoodEngineerOptIn,
    private val rules: DogfoodActivationRules,
) : DogfoodActivationPolicy {
    override fun evaluate(
        feature: GsmFeature,
        report: GsmCapabilityReport,
    ): DogfoodActivationDecision {
        val profile = OemTelecomBehaviorProfiles.forManufacturer(report.compatibilityProfile.manufacturer)
        val buildType = identity.buildType.lowercase()
        val engineerGroup = identity.engineerGroup.orEmpty()
        val deviceKeyHash = identity.deviceKeyHash

        val reason = when {
            !rules.enabled -> DogfoodActivationReason.INTERNAL_DOGFOOD_DISABLED
            !optIn.optedIn -> DogfoodActivationReason.ENGINEER_OPT_IN_MISSING
            buildType !in rules.allowedBuildTypes.map { it.lowercase() } -> DogfoodActivationReason.BUILD_TYPE_NOT_ALLOWED
            !profile.allowInternalDogfood -> DogfoodActivationReason.OEM_PROFILE_BLOCKED
            rules.allowedManufacturerFamilies.isNotEmpty() &&
                profile.manufacturerFamily !in rules.allowedManufacturerFamilies -> DogfoodActivationReason.OEM_NOT_ALLOWED
            rules.allowedDeviceKeyHashes.isNotEmpty() &&
                deviceKeyHash !in rules.allowedDeviceKeyHashes -> DogfoodActivationReason.DEVICE_NOT_ALLOWLISTED
            rules.allowedEngineerGroups.isNotEmpty() &&
                engineerGroup !in rules.allowedEngineerGroups -> DogfoodActivationReason.GROUP_NOT_ALLOWED
            feature !in rules.allowedFeatures -> DogfoodActivationReason.FEATURE_NOT_ALLOWED
            else -> DogfoodActivationReason.ALLOWED
        }

        return DogfoodActivationDecision(
            allowed = reason == DogfoodActivationReason.ALLOWED,
            reason = reason,
            manufacturerFamily = profile.manufacturerFamily,
        )
    }
}
