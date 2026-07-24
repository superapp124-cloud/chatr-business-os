package ai.chatr.gsm.core.safety

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.activation.AdaptivePilotController
import ai.chatr.gsm.core.activation.GsmPilotRolloutRules
import ai.chatr.gsm.core.telecom.NoOpTelecomEventRecorder
import ai.chatr.gsm.core.telecom.PilotConfidenceLevel
import ai.chatr.gsm.core.telecom.PilotConfidenceReport
import ai.chatr.gsm.core.telecom.ReliabilityTrendReport
import ai.chatr.gsm.core.telecom.TelecomAnomalyCorrelationReport
import ai.chatr.gsm.core.telecom.TelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomOperationalDashboardSnapshot
import ai.chatr.gsm.core.telecom.TelecomRecordedEvent
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import ai.chatr.gsm.core.telecom.TelecomStabilityBaselineReport
import ai.chatr.gsm.core.telecom.TelecomStabilityViolation
import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class SilentRollbackStage {
    NONE,
    PARTIAL_OVERLAY_DISABLE,
    OEM_TARGETED_ROLLBACK,
    ROLLOUT_CONTRACTION,
    EMERGENCY_TELECOM_DISABLE,
}

data class SilentRollbackDecision(
    val stage: SilentRollbackStage,
    val reason: String,
    val recommendedRules: GsmPilotRolloutRules,
    val disabledFeatures: Set<GsmFeature>,
    val targetOems: Set<String>,
    val targetAndroidSdks: Set<Int>,
    val fallbackDecision: SilentFallbackDecision?,
    val preservesCarrierCalling: Boolean = true,
)

class SilentRollbackOrchestrator(
    private val fallbackController: SilentFallbackController = SilentFallbackController(),
    private val adaptivePilotController: AdaptivePilotController = AdaptivePilotController(),
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun orchestrate(
        reason: String,
        currentRules: GsmPilotRolloutRules,
        baseline: TelecomStabilityBaselineReport,
        confidence: PilotConfidenceReport,
        anomalyReport: TelecomAnomalyCorrelationReport,
        dashboard: TelecomOperationalDashboardSnapshot,
        trend: ReliabilityTrendReport,
    ): SilentRollbackDecision {
        val stage = when {
            confidence.level == PilotConfidenceLevel.ROLLBACK ||
                TelecomStabilityViolation.CRITICAL_INCIDENT_THRESHOLD in baseline.violations ->
                SilentRollbackStage.EMERGENCY_TELECOM_DISABLE
            anomalyReport.affectedOems.isNotEmpty() || anomalyReport.affectedAndroidSdks.isNotEmpty() ->
                SilentRollbackStage.OEM_TARGETED_ROLLBACK
            baseline.violations.any { it.isOverlayOnlyViolation() } ->
                SilentRollbackStage.PARTIAL_OVERLAY_DISABLE
            confidence.level == PilotConfidenceLevel.HOLD || trend.recommendedRollback ->
                SilentRollbackStage.ROLLOUT_CONTRACTION
            else -> SilentRollbackStage.NONE
        }

        val adaptiveDecision = adaptivePilotController.adapt(
            reason = "rollback_$reason",
            currentRules = currentRules,
            dashboard = dashboard,
            trend = trend,
        )
        val fallbackDecision = when (stage) {
            SilentRollbackStage.PARTIAL_OVERLAY_DISABLE -> fallbackController.apply(
                SilentFallbackDecision(
                    action = SilentFallbackAction.DISABLE_OVERLAY,
                    feature = GsmFeature.OVERLAY,
                    reason = "rollback_$reason",
                ),
            )
            SilentRollbackStage.EMERGENCY_TELECOM_DISABLE -> fallbackController.apply(
                SilentFallbackDecision(
                    action = SilentFallbackAction.DISABLE_GSM_LAYER,
                    feature = GsmFeature.PASSIVE_CALL_OBSERVATION,
                    reason = "rollback_$reason",
                ),
            )
            SilentRollbackStage.OEM_TARGETED_ROLLBACK,
            SilentRollbackStage.ROLLOUT_CONTRACTION,
            SilentRollbackStage.NONE -> null
        }
        val recommendedRules = when (stage) {
            SilentRollbackStage.EMERGENCY_TELECOM_DISABLE -> currentRules.copy(
                enabled = false,
                rolloutPercentage = 0,
            )
            SilentRollbackStage.OEM_TARGETED_ROLLBACK -> currentRules.copy(
                allowedManufacturerFamilies = currentRules.allowedManufacturerFamilies - anomalyReport.affectedOems,
                allowedAndroidSdks = currentRules.allowedAndroidSdks - anomalyReport.affectedAndroidSdks,
                rolloutPercentage = currentRules.rolloutPercentage.coerceAtMost(5),
            )
            SilentRollbackStage.ROLLOUT_CONTRACTION -> adaptiveDecision.recommendedRules
            SilentRollbackStage.PARTIAL_OVERLAY_DISABLE,
            SilentRollbackStage.NONE -> currentRules
        }
        val decision = SilentRollbackDecision(
            stage = stage,
            reason = stage.reasonText(confidence, baseline),
            recommendedRules = recommendedRules,
            disabledFeatures = when (stage) {
                SilentRollbackStage.PARTIAL_OVERLAY_DISABLE -> setOf(GsmFeature.OVERLAY)
                SilentRollbackStage.EMERGENCY_TELECOM_DISABLE -> setOf(GsmFeature.GSM_INTELLIGENCE)
                else -> emptySet()
            },
            targetOems = anomalyReport.affectedOems,
            targetAndroidSdks = anomalyReport.affectedAndroidSdks,
            fallbackDecision = fallbackDecision,
        )
        record(reason, decision)
        return decision
    }

    private fun TelecomStabilityViolation.isOverlayOnlyViolation(): Boolean {
        return this == TelecomStabilityViolation.OVERLAY_LEAK_THRESHOLD ||
            this == TelecomStabilityViolation.WATCHDOG_FREQUENCY_THRESHOLD ||
            this == TelecomStabilityViolation.OVERLAY_ATTACH_P95_THRESHOLD ||
            this == TelecomStabilityViolation.LATENCY_VARIANCE_THRESHOLD ||
            this == TelecomStabilityViolation.OVERLAY_SUCCESS_RATE_THRESHOLD
    }

    private fun SilentRollbackStage.reasonText(
        confidence: PilotConfidenceReport,
        baseline: TelecomStabilityBaselineReport,
    ): String {
        return when (this) {
            SilentRollbackStage.NONE -> "stable"
            SilentRollbackStage.PARTIAL_OVERLAY_DISABLE -> "overlay_baseline_${baseline.violations.joinToString("_") { it.name.lowercase() }}"
            SilentRollbackStage.OEM_TARGETED_ROLLBACK -> "systemic_anomaly"
            SilentRollbackStage.ROLLOUT_CONTRACTION -> "confidence_${confidence.level.name.lowercase()}"
            SilentRollbackStage.EMERGENCY_TELECOM_DISABLE -> "emergency_${confidence.level.name.lowercase()}"
        }
    }

    private fun record(
        reason: String,
        decision: SilentRollbackDecision,
    ) {
        val attributes = mapOf(
            "reason" to reason,
            "stage" to decision.stage.name,
            "decision_reason" to decision.reason,
            "rollout_percentage" to decision.recommendedRules.rolloutPercentage.toString(),
            "enabled" to decision.recommendedRules.enabled.toString(),
            "disabled_features" to decision.disabledFeatures.joinToString { it.name },
            "target_oems" to decision.targetOems.joinToString(),
            "target_android_sdks" to decision.targetAndroidSdks.joinToString(),
            "preserves_carrier_calling" to decision.preservesCarrierCalling.toString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.SILENT_ROLLBACK_ORCHESTRATED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_2c_operational_validation",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.SILENT_ROLLBACK_ORCHESTRATED,
                attributes = attributes,
            ),
        )
    }
}
