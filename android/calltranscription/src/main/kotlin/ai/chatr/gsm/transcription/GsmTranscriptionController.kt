package ai.chatr.gsm.transcription

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.GsmFeatureFlagProvider
import ai.chatr.gsm.core.StaticGsmFeatureFlagProvider
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow

interface GsmTranscriptionController {
    fun observeTranscription(callId: String): Flow<GsmTranscriptChunk>
    fun stop(callId: String)
}

class DisabledGsmTranscriptionController(
    private val flags: GsmFeatureFlagProvider = StaticGsmFeatureFlagProvider,
) : GsmTranscriptionController {
    override fun observeTranscription(callId: String): Flow<GsmTranscriptChunk> {
        if (!flags.isEnabled(GsmFeature.TRANSCRIPTION)) return emptyFlow()
        return emptyFlow()
    }

    override fun stop(callId: String) {
        // No active transcription work in Phase 1.
    }
}
