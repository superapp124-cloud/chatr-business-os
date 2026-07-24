package ai.chatr.gsm.core.onboarding

data class GsmOnboardingEntryPoint(
    val routeId: String = "settings/chatr-shield/gsm-intelligence",
    val label: String = "Enable GSM Intelligence",
    val parentLabel: String = "CHATR Shield",
    val isPassive: Boolean = true,
    val isSkippable: Boolean = true,
)

object GsmOnboardingRoutes {
    val settingsChatrShieldEntry = GsmOnboardingEntryPoint()
}
