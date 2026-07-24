package ai.chatr.gsm.core.activation

import ai.chatr.gsm.core.telecom.NoOpTelecomEventRecorder
import ai.chatr.gsm.core.telecom.ReliabilityTrendReport
import ai.chatr.gsm.core.telecom.ReliabilityTrendSignal
import ai.chatr.gsm.core.telecom.TelecomIncidentSeverity
import ai.chatr.gsm.core.telecom.TelecomOperationalDashboardSnapshot
import ai.chatr.gsm.core.telecom.TelecomRecordedEvent
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import ai.chatr.gsm.core.telecom.TelecomEventRecorder
import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class AdaptivePilotAction {
    NONE,
    REDUCE_ROLLOUT,
    THROTTLE_OEM,
    SUPPRESS_ANDROID_VERSION,
    ESCALATE_ROLLBACK,
}

data class AdaptivePilotDecision(
    val action: AdaptivePilotAction,
    val reason: String,
    val recommendedRules: GsmPilotRolloutRules,
    val suppressedManufacturers: Set<String>,
    val suppressedAndroidSdks: Set<Int>,
    val recommendedRolloutPercentage: Int,
)

class AdaptivePilotController(
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun adapt(
        reason: String,
        currentRules: GsmPilotRolloutRules,
        dashboard: TelecomOperationalDashboardSnapshot,
        trend: ReliabilityTrendReport,
    ): AdaptivePilotDecision {
        val criticalIncident = dashboard.incidentSummary.highestSeverity == TelecomIncidentSeverity.CRITICAL
        val highIncidentVolume = dashboard.incidentSummary.totalCount >= 5
        val unstableOems = dashboard.oemStability
            .filter { stats ->
                stats.cleanupFailures > 0 ||
                    stats.watchdogInterventions >= 2 ||
                    stats.incidentCount >= 3 ||
                    stats.overlaySuccessRate.percent < 90f
            }
            .map { it.manufacturer }
            .toSet()
        val androidSdkCounts = dashboard.incidentSummary.incidents
            .groupingBy { it.androidSdk }
            .eachCount()
        val unstableSdks = androidSdkCounts
            .filter { (_, count) -> count >= 3 }
            .keys

        val action = when {
            criticalIncident || trend.recommendedRollback -> AdaptivePilotAction.ESCALATE_ROLLBACK
            unstableSdks.isNotEmpty() -> AdaptivePilotAction.SUPPRESS_ANDROID_VERSION
            unstableOems.isNotEmpty() -> AdaptivePilotAction.THROTTLE_OEM
            highIncidentVolume ||
                ReliabilityTrendSignal.OVERLAY_DEGRADATION in trend.signals ||
                dashboard.overlaySuccessRate.percent < 95f -> AdaptivePilotAction.REDUCE_ROLLOUT
            else -> AdaptivePilotAction.NONE
        }

        val rollout = when (action) {
            AdaptivePilotAction.ESCALATE_ROLLBACK -> 0
            AdaptivePilotAction.REDUCE_ROLLOUT -> (currentRules.rolloutPercentage / 2).coerceAtLeast(1)
            AdaptivePilotAction.THROTTLE_OEM,
            AdaptivePilotAction.SUPPRESS_ANDROID_VERSION -> currentRules.rolloutPercentage.coerceAtMost(5)
            AdaptivePilotAction.NONE -> currentRules.rolloutPercentage
        }.coerceIn(0, 100)
        val suppressedManufacturers = if (action == AdaptivePilotAction.THROTTLE_OEM ||
            action == AdaptivePilotAction.ESCALATE_ROLLBACK
        ) {
            unstableOems
        } else {
            emptySet()
        }
        val suppressedAndroidSdks = if (action == AdaptivePilotAction.SUPPRESS_ANDROID_VERSION ||
            action == AdaptivePilotAction.ESCALATE_ROLLBACK
        ) {
            unstableSdks
        } else {
            emptySet()
        }
        val recommendedRules = currentRules.copy(
            enabled = currentRules.enabled && action != AdaptivePilotAction.ESCALATE_ROLLBACK,
            rolloutPercentage = rollout,
            allowedManufacturerFamilies = currentRules.allowedManufacturerFamilies - suppressedManufacturers,
            allowedAndroidSdks = currentRules.allowedAndroidSdks - suppressedAndroidSdks,
        )
        val decision = AdaptivePilotDecision(
            action = action,
            reason = reasonFor(action, trend, criticalIncident, highIncidentVolume),
            recommendedRules = recommendedRules,
            suppressedManufacturers = suppressedManufacturers,
            suppressedAndroidSdks = suppressedAndroidSdks,
            recommendedRolloutPercentage = rollout,
        )
        record(reason, decision)
        return decision
    }

    private fun reasonFor(
        action: AdaptivePilotAction,
        trend: ReliabilityTrendReport,
        criticalIncident: Boolean,
        highIncidentVolume: Boolean,
    ): String {
        return when {
            action == AdaptivePilotAction.ESCALATE_ROLLBACK && criticalIncident -> "critical_incident"
            action == AdaptivePilotAction.ESCALATE_ROLLBACK && trend.recommendedRollback -> "trend_rollback"
            action == AdaptivePilotAction.SUPPRESS_ANDROID_VERSION -> "android_version_incidents"
            action == AdaptivePilotAction.THROTTLE_OEM -> "oem_instability"
            action == AdaptivePilotAction.REDUCE_ROLLOUT && highIncidentVolume -> "incident_volume"
            action == AdaptivePilotAction.REDUCE_ROLLOUT -> "overlay_degradation"
            else -> "stable"
        }
    }

    private fun record(
        reason: String,
        decision: AdaptivePilotDecision,
    ) {
        val attributes = mapOf(
            "reason" to reason,
            "action" to decision.action.name,
            "decision_reason" to decision.reason,
            "rollout_percentage" to decision.recommendedRolloutPercentage.toString(),
            "suppressed_oems" to decision.suppressedManufacturers.joinToString(),
            "suppressed_android_sdks" to decision.suppressedAndroidSdks.joinToString(),
            "enabled" to decision.recommendedRules.enabled.toString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.ADAPTIVE_PILOT_DECISION,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_2b_live_pilot_operations",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.ADAPTIVE_PILOT_DECISION,
                attributes = attributes,
            ),
        )
    }
}
