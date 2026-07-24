package ai.chatr.gsm.summary

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.GsmFeatureFlagProvider
import ai.chatr.gsm.core.StaticGsmFeatureFlagProvider
import ai.chatr.gsm.transcription.GsmTranscriptChunk

interface GsmSummaryController {
    suspend fun summarize(callId: String, transcript: List<GsmTranscriptChunk>): GsmCallSummary?
}

class DisabledGsmSummaryController(
    private val flags: GsmFeatureFlagProvider = StaticGsmFeatureFlagProvider,
) : GsmSummaryController {
    override suspend fun summarize(
        callId: String,
        transcript: List<GsmTranscriptChunk>,
    ): GsmCallSummary? {
        if (!flags.isEnabled(GsmFeature.AI)) return null
        return null
    }
}
