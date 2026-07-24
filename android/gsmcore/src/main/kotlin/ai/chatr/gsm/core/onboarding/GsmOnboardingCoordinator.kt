package ai.chatr.gsm.core.onboarding

import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import ai.chatr.gsm.core.capability.GsmCapabilities
import ai.chatr.gsm.core.di.GsmDependencyRegistry
import ai.chatr.gsm.core.permissions.GsmPermissionPlan
import ai.chatr.gsm.core.permissions.GsmPermissionPlanner

data class GsmOnboardingState(
    val capabilities: GsmCapabilities,
    val permissionPlan: GsmPermissionPlan,
    val canProceed: Boolean,
)

class GsmOnboardingCoordinator(
    private val permissionPlanner: GsmPermissionPlanner = GsmPermissionPlanner(),
) {
    fun getState(context: Context): GsmOnboardingState {
        val graph = GsmDependencyRegistry.resolve(context)
        val capabilities = graph.capabilityChecker.getCapabilities()
        val permissionPlan = permissionPlanner.buildPlan(context, capabilities)

        return GsmOnboardingState(
            capabilities = capabilities,
            permissionPlan = permissionPlan,
            canProceed = capabilities.hasTelephony,
        )
    }

    fun createDefaultDialerIntent(context: Context): Intent? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null
        val roleManager = context.getSystemService(RoleManager::class.java) ?: return null
        if (!roleManager.isRoleAvailable(RoleManager.ROLE_DIALER)) return null
        if (roleManager.isRoleHeld(RoleManager.ROLE_DIALER)) return null
        return roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER)
    }

    fun createOverlaySettingsIntent(context: Context): Intent {
        return Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${context.packageName}"),
        )
    }
}
