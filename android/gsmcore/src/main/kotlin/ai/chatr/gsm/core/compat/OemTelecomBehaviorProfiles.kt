package ai.chatr.gsm.core.compat

import android.os.Build

enum class OemRolloutTier {
    PIXEL_REFERENCE,
    SAMSUNG_PRIORITY,
    ONEPLUS_PRIORITY,
    DELAYED_VALIDATION,
    UNKNOWN_CONSERVATIVE,
}

data class OemTelecomBehaviorProfile(
    val manufacturerFamily: String,
    val rolloutTier: OemRolloutTier,
    val overlayAttachTimeoutMillis: Long,
    val overlayDetachTimeoutMillis: Long,
    val processRecreationGraceMillis: Long,
    val rapidCallbackDebounceMillis: Long,
    val suppressOverlayOnLockscreen: Boolean,
    val preferHeadsUpOnLockscreen: Boolean,
    val allowInternalDogfood: Boolean,
    val requiresBatteryEducation: Boolean,
    val notes: List<String>,
)

object OemTelecomBehaviorProfiles {
    fun current(): OemTelecomBehaviorProfile {
        return forManufacturer(Build.MANUFACTURER.orEmpty())
    }

    fun forManufacturer(manufacturer: String): OemTelecomBehaviorProfile {
        val normalized = manufacturer.lowercase()
        return when {
            "google" in normalized || "pixel" in normalized -> OemTelecomBehaviorProfile(
                manufacturerFamily = "Pixel",
                rolloutTier = OemRolloutTier.PIXEL_REFERENCE,
                overlayAttachTimeoutMillis = 150,
                overlayDetachTimeoutMillis = 350,
                processRecreationGraceMillis = 2_000,
                rapidCallbackDebounceMillis = 80,
                suppressOverlayOnLockscreen = false,
                preferHeadsUpOnLockscreen = false,
                allowInternalDogfood = true,
                requiresBatteryEducation = false,
                notes = listOf("Reference Android Telecom behavior; validate first."),
            )
            "samsung" in normalized -> OemTelecomBehaviorProfile(
                manufacturerFamily = "Samsung",
                rolloutTier = OemRolloutTier.SAMSUNG_PRIORITY,
                overlayAttachTimeoutMillis = 220,
                overlayDetachTimeoutMillis = 500,
                processRecreationGraceMillis = 3_000,
                rapidCallbackDebounceMillis = 120,
                suppressOverlayOnLockscreen = true,
                preferHeadsUpOnLockscreen = true,
                allowInternalDogfood = true,
                requiresBatteryEducation = true,
                notes = listOf(
                    "One UI may restrict overlays over lockscreen call surfaces.",
                    "Battery optimization prompts should be passive and user initiated.",
                ),
            )
            "oneplus" in normalized -> OemTelecomBehaviorProfile(
                manufacturerFamily = "OnePlus",
                rolloutTier = OemRolloutTier.ONEPLUS_PRIORITY,
                overlayAttachTimeoutMillis = 220,
                overlayDetachTimeoutMillis = 450,
                processRecreationGraceMillis = 2_500,
                rapidCallbackDebounceMillis = 120,
                suppressOverlayOnLockscreen = false,
                preferHeadsUpOnLockscreen = true,
                allowInternalDogfood = true,
                requiresBatteryEducation = true,
                notes = listOf("OxygenOS can recreate processes aggressively during telecom transitions."),
            )
            "xiaomi" in normalized || "redmi" in normalized || "poco" in normalized -> OemTelecomBehaviorProfile(
                manufacturerFamily = "Xiaomi",
                rolloutTier = OemRolloutTier.DELAYED_VALIDATION,
                overlayAttachTimeoutMillis = 300,
                overlayDetachTimeoutMillis = 700,
                processRecreationGraceMillis = 5_000,
                rapidCallbackDebounceMillis = 180,
                suppressOverlayOnLockscreen = true,
                preferHeadsUpOnLockscreen = true,
                allowInternalDogfood = false,
                requiresBatteryEducation = true,
                notes = listOf("MIUI/HyperOS commonly blocks floating windows and background services."),
            )
            "oppo" in normalized || "realme" in normalized -> OemTelecomBehaviorProfile(
                manufacturerFamily = "Oppo",
                rolloutTier = OemRolloutTier.DELAYED_VALIDATION,
                overlayAttachTimeoutMillis = 300,
                overlayDetachTimeoutMillis = 700,
                processRecreationGraceMillis = 5_000,
                rapidCallbackDebounceMillis = 180,
                suppressOverlayOnLockscreen = true,
                preferHeadsUpOnLockscreen = true,
                allowInternalDogfood = false,
                requiresBatteryEducation = true,
                notes = listOf("ColorOS task cleanup and floating-window permissions are frequently restrictive."),
            )
            "vivo" in normalized -> OemTelecomBehaviorProfile(
                manufacturerFamily = "Vivo",
                rolloutTier = OemRolloutTier.DELAYED_VALIDATION,
                overlayAttachTimeoutMillis = 300,
                overlayDetachTimeoutMillis = 700,
                processRecreationGraceMillis = 5_000,
                rapidCallbackDebounceMillis = 180,
                suppressOverlayOnLockscreen = true,
                preferHeadsUpOnLockscreen = true,
                allowInternalDogfood = false,
                requiresBatteryEducation = true,
                notes = listOf("Vivo devices often suppress overlays and background execution during locked calls."),
            )
            else -> OemTelecomBehaviorProfile(
                manufacturerFamily = manufacturer.ifBlank { "Unknown" },
                rolloutTier = OemRolloutTier.UNKNOWN_CONSERVATIVE,
                overlayAttachTimeoutMillis = 300,
                overlayDetachTimeoutMillis = 700,
                processRecreationGraceMillis = 5_000,
                rapidCallbackDebounceMillis = 180,
                suppressOverlayOnLockscreen = true,
                preferHeadsUpOnLockscreen = true,
                allowInternalDogfood = false,
                requiresBatteryEducation = true,
                notes = listOf("Unknown OEM; use conservative passive behavior only."),
            )
        }
    }
}
