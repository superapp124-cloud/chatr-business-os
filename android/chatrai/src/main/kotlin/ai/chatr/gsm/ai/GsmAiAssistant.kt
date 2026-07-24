package ai.chatr.gsm.ai

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.GsmFeatureFlagProvider
import ai.chatr.gsm.core.StaticGsmFeatureFlagProvider
import ai.chatr.gsm.summary.GsmCallSummary
import ai.chatr.gsm.summary.GsmSummaryController
import ai.chatr.gsm.summary.DisabledGsmSummaryController
import ai.chatr.gsm.transcription.GsmTranscriptChunk
import ai.chatr.gsm.transcription.GsmTranscriptionController
import ai.chatr.gsm.transcription.DisabledGsmTranscriptionController
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow

class GsmAiAssistant(
    private val flags: GsmFeatureFlagProvider = StaticGsmFeatureFlagProvider,
    private val transcriptionController: GsmTranscriptionController = DisabledGsmTranscriptionController(flags),
    private val summaryController: GsmSummaryController = DisabledGsmSummaryController(flags),
) {
    fun liveTranscript(callId: String): Flow<GsmTranscriptChunk> {
        if (!flags.isEnabled(GsmFeature.AI)) return emptyFlow()
        return transcriptionController.observeTranscription(callId)
    }

    suspend fun postCallSummary(
        callId: String,
        transcript: List<GsmTranscriptChunk>,
    ): GsmCallSummary? {
        if (!flags.isEnabled(GsmFeature.AI)) return null
        return summaryController.summarize(callId, transcript)
    }
}
