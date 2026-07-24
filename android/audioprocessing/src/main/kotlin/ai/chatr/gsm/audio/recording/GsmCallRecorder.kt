package ai.chatr.gsm.audio.recording

interface GsmCallRecorder {
    fun prepare(callId: String): RecordingCapability
    fun start(callId: String): Boolean
    fun stop(callId: String)
}

class DisabledGsmCallRecorder(
    private val recordingPolicy: GsmRecordingPolicy = DefaultGsmRecordingPolicy(),
) : GsmCallRecorder {
    override fun prepare(callId: String): RecordingCapability {
        return recordingPolicy.evaluate(regionIso = null, userConsented = false)
    }

    override fun start(callId: String): Boolean = false

    override fun stop(callId: String) {
        // Recording is intentionally disabled in Phase 1.
    }
}
