package ai.chatr.gsm.core.compat

import android.os.Build
import ai.chatr.gsm.core.capability.GsmCapabilities

enum class TelecomSupportLevel {
    FULL,
    LIMITED,
    RISKY,
    UNSUPPORTED,
    UNKNOWN,
}

data class TelecomCompatibilityProfile(
    val manufacturer: String,
    val overlaySupport: TelecomSupportLevel,
    val callScreeningSupport: TelecomSupportLevel,
    val roleBehavior: TelecomSupportLevel,
    val lockscreenBehavior: TelecomSupportLevel,
    val batteryRestrictionRisk: TelecomSupportLevel,
    val shouldUseHeadsUpOnlyOnLockscreen: Boolean,
    val shouldSuppressOverlayWhenLocked: Boolean,
    val notes: List<String>,
)

object TelecomCompatibilityMatrix {
    fun current(capabilities: GsmCapabilities): TelecomCompatibilityProfile {
        return forManufacturer(
            manufacturer = Build.MANUFACTURER.orEmpty(),
            capabilities = capabilities,
        )
    }

    fun forManufacturer(
        manufacturer: String,
        capabilities: GsmCapabilities,
    ): TelecomCompatibilityProfile {
        val normalized = manufacturer.lowercase()
        val baseNotes = mutableListOf<String>()
        if (!capabilities.hasTelephony) baseNotes += "No telephony feature reported."
        if (!capabilities.supportsOverlay) baseNotes += "Overlay permission is unavailable or denied."
        if (!capabilities.supportsCallScreening) baseNotes += "Call screening API is unavailable on this Android version."

        return when {
            "samsung" in normalized -> profile(
                manufacturer,
                overlay = TelecomSupportLevel.LIMITED,
                screening = TelecomSupportLevel.LIMITED,
                role = TelecomSupportLevel.FULL,
                lockscreen = TelecomSupportLevel.LIMITED,
                battery = TelecomSupportLevel.LIMITED,
                headsUpOnly = true,
                suppressWhenLocked = true,
                notes = baseNotes + "Samsung lockscreen and One UI call surfaces can restrict third-party overlays.",
            )
            "xiaomi" in normalized || "redmi" in normalized || "poco" in normalized -> profile(
                manufacturer,
                overlay = TelecomSupportLevel.RISKY,
                screening = TelecomSupportLevel.LIMITED,
                role = TelecomSupportLevel.LIMITED,
                lockscreen = TelecomSupportLevel.RISKY,
                battery = TelecomSupportLevel.RISKY,
                headsUpOnly = true,
                suppressWhenLocked = true,
                notes = baseNotes + "MIUI/HyperOS may kill background services or block overlays without extra user settings.",
            )
            "oneplus" in normalized -> profile(
                manufacturer,
                overlay = TelecomSupportLevel.LIMITED,
                screening = TelecomSupportLevel.LIMITED,
                role = TelecomSupportLevel.FULL,
                lockscreen = TelecomSupportLevel.LIMITED,
                battery = TelecomSupportLevel.LIMITED,
                headsUpOnly = true,
                suppressWhenLocked = false,
                notes = baseNotes + "OxygenOS behavior varies by version; keep overlay lightweight and removable.",
            )
            "oppo" in normalized || "realme" in normalized || "vivo" in normalized -> profile(
                manufacturer,
                overlay = TelecomSupportLevel.RISKY,
                screening = TelecomSupportLevel.LIMITED,
                role = TelecomSupportLevel.LIMITED,
                lockscreen = TelecomSupportLevel.RISKY,
                battery = TelecomSupportLevel.RISKY,
                headsUpOnly = true,
                suppressWhenLocked = true,
                notes = baseNotes + "OEM battery and floating-window policies are commonly restrictive.",
            )
            "google" in normalized || "pixel" in normalized -> profile(
                manufacturer,
                overlay = TelecomSupportLevel.FULL,
                screening = TelecomSupportLevel.FULL,
                role = TelecomSupportLevel.FULL,
                lockscreen = TelecomSupportLevel.FULL,
                battery = TelecomSupportLevel.FULL,
                headsUpOnly = false,
                suppressWhenLocked = false,
                notes = baseNotes + "Pixel is the reference Android Telecom behavior.",
            )
            else -> profile(
                manufacturer.ifBlank { "unknown" },
                overlay = TelecomSupportLevel.UNKNOWN,
                screening = TelecomSupportLevel.UNKNOWN,
                role = TelecomSupportLevel.UNKNOWN,
                lockscreen = TelecomSupportLevel.UNKNOWN,
                battery = TelecomSupportLevel.UNKNOWN,
                headsUpOnly = true,
                suppressWhenLocked = true,
                notes = baseNotes + "Unknown OEM; prefer conservative passive behavior.",
            )
        }.withCapabilityOverrides(capabilities)
    }

    private fun profile(
        manufacturer: String,
        overlay: TelecomSupportLevel,
        screening: TelecomSupportLevel,
        role: TelecomSupportLevel,
        lockscreen: TelecomSupportLevel,
        battery: TelecomSupportLevel,
        headsUpOnly: Boolean,
        suppressWhenLocked: Boolean,
        notes: List<String>,
    ): TelecomCompatibilityProfile {
        return TelecomCompatibilityProfile(
            manufacturer = manufacturer.ifBlank { "unknown" },
            overlaySupport = overlay,
            callScreeningSupport = screening,
            roleBehavior = role,
            lockscreenBehavior = lockscreen,
            batteryRestrictionRisk = battery,
            shouldUseHeadsUpOnlyOnLockscreen = headsUpOnly,
            shouldSuppressOverlayWhenLocked = suppressWhenLocked,
            notes = notes,
        )
    }

    private fun TelecomCompatibilityProfile.withCapabilityOverrides(
        capabilities: GsmCapabilities,
    ): TelecomCompatibilityProfile {
        return copy(
            overlaySupport = if (capabilities.supportsOverlay) overlaySupport else TelecomSupportLevel.UNSUPPORTED,
            callScreeningSupport = if (capabilities.supportsCallScreening) callScreeningSupport else TelecomSupportLevel.UNSUPPORTED,
            roleBehavior = if (capabilities.canRequestDefaultDialerRole) roleBehavior else TelecomSupportLevel.UNSUPPORTED,
        )
    }
}
