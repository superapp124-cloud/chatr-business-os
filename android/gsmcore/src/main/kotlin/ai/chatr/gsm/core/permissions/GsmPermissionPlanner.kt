package ai.chatr.gsm.core.permissions

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import ai.chatr.gsm.core.capability.GsmCapabilities

enum class GsmPermissionStatus {
    GRANTED,
    MISSING,
    UNSUPPORTED,
}

data class GsmPermissionRequirement(
    val permission: String,
    val plainLanguageReason: String,
    val status: GsmPermissionStatus,
)

data class GsmPermissionPlan(
    val defaultDialerNeeded: Boolean,
    val requirements: List<GsmPermissionRequirement>,
)

class GsmPermissionPlanner {
    fun buildPlan(context: Context, capabilities: GsmCapabilities): GsmPermissionPlan {
        return GsmPermissionPlan(
            defaultDialerNeeded = capabilities.canRequestDefaultDialerRole && !capabilities.isDefaultDialer,
            requirements = listOf(
                requirement(context, Manifest.permission.READ_PHONE_STATE, "Detect when a normal SIM call starts and ends."),
                requirement(context, Manifest.permission.READ_CALL_LOG, "Show recent GSM calls and post-call intelligence."),
                requirement(context, Manifest.permission.READ_CONTACTS, "Recognize saved contacts before warning about unknown callers."),
                requirement(context, Manifest.permission.RECORD_AUDIO, "Enable optional subtitles and audio intelligence during calls."),
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    requirement(context, Manifest.permission.POST_NOTIFICATIONS, "Show safety alerts and post-call summaries.")
                } else {
                    GsmPermissionRequirement(
                        permission = Manifest.permission.POST_NOTIFICATIONS,
                        plainLanguageReason = "Notifications are automatically available on this Android version.",
                        status = GsmPermissionStatus.UNSUPPORTED,
                    )
                },
            ),
        )
    }

    private fun requirement(
        context: Context,
        permission: String,
        reason: String,
    ): GsmPermissionRequirement {
        val status = if (ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED) {
            GsmPermissionStatus.GRANTED
        } else {
            GsmPermissionStatus.MISSING
        }

        return GsmPermissionRequirement(
            permission = permission,
            plainLanguageReason = reason,
            status = status,
        )
    }
}
