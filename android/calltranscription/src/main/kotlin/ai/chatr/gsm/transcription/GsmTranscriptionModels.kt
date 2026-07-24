package ai.chatr.gsm.transcription

enum class TranscriptSpeaker {
    USER,
    CALLER,
    UNKNOWN,
}

data class GsmTranscriptChunk(
    val callId: String,
    val text: String,
    val startMillis: Long,
    val endMillis: Long,
    val speaker: TranscriptSpeaker,
    val confidence: Float,
)
