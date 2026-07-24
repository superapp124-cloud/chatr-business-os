package ai.chatr.gsm.settings

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.activation.GsmActivationDecision
import ai.chatr.gsm.core.activation.GsmActivationDecisionReason
import ai.chatr.gsm.core.compat.TelecomSupportLevel
import ai.chatr.gsm.core.diagnostics.GsmCapabilityReport
import ai.chatr.gsm.core.permissions.GsmPermissionStatus
import ai.chatr.gsm.core.permissions.TelecomPermissionStep
import ai.chatr.gsm.core.permissions.TelecomPermissionStepType

@Composable
fun ChatrShieldSettingsScreen(
    state: ChatrShieldSettingsUiState,
    onGsmIntelligenceChanged: (Boolean) -> Unit,
    onPassiveOverlayChanged: (Boolean) -> Unit,
    onSpamProtectionChanged: (Boolean) -> Unit,
    onOpenPermissionStep: (TelecomPermissionStep) -> Unit,
    onRefreshDiagnostics: () -> Unit,
    modifier: Modifier = Modifier,
) {
    MaterialTheme {
        Surface(
            modifier = modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 18.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Header()
                ActivationCard(
                    state = state,
                    onGsmIntelligenceChanged = onGsmIntelligenceChanged,
                    onPassiveOverlayChanged = onPassiveOverlayChanged,
                    onSpamProtectionChanged = onSpamProtectionChanged,
                )
                PermissionCard(
                    step = state.nextPermissionStep,
                    onOpenPermissionStep = onOpenPermissionStep,
                )
                DiagnosticsCard(
                    report = state.capabilityReport,
                    onRefreshDiagnostics = onRefreshDiagnostics,
                )
                RolloutCard(state = state)
                Spacer(modifier = Modifier.height(12.dp))
            }
        }
    }
}

@Composable
private fun Header() {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = "CHATR Shield",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            text = "Opt in to passive GSM safety checks for normal SIM calls. Carrier routing stays unchanged.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun ActivationCard(
    state: ChatrShieldSettingsUiState,
    onGsmIntelligenceChanged: (Boolean) -> Unit,
    onPassiveOverlayChanged: (Boolean) -> Unit,
    onSpamProtectionChanged: (Boolean) -> Unit,
) {
    SettingsCard(title = "Activation") {
        ToggleRow(
            title = "GSM Intelligence",
            subtitle = "Controlled opt-in. Starts with passive call observation only.",
            checked = state.activationState.optedIn,
            onCheckedChange = onGsmIntelligenceChanged,
        )
        ToggleRow(
            title = "Spam protection",
            subtitle = "Shows local Shield verdicts for trusted, unknown, suspicious, and scam-risk callers.",
            checked = state.activationState.spamProtectionEnabled,
            enabled = state.activationState.optedIn,
            onCheckedChange = onSpamProtectionChanged,
        )
        ToggleRow(
            title = "Passive overlay",
            subtitle = "Small safety badge over the native phone UI when supported by this device.",
            checked = state.activationState.passiveOverlayEnabled,
            enabled = state.activationState.optedIn,
            onCheckedChange = onPassiveOverlayChanged,
        )
    }
}

@Composable
private fun PermissionCard(
    step: TelecomPermissionStep?,
    onOpenPermissionStep: (TelecomPermissionStep) -> Unit,
) {
    SettingsCard(title = "Permissions") {
        val currentStep = step ?: return@SettingsCard
        Text(
            text = currentStep.title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            text = currentStep.rationale,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        AnimatedVisibility(visible = currentStep.oemInstructions.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                currentStep.oemInstructions.take(3).forEach { instruction ->
                    Text(
                        text = instruction,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        if (currentStep.type != TelecomPermissionStepType.NONE) {
            Button(
                onClick = { onOpenPermissionStep(currentStep) },
                shape = RoundedCornerShape(8.dp),
            ) {
                Text(text = currentStep.actionLabel())
            }
        }
    }
}

@Composable
private fun DiagnosticsCard(
    report: GsmCapabilityReport?,
    onRefreshDiagnostics: () -> Unit,
) {
    SettingsCard(title = "Diagnostics") {
        if (report == null) {
            Text(
                text = "Diagnostics have not been generated yet.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            DiagnosticRow("Android", "SDK ${report.capabilities.androidVersion}")
            DiagnosticRow("OEM", report.compatibilityProfile.manufacturer)
            DiagnosticRow("Default dialer", if (report.capabilities.isDefaultDialer) "Ready" else "Needed")
            DiagnosticRow("Overlay", report.compatibilityProfile.overlaySupport.displayText())
            DiagnosticRow("Call screening", report.compatibilityProfile.callScreeningSupport.displayText())
            DiagnosticRow("Lockscreen", report.compatibilityProfile.lockscreenBehavior.displayText())
            DiagnosticRow("Battery policy", report.compatibilityProfile.batteryRestrictionRisk.displayText())
            DiagnosticRow(
                "Battery optimization",
                if (report.batteryOptimizationIgnored) "Allowed" else "May restrict background work",
            )
            val missing = report.permissionPlan.requirements
                .filter { it.status == GsmPermissionStatus.MISSING }
                .joinToString { it.permission.substringAfterLast('.') }
                .ifBlank { "None" }
            DiagnosticRow("Missing permissions", missing)
        }
        TextButton(onClick = onRefreshDiagnostics) {
            Text(text = "Refresh diagnostics")
        }
    }
}

@Composable
private fun RolloutCard(state: ChatrShieldSettingsUiState) {
    SettingsCard(title = "Rollout status") {
        ProgressRow("Passive observation", state.activationPlan.decisionFor(GsmFeature.PASSIVE_CALL_OBSERVATION))
        ProgressRow("Shield verdicts", state.activationPlan.decisionFor(GsmFeature.SHIELD))
        ProgressRow("Passive overlay", state.activationPlan.decisionFor(GsmFeature.OVERLAY))
        ProgressRow("CHATR peer enrichment", state.activationPlan.decisionFor(GsmFeature.GSM_INTELLIGENCE))
    }
}

@Composable
private fun SettingsCard(
    title: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    OutlinedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            content()
        }
    }
}

@Composable
private fun ToggleRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    enabled: Boolean = true,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Switch(
            checked = checked,
            enabled = enabled,
            onCheckedChange = onCheckedChange,
        )
    }
}

@Composable
private fun DiagnosticRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            modifier = Modifier.weight(0.8f),
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            modifier = Modifier.weight(1.2f),
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun ProgressRow(label: String, decision: GsmActivationDecision?) {
    val allowed = decision?.allowed == true
    DiagnosticRow(
        label = label,
        value = if (allowed) {
            "Ready"
        } else {
            decision?.reason?.displayText() ?: "Not evaluated"
        },
    )
}

private fun TelecomPermissionStep.actionLabel(): String {
    return when (type) {
        TelecomPermissionStepType.DEFAULT_DIALER_ROLE -> "Open phone role"
        TelecomPermissionStepType.RUNTIME_PERMISSION -> "Allow permission"
        TelecomPermissionStepType.OVERLAY_SETTINGS -> "Open overlay settings"
        TelecomPermissionStepType.OEM_MANUAL_SETTINGS -> "View instructions"
        TelecomPermissionStepType.NONE -> "Done"
    }
}

private fun TelecomSupportLevel.displayText(): String {
    return when (this) {
        TelecomSupportLevel.FULL -> "Ready"
        TelecomSupportLevel.LIMITED -> "Limited"
        TelecomSupportLevel.RISKY -> "Delayed"
        TelecomSupportLevel.UNSUPPORTED -> "Unsupported"
        TelecomSupportLevel.UNKNOWN -> "Unknown"
    }
}

private fun GsmActivationDecisionReason.displayText(): String {
    return when (this) {
        GsmActivationDecisionReason.ALLOWED -> "Ready"
        GsmActivationDecisionReason.STATIC_FLAG_DISABLED -> "Disabled by rollout flag"
        GsmActivationDecisionReason.USER_NOT_OPTED_IN -> "Waiting for opt-in"
        GsmActivationDecisionReason.STAGE_NOT_REACHED -> "Pending staged rollout"
        GsmActivationDecisionReason.REMOTE_KILL_SWITCH -> "Disabled by safety switch"
        GsmActivationDecisionReason.TELEPHONY_UNAVAILABLE -> "No telephony support"
        GsmActivationDecisionReason.UNSUPPORTED_ANDROID_VERSION -> "Unsupported Android version"
        GsmActivationDecisionReason.PERMISSION_MISSING -> "Permission needed"
        GsmActivationDecisionReason.OEM_DELAYED -> "Delayed for this OEM"
        GsmActivationDecisionReason.OVERLAY_UNSUPPORTED -> "Overlay unsupported"
        GsmActivationDecisionReason.LOCKSCREEN_RISK -> "Lockscreen overlay limited"
        GsmActivationDecisionReason.BATTERY_RESTRICTION_RISK -> "Battery policy risk"
        GsmActivationDecisionReason.FEATURE_DEFERRED -> "Deferred"
        GsmActivationDecisionReason.SAFETY_RECOVERY_DISABLED -> "Auto-disabled for safety"
        GsmActivationDecisionReason.DOGFOOD_NOT_ALLOWED -> "Not allowed for dogfood"
        GsmActivationDecisionReason.PILOT_NOT_ALLOWED -> "Not included in pilot"
        GsmActivationDecisionReason.DEVICE_NOT_READY -> "Device pre-flight blocked"
    }
}
