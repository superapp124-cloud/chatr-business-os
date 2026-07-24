package ai.chatr.gsm.core.diagnostics

import android.content.Context
import android.os.PowerManager
import ai.chatr.gsm.core.capability.GsmCapabilities
import ai.chatr.gsm.core.compat.TelecomCompatibilityMatrix
import ai.chatr.gsm.core.compat.TelecomCompatibilityProfile
import ai.chatr.gsm.core.di.GsmDependencyRegistry
import ai.chatr.gsm.core.permissions.GsmPermissionPlan
import ai.chatr.gsm.core.permissions.GsmPermissionPlanner

data class GsmCapabilityReport(
    val capabilities: GsmCapabilities,
    val compatibilityProfile: TelecomCompatibilityProfile,
    val permissionPlan: GsmPermissionPlan,
    val batteryOptimizationIgnored: Boolean,
    val foregroundServiceRestrictionsLikely: Boolean,
    val generatedAtMillis: Long,
)

class GsmCapabilityReportGenerator(
    private val permissionPlanner: GsmPermissionPlanner = GsmPermissionPlanner(),
) {
    fun generate(context: Context): GsmCapabilityReport {
        val graph = GsmDependencyRegistry.resolve(context)
        val capabilities = graph.capabilityChecker.getCapabilities()
        val powerManager = context.getSystemService(PowerManager::class.java)

        return GsmCapabilityReport(
            capabilities = capabilities,
            compatibilityProfile = TelecomCompatibilityMatrix.current(capabilities),
            permissionPlan = permissionPlanner.buildPlan(context, capabilities),
            batteryOptimizationIgnored = powerManager?.isIgnoringBatteryOptimizations(context.packageName) == true,
            foregroundServiceRestrictionsLikely = !capabilities.isDefaultDialer &&
                !capabilities.supportsOverlay,
            generatedAtMillis = System.currentTimeMillis(),
        )
    }
}
