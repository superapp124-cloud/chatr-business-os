package ai.chatr.gsm.core.telecom

enum class TelecomIncidentType {
    OVERLAY_LEAK,
    CALLBACK_DRIFT,
    LIFECYCLE_DESYNC,
    PROCESS_RECOVERY_FAILURE,
    BLUETOOTH_INSTABILITY,
    OEM_SUPPRESSION,
    WATCHDOG_TRIGGERED_CLEANUP,
}

enum class TelecomIncidentSeverity {
    LOW,
    MEDIUM,
    HIGH,
    CRITICAL,
}

data class TelecomIncident(
    val type: TelecomIncidentType,
    val severity: TelecomIncidentSeverity,
    val sourceEventType: TelecomRecordedEventType,
    val timestampMillis: Long,
    val manufacturer: String,
    val androidSdk: Int,
    val reason: String,
)

data class TelecomIncidentSummary(
    val totalCount: Int,
    val byType: Map<TelecomIncidentType, Int>,
    val highestSeverity: TelecomIncidentSeverity?,
    val incidents: List<TelecomIncident>,
)

class TelecomIncidentClassifier(
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun classify(event: TelecomRecordedEvent): TelecomIncident? {
        val attributes = event.attributes
        val reason = attributes["reason"].orEmpty()
        val actions = attributes["actions"].orEmpty()
        val action = attributes["action"].orEmpty()
        val issues = attributes["issues"].orEmpty()
        val violations = attributes["violations"].orEmpty()

        val incident = when (event.type) {
            TelecomRecordedEventType.OVERLAY_WATCHDOG_ACTION -> when {
                action == "FORCE_DETACH" && reason == "overlay_call_not_active" ->
                    incident(event, TelecomIncidentType.OVERLAY_LEAK, TelecomIncidentSeverity.HIGH, reason)
                action == "FORCE_DETACH" || action == "REPORT_STUCK_OVERLAY" ->
                    incident(event, TelecomIncidentType.WATCHDOG_TRIGGERED_CLEANUP, TelecomIncidentSeverity.MEDIUM, reason)
                else -> null
            }
            TelecomRecordedEventType.SESSION_CONSISTENCY_AUDIT -> when {
                "OVERLAY_WITHOUT_SESSION" in issues || "SESSION_OVERLAY_MISMATCH" in issues ->
                    incident(event, TelecomIncidentType.LIFECYCLE_DESYNC, TelecomIncidentSeverity.HIGH, issues)
                "ORPHAN_ACTIVE_SESSION" in issues || "INVALID_TRANSITION_RECORDED" in issues ->
                    incident(event, TelecomIncidentType.CALLBACK_DRIFT, TelecomIncidentSeverity.MEDIUM, issues)
                else -> null
            }
            TelecomRecordedEventType.TELECOM_HEALTH_REPORTED -> when {
                "LIFECYCLE_DRIFT" in violations || "CALLBACK_STORM" in violations ->
                    incident(event, TelecomIncidentType.CALLBACK_DRIFT, TelecomIncidentSeverity.HIGH, violations)
                "CLEANUP_OVERDUE" in violations ->
                    incident(event, TelecomIncidentType.LIFECYCLE_DESYNC, TelecomIncidentSeverity.MEDIUM, violations)
                else -> null
            }
            TelecomRecordedEventType.PROCESS_RECOVERY_RECONCILED -> when {
                "REPORT_TELECOM_MISMATCH" in actions ->
                    incident(event, TelecomIncidentType.PROCESS_RECOVERY_FAILURE, TelecomIncidentSeverity.HIGH, actions)
                "DETACH_ORPHAN_OVERLAY" in actions ->
                    incident(event, TelecomIncidentType.OVERLAY_LEAK, TelecomIncidentSeverity.MEDIUM, actions)
                else -> null
            }
            TelecomRecordedEventType.BLUETOOTH_STATE_REPORTED -> when {
                attributes["route"] == BluetoothTelecomRoute.UNKNOWN.name &&
                    attributes["audio_mode"]?.toIntOrNull()?.let { it >= 0 } == true ->
                    incident(event, TelecomIncidentType.BLUETOOTH_INSTABILITY, TelecomIncidentSeverity.LOW, "unknown_route")
                else -> null
            }
            TelecomRecordedEventType.OVERLAY_ATTACH_FAILED -> when {
                reason.contains("oem", ignoreCase = true) ||
                    reason.contains("lockscreen", ignoreCase = true) ||
                    reason.contains("unsupported", ignoreCase = true) ->
                    incident(event, TelecomIncidentType.OEM_SUPPRESSION, TelecomIncidentSeverity.LOW, reason)
                else -> null
            }
            TelecomRecordedEventType.SILENT_FALLBACK_APPLIED -> when {
                action == "DISABLE_GSM_LAYER" ->
                    incident(event, TelecomIncidentType.PROCESS_RECOVERY_FAILURE, TelecomIncidentSeverity.CRITICAL, reason)
                action == "DISABLE_OVERLAY" ->
                    incident(event, TelecomIncidentType.WATCHDOG_TRIGGERED_CLEANUP, TelecomIncidentSeverity.MEDIUM, reason)
                else -> null
            }
            else -> null
        }
        if (incident != null) record(incident)
        return incident
    }

    fun classifyRecent(
        reason: String,
        windowMillis: Long = 60 * 60 * 1000L,
    ): TelecomIncidentSummary {
        val cutoff = now() - windowMillis
        val incidents = recorder.snapshot()
            .filter { it.timestampMillis >= cutoff }
            .mapNotNull { classify(it) }
        return TelecomIncidentSummary(
            totalCount = incidents.size,
            byType = incidents.groupingBy { it.type }.eachCount(),
            highestSeverity = incidents.maxByOrNull { it.severity.ordinal }?.severity,
            incidents = incidents,
        ).also { summary ->
            recorder.record(
                TelecomRecordedEvent(
                    type = TelecomRecordedEventType.TELECOM_INCIDENT_CLASSIFIED,
                    sessionKey = null,
                    timestampMillis = now(),
                    activationPath = "phase_2b_live_pilot_operations",
                    attributes = mapOf(
                        "reason" to reason,
                        "total_count" to summary.totalCount.toString(),
                        "highest_severity" to summary.highestSeverity?.name.orEmpty(),
                        "types" to summary.byType.keys.joinToString { it.name },
                    ),
                ),
            )
        }
    }

    private fun incident(
        event: TelecomRecordedEvent,
        type: TelecomIncidentType,
        severity: TelecomIncidentSeverity,
        reason: String,
    ): TelecomIncident {
        return TelecomIncident(
            type = type,
            severity = severity,
            sourceEventType = event.type,
            timestampMillis = event.timestampMillis,
            manufacturer = event.manufacturer,
            androidSdk = event.androidSdk,
            reason = reason,
        )
    }

    private fun record(incident: TelecomIncident) {
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.TELECOM_INCIDENT_CLASSIFIED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_2b_live_pilot_operations",
                attributes = mapOf(
                    "type" to incident.type.name,
                    "severity" to incident.severity.name,
                    "source" to incident.sourceEventType.name,
                    "oem" to incident.manufacturer,
                    "android_sdk" to incident.androidSdk.toString(),
                ),
            ),
        )
    }
}
