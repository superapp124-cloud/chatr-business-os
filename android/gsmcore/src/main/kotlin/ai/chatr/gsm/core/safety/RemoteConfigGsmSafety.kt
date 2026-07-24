package ai.chatr.gsm.core.safety

import android.os.Build

data class RemoteConfigGsmSafetySnapshot(
    val globalDisable: Boolean = true,
    val disabledManufacturers: Set<String> = emptySet(),
    val disabledAndroidSdkVersions: Set<Int> = emptySet(),
    val overlayDisable: Boolean = true,
    val shieldDisable: Boolean = true,
    val metadataEnrichmentDisable: Boolean = true,
    val passiveObservationDisable: Boolean = true,
    val updatedAtMillis: Long = 0L,
)

interface RemoteConfigGsmSafety {
    fun snapshot(): RemoteConfigGsmSafetySnapshot
}

object DisabledRemoteConfigGsmSafety : RemoteConfigGsmSafety {
    override fun snapshot(): RemoteConfigGsmSafetySnapshot = RemoteConfigGsmSafetySnapshot()
}

class StaticRemoteConfigGsmSafety(
    private val snapshot: RemoteConfigGsmSafetySnapshot,
) : RemoteConfigGsmSafety {
    override fun snapshot(): RemoteConfigGsmSafetySnapshot = snapshot
}

enum class GsmSafetyBlockReason {
    NONE,
    GLOBAL_KILL_SWITCH,
    OEM_KILL_SWITCH,
    ANDROID_VERSION_KILL_SWITCH,
    OVERLAY_KILL_SWITCH,
    SHIELD_KILL_SWITCH,
    METADATA_KILL_SWITCH,
    PASSIVE_OBSERVATION_KILL_SWITCH,
}

data class GsmSafetyDecision(
    val allowed: Boolean,
    val reason: GsmSafetyBlockReason,
) {
    companion object {
        val allowed = GsmSafetyDecision(true, GsmSafetyBlockReason.NONE)
    }
}

class GsmSafetyGate(
    private val remoteConfig: RemoteConfigGsmSafety = DisabledRemoteConfigGsmSafety,
) {
    fun check(featureName: String, manufacturer: String = Build.MANUFACTURER.orEmpty()): GsmSafetyDecision {
        val snapshot = remoteConfig.snapshot()
        if (snapshot.globalDisable) {
            return GsmSafetyDecision(false, GsmSafetyBlockReason.GLOBAL_KILL_SWITCH)
        }
        if (manufacturer.lowercase() in snapshot.disabledManufacturers.map { it.lowercase() }) {
            return GsmSafetyDecision(false, GsmSafetyBlockReason.OEM_KILL_SWITCH)
        }
        if (Build.VERSION.SDK_INT in snapshot.disabledAndroidSdkVersions) {
            return GsmSafetyDecision(false, GsmSafetyBlockReason.ANDROID_VERSION_KILL_SWITCH)
        }

        return when {
            featureName == "overlay" && snapshot.overlayDisable ->
                GsmSafetyDecision(false, GsmSafetyBlockReason.OVERLAY_KILL_SWITCH)
            featureName == "shield" && snapshot.shieldDisable ->
                GsmSafetyDecision(false, GsmSafetyBlockReason.SHIELD_KILL_SWITCH)
            featureName == "metadata" && snapshot.metadataEnrichmentDisable ->
                GsmSafetyDecision(false, GsmSafetyBlockReason.METADATA_KILL_SWITCH)
            featureName == "passive_observation" && snapshot.passiveObservationDisable ->
                GsmSafetyDecision(false, GsmSafetyBlockReason.PASSIVE_OBSERVATION_KILL_SWITCH)
            else -> GsmSafetyDecision.allowed
        }
    }
}
