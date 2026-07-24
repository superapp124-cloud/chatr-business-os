package ai.chatr.gsm.audio

import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.GsmFeatureFlagProvider
import ai.chatr.gsm.core.StaticGsmFeatureFlagProvider

data class AudioEnhancementCapabilities(
    val noiseSuppressionAvailable: Boolean,
    val echoCancellationAvailable: Boolean,
)

class GsmAudioEnhancementController(
    private val flags: GsmFeatureFlagProvider = StaticGsmFeatureFlagProvider,
) {
    fun getCapabilities(): AudioEnhancementCapabilities {
        return AudioEnhancementCapabilities(
            noiseSuppressionAvailable = NoiseSuppressor.isAvailable(),
            echoCancellationAvailable = AcousticEchoCanceler.isAvailable(),
        )
    }

    fun shouldEnhanceAudio(): Boolean {
        return flags.isEnabled(GsmFeature.AI) && getCapabilities().let {
            it.noiseSuppressionAvailable || it.echoCancellationAvailable
        }
    }
}
