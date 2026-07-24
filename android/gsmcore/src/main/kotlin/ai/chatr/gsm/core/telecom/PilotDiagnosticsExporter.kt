package ai.chatr.gsm.core.telecom

data class PilotDiagnosticsEvent(
    val type: TelecomRecordedEventType,
    val timestampMillis: Long,
    val manufacturer: String,
    val androidSdk: Int,
    val activationPath: String,
    val attributes: Map<String, String>,
    val durationMillis: Long?,
    val hasSession: Boolean,
)

data class PilotLatencyHistogram(
    val sampleCount: Int,
    val under100Millis: Int,
    val under150Millis: Int,
    val under250Millis: Int,
    val over250Millis: Int,
)

data class PilotDiagnosticsExport(
    val generatedAtMillis: Long,
    val eventCount: Int,
    val lifecycleEvents: List<PilotDiagnosticsEvent>,
    val watchdogEvents: List<PilotDiagnosticsEvent>,
    val oemAnomalies: List<PilotDiagnosticsEvent>,
    val overlayAttachHistogram: PilotLatencyHistogram,
    val overlayDetachHistogram: PilotLatencyHistogram,
    val reliabilityScore: TelecomReliabilityScoreReport?,
)

class PilotDiagnosticsExporter(
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val reliabilityScore: TelecomReliabilityScore? = null,
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun export(reason: String): PilotDiagnosticsExport {
        val events = recorder.snapshot()
        val reliability = reliabilityScore?.calculate("diagnostics_export_$reason")
        val lifecycleEvents = events
            .filter {
                it.type == TelecomRecordedEventType.SESSION_TRANSITION ||
                    it.type == TelecomRecordedEventType.CALLBACK_IGNORED ||
                    it.type == TelecomRecordedEventType.CALLBACK_FAILURE ||
                    it.type == TelecomRecordedEventType.PROCESS_RECOVERY_RECONCILED ||
                    it.type == TelecomRecordedEventType.SESSION_CONSISTENCY_AUDIT
            }
            .map { it.toDiagnosticsEvent() }
        val watchdogEvents = events
            .filter { it.type == TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION }
            .map { it.toDiagnosticsEvent() }
        val oemAnomalies = events
            .filter {
                it.type == TelecomRecordedEventType.OEM_PROFILE_REPORTED ||
                    it.type == TelecomRecordedEventType.TELECOM_HEALTH_REPORTED ||
                    it.type == TelecomRecordedEventType.TELECOM_MEMORY_GUARD_REPORTED ||
                    it.type == TelecomRecordedEventType.SILENT_FALLBACK_APPLIED
            }
            .filter { event ->
                event.attributes["healthy"] == "false" ||
                    event.attributes["action"]?.let { it != "NONE" } == true ||
                    event.attributes["consistent"] == "false" ||
                    event.type == TelecomRecordedEventType.OEM_PROFILE_REPORTED
            }
            .map { it.toDiagnosticsEvent() }

        val export = PilotDiagnosticsExport(
            generatedAtMillis = now(),
            eventCount = events.size,
            lifecycleEvents = lifecycleEvents,
            watchdogEvents = watchdogEvents,
            oemAnomalies = oemAnomalies,
            overlayAttachHistogram = events
                .filter { it.type == TelecomRecordedEventType.OVERLAY_ATTACHED }
                .mapNotNull { it.durationMillis }
                .toHistogram(),
            overlayDetachHistogram = events
                .filter { it.type == TelecomRecordedEventType.OVERLAY_DETACHED }
                .mapNotNull { it.durationMillis }
                .toHistogram(),
            reliabilityScore = reliability,
        )
        record(reason, export)
        return export
    }

    private fun TelecomRecordedEvent.toDiagnosticsEvent(): PilotDiagnosticsEvent {
        return PilotDiagnosticsEvent(
            type = type,
            timestampMillis = timestampMillis,
            manufacturer = manufacturer,
            androidSdk = androidSdk,
            activationPath = activationPath,
            attributes = attributes.filterKeys { key ->
                key.lowercase() !in bannedExportKeys
            },
            durationMillis = durationMillis,
            hasSession = sessionKey != null,
        )
    }

    private fun List<Long>.toHistogram(): PilotLatencyHistogram {
        return PilotLatencyHistogram(
            sampleCount = size,
            under100Millis = count { it < 100 },
            under150Millis = count { it >= 100 && it < 150 },
            under250Millis = count { it >= 150 && it < 250 },
            over250Millis = count { it >= 250 },
        )
    }

    private fun record(
        reason: String,
        export: PilotDiagnosticsExport,
    ) {
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.PILOT_DIAGNOSTICS_EXPORTED,
                sessionKey = null,
                timestampMillis = export.generatedAtMillis,
                activationPath = "phase_2a_internal_telecom_pilot",
                attributes = mapOf(
                    "reason" to reason,
                    "event_count" to export.eventCount.toString(),
                    "lifecycle_events" to export.lifecycleEvents.size.toString(),
                    "watchdog_events" to export.watchdogEvents.size.toString(),
                    "oem_anomalies" to export.oemAnomalies.size.toString(),
                    "attach_samples" to export.overlayAttachHistogram.sampleCount.toString(),
                    "detach_samples" to export.overlayDetachHistogram.sampleCount.toString(),
                    "score" to export.reliabilityScore?.score.toString(),
                ),
            ),
        )
    }

    private companion object {
        val bannedExportKeys = setOf(
            "phone",
            "phone_number",
            "number",
            "caller",
            "caller_name",
            "contact",
            "contact_name",
            "transcript",
            "audio",
            "recording",
        )
    }
}
