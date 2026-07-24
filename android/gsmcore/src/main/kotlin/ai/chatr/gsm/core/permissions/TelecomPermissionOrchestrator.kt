package ai.chatr.gsm.core.permissions

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import ai.chatr.gsm.core.diagnostics.GsmCapabilityReport
import ai.chatr.gsm.core.onboarding.GsmOnboardingCoordinator
import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class TelecomPermissionStepType {
    NONE,
    DEFAULT_DIALER_ROLE,
    RUNTIME_PERMISSION,
    OVERLAY_SETTINGS,
    OEM_MANUAL_SETTINGS,
}

data class TelecomPermissionStep(
    val type: TelecomPermissionStepType,
    val title: String,
    val rationale: String,
    val permissions: List<String> = emptyList(),
    val intent: Intent? = null,
    val oemInstructions: List<String> = emptyList(),
)

interface TelecomPermissionPromptHistory {
    fun wasPrompted(stepType: TelecomPermissionStepType, key: String): Boolean
    fun markPrompted(stepType: TelecomPermissionStepType, key: String)
}

class InMemoryTelecomPermissionPromptHistory : TelecomPermissionPromptHistory {
    private val prompted = mutableSetOf<String>()

    override fun wasPrompted(stepType: TelecomPermissionStepType, key: String): Boolean {
        return "${stepType.name}:$key" in prompted
    }

    override fun markPrompted(stepType: TelecomPermissionStepType, key: String) {
        prompted += "${stepType.name}:$key"
    }
}

class TelecomPermissionOrchestrator(
    private val onboardingCoordinator: GsmOnboardingCoordinator = GsmOnboardingCoordinator(),
    private val promptHistory: TelecomPermissionPromptHistory = InMemoryTelecomPermissionPromptHistory(),
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
) {
    fun nextStep(
        context: Context,
        report: GsmCapabilityReport,
        userInitiatedRetry: Boolean = false,
    ): TelecomPermissionStep {
        if (report.permissionPlan.defaultDialerNeeded) {
            val key = "default_dialer"
            if (userInitiatedRetry || !promptHistory.wasPrompted(TelecomPermissionStepType.DEFAULT_DIALER_ROLE, key)) {
                promptHistory.markPrompted(TelecomPermissionStepType.DEFAULT_DIALER_ROLE, key)
                return TelecomPermissionStep(
                    type = TelecomPermissionStepType.DEFAULT_DIALER_ROLE,
                    title = "Use CHATR Shield with phone calls",
                    rationale = "This lets CHATR observe normal SIM calls and show safety information without changing carrier routing.",
                    intent = onboardingCoordinator.createDefaultDialerIntent(context),
                )
            }
        }

        val runtime = report.permissionPlan.requirements
            .filter { it.status == GsmPermissionStatus.MISSING }
            .filter { it.permission in phaseOneRuntimePermissions }
            .firstOrNull()
        if (runtime != null) {
            if (userInitiatedRetry || !promptHistory.wasPrompted(TelecomPermissionStepType.RUNTIME_PERMISSION, runtime.permission)) {
                promptHistory.markPrompted(TelecomPermissionStepType.RUNTIME_PERMISSION, runtime.permission)
                return TelecomPermissionStep(
                    type = TelecomPermissionStepType.RUNTIME_PERMISSION,
                    title = runtime.permission.readablePermissionTitle(),
                    rationale = runtime.plainLanguageReason,
                    permissions = listOf(runtime.permission),
                )
            }
            telemetrySink.track(
                GsmTelemetryEvent(
                    name = GsmTelemetryEventName.PERMISSION_DENIED,
                    attributes = mapOf("permission" to runtime.permission.substringAfterLast('.')),
                ),
            )
        }

        if (!report.capabilities.supportsOverlay) {
            val key = "overlay"
            if (userInitiatedRetry || !promptHistory.wasPrompted(TelecomPermissionStepType.OVERLAY_SETTINGS, key)) {
                promptHistory.markPrompted(TelecomPermissionStepType.OVERLAY_SETTINGS, key)
                return TelecomPermissionStep(
                    type = TelecomPermissionStepType.OVERLAY_SETTINGS,
                    title = "Allow subtle call overlay",
                    rationale = "This lets CHATR show a small caller safety badge over your normal phone app.",
                    intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:${context.packageName}"),
                    ),
                )
            }
        }

        val manualInstructions = report.compatibilityProfile.notes
            .filter { it.contains("battery", ignoreCase = true) || it.contains("overlay", ignoreCase = true) }
        if (manualInstructions.isNotEmpty()) {
            return TelecomPermissionStep(
                type = TelecomPermissionStepType.OEM_MANUAL_SETTINGS,
                title = "Device compatibility notes",
                rationale = "Your phone maker may require extra settings for reliable passive call safety.",
                oemInstructions = manualInstructions,
            )
        }

        return TelecomPermissionStep(
            type = TelecomPermissionStepType.NONE,
            title = "Ready",
            rationale = "CHATR Shield has what it needs for passive GSM safety checks.",
        )
    }

    private fun String.readablePermissionTitle(): String {
        return when (this) {
            Manifest.permission.READ_PHONE_STATE -> "Allow phone call status"
            Manifest.permission.READ_CONTACTS -> "Allow contact matching"
            Manifest.permission.READ_CALL_LOG -> "Allow recent call safety"
            Manifest.permission.POST_NOTIFICATIONS -> "Allow safety notifications"
            else -> "Allow permission"
        }
    }

    companion object {
        private val phaseOneRuntimePermissions = buildSet {
            add(Manifest.permission.READ_PHONE_STATE)
            add(Manifest.permission.READ_CONTACTS)
            add(Manifest.permission.READ_CALL_LOG)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }
}
