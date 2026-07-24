package ai.chatr.gsm.core.telecom

data class OverlayLatencyStats(
    val sampleCount: Int,
    val p50Millis: Long?,
    val p95Millis: Long?,
    val p99Millis: Long?,
    val maxMillis: Long?,
    val targetMillis: Long,
) {
    val withinTarget: Boolean
        get() = p95Millis?.let { it <= targetMillis } ?: true
}

data class OverlayLatencyProfile(
    val attach: OverlayLatencyStats,
    val detach: OverlayLatencyStats,
)

class OverlayLatencyProfiler(
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val targetAttachMillis: Long = 150,
    private val targetDetachMillis: Long = 350,
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun profile(reason: String): OverlayLatencyProfile {
        val events = recorder.snapshot()
        val attachSamples = events
            .filter { it.type == TelecomRecordedEventType.OVERLAY_ATTACHED }
            .mapNotNull { it.durationMillis }
        val detachSamples = events
            .filter { it.type == TelecomRecordedEventType.OVERLAY_DETACHED }
            .mapNotNull { it.durationMillis }
        val profile = OverlayLatencyProfile(
            attach = attachSamples.toStats(targetAttachMillis),
            detach = detachSamples.toStats(targetDetachMillis),
        )
        record(reason, profile)
        return profile
    }

    private fun List<Long>.toStats(targetMillis: Long): OverlayLatencyStats {
        val sorted = sorted()
        return OverlayLatencyStats(
            sampleCount = sorted.size,
            p50Millis = sorted.percentile(0.50),
            p95Millis = sorted.percentile(0.95),
            p99Millis = sorted.percentile(0.99),
            maxMillis = sorted.lastOrNull(),
            targetMillis = targetMillis,
        )
    }

    private fun List<Long>.percentile(percentile: Double): Long? {
        if (isEmpty()) return null
        val index = ((size - 1) * percentile).toInt().coerceIn(0, size - 1)
        return this[index]
    }

    private fun record(
        reason: String,
        profile: OverlayLatencyProfile,
    ) {
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.OVERLAY_LATENCY_PROFILED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_1e_dogfood_readiness",
                attributes = mapOf(
                    "reason" to reason,
                    "attach_samples" to profile.attach.sampleCount.toString(),
                    "attach_p95" to profile.attach.p95Millis.toString(),
                    "attach_within_target" to profile.attach.withinTarget.toString(),
                    "detach_samples" to profile.detach.sampleCount.toString(),
                    "detach_p95" to profile.detach.p95Millis.toString(),
                    "detach_within_target" to profile.detach.withinTarget.toString(),
                ),
            ),
        )
    }
}
