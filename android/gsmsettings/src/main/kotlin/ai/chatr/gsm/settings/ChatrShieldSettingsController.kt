package ai.chatr.gsm.settings

import android.content.Context
import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.activation.GsmActivationDecision
import ai.chatr.gsm.core.activation.GsmFeatureActivationManager
import ai.chatr.gsm.core.activation.GsmUserActivationState
import ai.chatr.gsm.core.diagnostics.GsmCapabilityReport
import ai.chatr.gsm.core.diagnostics.GsmCapabilityReportGenerator
import ai.chatr.gsm.core.permissions.TelecomPermissionOrchestrator
import ai.chatr.gsm.core.permissions.TelecomPermissionStep

data class ChatrShieldSettingsUiState(
    val activationState: GsmUserActivationState = GsmUserActivationState(),
    val capabilityReport: GsmCapabilityReport? = null,
    val activationPlan: List<GsmActivationDecision> = emptyList(),
    val nextPermissionStep: TelecomPermissionStep? = null,
)

class ChatrShieldSettingsController(
    private val reportGenerator: GsmCapabilityReportGenerator = GsmCapabilityReportGenerator(),
    private val activationManager: GsmFeatureActivationManager = GsmFeatureActivationManager(),
    private val permissionOrchestrator: TelecomPermissionOrchestrator = TelecomPermissionOrchestrator(),
) {
    fun buildState(
        context: Context,
        activationState: GsmUserActivationState,
        userInitiatedRetry: Boolean = false,
    ): ChatrShieldSettingsUiState {
        val report = reportGenerator.generate(context)
        return ChatrShieldSettingsUiState(
            activationState = activationState,
            capabilityReport = report,
            activationPlan = activationManager.activationPlan(activationState, report),
            nextPermissionStep = permissionOrchestrator.nextStep(
                context = context,
                report = report,
                userInitiatedRetry = userInitiatedRetry,
            ),
        )
    }
}

internal fun List<GsmActivationDecision>.decisionFor(feature: GsmFeature): GsmActivationDecision? {
    return firstOrNull { it.feature == feature }
}
