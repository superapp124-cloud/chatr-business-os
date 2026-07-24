package ai.chatr.gsm.audio.recording

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.GsmFeatureFlagProvider
import ai.chatr.gsm.core.StaticGsmFeatureFlagProvider

enum class RecordingPolicyDecision {
    DISABLED_BY_FLAG,
    UNSUPPORTED_REGION,
    UNSUPPORTED_ANDROID_POLICY,
    USER_CONSENT_REQUIRED,
    ALLOWED,
}

data class RecordingCapability(
    val canRecord: Boolean,
    val decision: RecordingPolicyDecision,
    val explanation: String,
)

interface GsmRecordingPolicy {
    fun evaluate(regionIso: String?, userConsented: Boolean): RecordingCapability
}

class DefaultGsmRecordingPolicy(
    private val flags: GsmFeatureFlagProvider = StaticGsmFeatureFlagProvider,
) : GsmRecordingPolicy {
    override fun evaluate(regionIso: String?, userConsented: Boolean): RecordingCapability {
        if (!flags.isEnabled(GsmFeature.RECORDING)) {
            return RecordingCapability(
                canRecord = false,
                decision = RecordingPolicyDecision.DISABLED_BY_FLAG,
                explanation = "GSM call recording is disabled.",
            )
        }

        if (!userConsented) {
            return RecordingCapability(
                canRecord = false,
                decision = RecordingPolicyDecision.USER_CONSENT_REQUIRED,
                explanation = "Explicit user consent is required before any recording.",
            )
        }

        return RecordingCapability(
            canRecord = false,
            decision = RecordingPolicyDecision.UNSUPPORTED_ANDROID_POLICY,
            explanation = "Recording support is architecture-only until legal and Android policy checks are complete.",
        )
    }
}
