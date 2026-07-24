package ai.chatr.gsm.overlay

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.GsmFeatureFlagProvider
import ai.chatr.gsm.core.StaticGsmFeatureFlagProvider
import ai.chatr.gsm.core.experience.GsmCallExperienceContract
import ai.chatr.gsm.shield.CallerIdentity
import ai.chatr.gsm.shield.IncomingGsmShieldPresenter
import ai.chatr.gsm.shield.ShieldVerdict

enum class GsmIncomingCallAction {
    ANSWER_NATIVE_CALL,
    DECLINE_NATIVE_CALL,
    OPEN_CONTACT,
    REPORT_SPAM,
    DISMISS_OVERLAY,
}

data class GsmIncomingCallExperience(
    val overlayState: GsmOverlayState?,
    val availableActions: Set<GsmIncomingCallAction>,
    val contract: GsmCallExperienceContract,
)

class GsmIncomingCallExperienceCoordinator(
    private val flags: GsmFeatureFlagProvider = StaticGsmFeatureFlagProvider,
    private val shieldPresenter: IncomingGsmShieldPresenter = IncomingGsmShieldPresenter(flags),
    private val contract: GsmCallExperienceContract = GsmCallExperienceContract.passivePhaseOne,
) {
    fun buildIncomingExperience(
        callId: String,
        callerIdentity: CallerIdentity,
        localSpamScore: Float,
        localReportCount: Int,
        robocallProbability: Float,
    ): GsmIncomingCallExperience {
        if (!flags.isEnabled(GsmFeature.OVERLAY)) {
            return GsmIncomingCallExperience(
                overlayState = null,
                availableActions = emptySet(),
                contract = contract,
            )
        }

        val shieldState = shieldPresenter.present(
            callerIdentity = callerIdentity,
            localSpamScore = localSpamScore,
            localReportCount = localReportCount,
            robocallProbability = robocallProbability,
        )

        val mode = when (shieldState.analysis.verdict) {
            ShieldVerdict.POTENTIAL_SCAM -> GsmOverlayMode.FRAUD_ALERT
            ShieldVerdict.TRUSTED,
            ShieldVerdict.KNOWN_CONTACT,
            ShieldVerdict.UNKNOWN,
            ShieldVerdict.SUSPICIOUS -> GsmOverlayMode.EXPANDED
        }

        return GsmIncomingCallExperience(
            overlayState = GsmOverlayState(
                callId = callId,
                mode = mode,
                title = shieldState.primaryLabel,
                subtitle = shieldState.secondaryLabel,
                shieldAnalysis = shieldState.analysis,
            ),
            availableActions = setOf(
                GsmIncomingCallAction.ANSWER_NATIVE_CALL,
                GsmIncomingCallAction.DECLINE_NATIVE_CALL,
                GsmIncomingCallAction.DISMISS_OVERLAY,
            ) + if (shieldState.shouldShowWarning) {
                setOf(GsmIncomingCallAction.REPORT_SPAM)
            } else {
                setOf(GsmIncomingCallAction.OPEN_CONTACT)
            },
            contract = contract,
        )
    }
}
