package ai.chatr.gsm.core.telemetry

enum class GsmTelemetryEventName {
    ACTIVATION_DECISION,
    PERMISSION_DENIED,
    PERMISSION_GRANTED,
    OVERLAY_RENDER_SUCCESS,
    OVERLAY_RENDER_FAILURE,
    OEM_COMPATIBILITY_REPORTED,
    LIFECYCLE_SYNC_LATENCY,
    DISCONNECT_CLEANUP_TIMING,
    AUTO_DISABLED_FOR_SAFETY,
    PILOT_ROLLOUT_DECISION,
    RELIABILITY_SCORE_REPORTED,
    SILENT_FALLBACK_APPLIED,
    OPERATIONAL_DASHBOARD_REPORTED,
    RELIABILITY_TREND_ANALYZED,
    ADAPTIVE_PILOT_DECISION,
    STABILITY_BASELINE_EVALUATED,
    PILOT_CONFIDENCE_REPORTED,
    TELECOM_ANOMALY_CORRELATED,
    SILENT_ROLLBACK_ORCHESTRATED,
    TELECOM_OPERATIONAL_SLA_MONITORED,
    ROLLOUT_RISK_PREDICTED,
    RECOVERY_EFFECTIVENESS_ANALYZED,
    TELECOM_RELIABILITY_LEDGER_UPDATED,
    GSM_SAFE_MODE_CHANGED,
    TELECOM_DEADMAN_SWITCH_TRIPPED,
    TELECOM_CRASH_LOOP_PROTECTED,
    DEVICE_READINESS_VALIDATED,
    DORMANT_SHIP_VERIFIED,
    DEVICE_VALIDATION_MATRIX_EVALUATED,
}

data class GsmTelemetryEvent(
    val name: GsmTelemetryEventName,
    val attributes: Map<String, String>,
    val durationMillis: Long? = null,
    val createdAtMillis: Long = System.currentTimeMillis(),
)

interface GsmTelemetrySink {
    fun track(event: GsmTelemetryEvent)
}

class InMemoryGsmTelemetrySink : GsmTelemetrySink {
    private val lock = Any()
    private val _events = mutableListOf<GsmTelemetryEvent>()

    val events: List<GsmTelemetryEvent>
        get() = synchronized(lock) { _events.toList() }

    override fun track(event: GsmTelemetryEvent) {
        synchronized(lock) {
            _events += event.sanitized()
        }
    }

    private fun GsmTelemetryEvent.sanitized(): GsmTelemetryEvent {
        return copy(
            attributes = attributes.filterKeys { key ->
                key !in bannedKeys
            },
        )
    }

    companion object {
        private val bannedKeys = setOf(
            "phone",
            "phone_number",
            "number",
            "transcript",
            "audio",
            "caller_name",
            "contact_name",
        )
    }
}

class NoOpGsmTelemetrySink : GsmTelemetrySink {
    override fun track(event: GsmTelemetryEvent) = Unit
}
