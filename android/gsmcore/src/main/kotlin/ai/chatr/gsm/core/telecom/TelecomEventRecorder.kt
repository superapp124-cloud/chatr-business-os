package ai.chatr.gsm.core.telecom

import android.os.Build
import java.util.ArrayDeque

enum class TelecomRecordedEventType {
    SESSION_TRANSITION,
    CALLBACK_IGNORED,
    CALLBACK_FAILURE,
    OVERLAY_ATTACH_REQUESTED,
    OVERLAY_ATTACHED,
    OVERLAY_ATTACH_FAILED,
    OVERLAY_DETACH_REQUESTED,
    OVERLAY_DETACHED,
    OVERLAY_DETACH_FAILED,
    OVERLAY_WATCHDOG_ACTION,
    CLEANUP_SUCCEEDED,
    CLEANUP_FAILED,
    SAFETY_RECOVERY_ACTION,
    PROCESS_RECOVERY_RECONCILED,
    MULTI_CALL_CONFLICT_RESOLVED,
    BLUETOOTH_STATE_REPORTED,
    OEM_PROFILE_REPORTED,
    TELECOM_HEALTH_REPORTED,
    SESSION_CONSISTENCY_AUDIT,
    OVERLAY_LATENCY_PROFILED,
    TELECOM_MEMORY_GUARD_REPORTED,
    LIFECYCLE_EXHAUSTION_TEST_REPORTED,
    APP_UPGRADE_RECOVERY_VALIDATED,
    OVERNIGHT_IDLE_REPORTED,
    PILOT_ROLLOUT_DECISION,
    RELIABILITY_SCORE_REPORTED,
    SILENT_FALLBACK_APPLIED,
    PILOT_DIAGNOSTICS_EXPORTED,
    OPERATIONAL_DASHBOARD_REPORTED,
    RELIABILITY_TREND_ANALYZED,
    ADAPTIVE_PILOT_DECISION,
    TELECOM_INCIDENT_CLASSIFIED,
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

data class TelecomRecordedEvent(
    val type: TelecomRecordedEventType,
    val sessionKey: Int?,
    val timestampMillis: Long,
    val manufacturer: String = Build.MANUFACTURER.orEmpty().ifBlank { "unknown" },
    val androidSdk: Int = Build.VERSION.SDK_INT,
    val activationPath: String,
    val attributes: Map<String, String> = emptyMap(),
    val durationMillis: Long? = null,
)

interface TelecomEventRecorder {
    fun record(event: TelecomRecordedEvent)
    fun snapshot(): List<TelecomRecordedEvent>
    fun clear()
}

object NoOpTelecomEventRecorder : TelecomEventRecorder {
    override fun record(event: TelecomRecordedEvent) = Unit
    override fun snapshot(): List<TelecomRecordedEvent> = emptyList()
    override fun clear() = Unit
}

class BoundedInMemoryTelecomEventRecorder(
    private val maxEvents: Int = 300,
) : TelecomEventRecorder {
    private val lock = Any()
    private val events = ArrayDeque<TelecomRecordedEvent>()

    override fun record(event: TelecomRecordedEvent) {
        synchronized(lock) {
            events.addLast(event.sanitized())
            while (events.size > maxEvents) {
                events.removeFirst()
            }
        }
    }

    override fun snapshot(): List<TelecomRecordedEvent> {
        return synchronized(lock) { events.toList() }
    }

    override fun clear() {
        synchronized(lock) {
            events.clear()
        }
    }

    private fun TelecomRecordedEvent.sanitized(): TelecomRecordedEvent {
        return copy(
            attributes = attributes.filterKeys { key ->
                key.lowercase() !in bannedKeys
            },
        )
    }

    companion object {
        private val bannedKeys = setOf(
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
