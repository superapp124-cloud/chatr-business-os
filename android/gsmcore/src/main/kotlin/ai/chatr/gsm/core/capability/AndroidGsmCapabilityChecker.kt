package ai.chatr.gsm.core.capability

import android.app.role.RoleManager
import android.content.Context
import android.content.pm.PackageManager
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import android.os.Build
import android.provider.Settings
import android.telecom.TelecomManager

class AndroidGsmCapabilityChecker(
    private val context: Context,
) : GsmCapabilityChecker {

    override fun getCapabilities(): GsmCapabilities {
        val packageManager = context.packageManager
        val telecomManager = context.getSystemService(TelecomManager::class.java)
        val roleManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            context.getSystemService(RoleManager::class.java)
        } else {
            null
        }

        val isDefaultDialer = telecomManager?.defaultDialerPackage == context.packageName ||
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                roleManager?.isRoleHeld(RoleManager.ROLE_DIALER) == true
            } else {
                false
            }

        return GsmCapabilities(
            androidVersion = Build.VERSION.SDK_INT,
            hasTelephony = packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY),
            canRequestDefaultDialerRole = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q,
            isDefaultDialer = isDefaultDialer,
            supportsCallScreening = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N,
            supportsInCallService = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M,
            supportsCallRedirection = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q,
            supportsOverlay = Settings.canDrawOverlays(context),
            supportsAudioEffects = AcousticEchoCanceler.isAvailable() || NoiseSuppressor.isAvailable(),
        )
    }
}
