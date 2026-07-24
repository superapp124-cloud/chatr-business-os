package ai.chatr.gsm.core.telecom

import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class RolloutRiskLevel {
    LOW,
    WATCH,
    HIGH,
    CRITICAL,
}

enum class RolloutRiskAction {
    CONTINUE,
    WATCH_ONLY,
    HOLD_EXPANSION,
    CONTRACT_ROLLOUT,
    REQUEST_ROLLBACK,
}

data class RolloutRiskPrediction(
    val riskLevel: RolloutRiskLevel,
    val recommendedAction: RolloutRiskAction,
    val rolloutInstabilityProbability: Float,
    val oemRiskEscalationProbability: Float,
    val lifecycleDegradationProbability: Float,
    val overlayFailureProbability: Float,
    val affectedOems: Set<String>,
    val affectedAndroidSdks: Set<Int>,
    val trend: ReliabilityTrendReport,
    val anomalyReport: TelecomAnomalyCorrelationReport,
    val ledger: TelecomReliabilityLedgerSnapshot,
)

class RolloutRiskPredictor(
    private val trendAnalyzer: ReliabilityTrendAnalyzer,
    private val anomalyCorrelator: TelecomAnomalyCorrelator,
    private val reliabilityLedger: TelecomReliabilityLedger,
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun predict(
        reason: String,
        windowMillis: Long = 7 * 24 * 60 * 60 * 1000L,
    ): RolloutRiskPrediction {
        val trend = trendAnalyzer.analyze("risk_$reason", windowMillis)
        val anomalyReport = anomalyCorrelator.correlate("risk_$reason", windowMillis)
        val ledger = reliabilityLedger.snapshot("risk_$reason", windowMillis)
        val rolloutInstability = (
            trend.rollbackWeight() +
                anomalyReport.systemicWeight() +
                ledger.rollbackWeight() +
                ledger.confidenceRiskWeight()
            ).coerceIn(0f, 1f)
        val oemRisk = (
            anomalyReport.oemWeight() +
                ledger.oemRiskWeight()
            ).coerceIn(0f, 1f)
        val lifecycleRisk = (
            trend.lifecycleWeight() +
                ledger.cleanupRiskWeight()
            ).coerceIn(0f, 1f)
        val overlayRisk = (
            trend.overlayWeight() +
                ledger.watchdogRiskWeight() +
                anomalyReport.overlayClusterWeight()
            ).coerceIn(0f, 1f)
        val peakRisk = listOf(rolloutInstability, oemRisk, lifecycleRisk, overlayRisk).maxOrNull() ?: 0f
        val level = when {
            peakRisk >= 0.75f -> RolloutRiskLevel.CRITICAL
            peakRisk >= 0.55f -> RolloutRiskLevel.HIGH
            peakRisk >= 0.30f -> RolloutRiskLevel.WATCH
            else -> RolloutRiskLevel.LOW
        }
        val action = when (level) {
            RolloutRiskLevel.CRITICAL -> RolloutRiskAction.REQUEST_ROLLBACK
            RolloutRiskLevel.HIGH -> RolloutRiskAction.CONTRACT_ROLLOUT
            RolloutRiskLevel.WATCH -> RolloutRiskAction.HOLD_EXPANSION
            RolloutRiskLevel.LOW -> RolloutRiskAction.CONTINUE
        }
        val prediction = RolloutRiskPrediction(
            riskLevel = level,
            recommendedAction = action,
            rolloutInstabilityProbability = rolloutInstability,
            oemRiskEscalationProbability = oemRisk,
            lifecycleDegradationProbability = lifecycleRisk,
            overlayFailureProbability = overlayRisk,
            affectedOems = anomalyReport.affectedOems + trend.affectedManufacturers + ledger.unstableOems(),
            affectedAndroidSdks = anomalyReport.affectedAndroidSdks + ledger.unstableAndroidSdks(),
            trend = trend,
            anomalyReport = anomalyReport,
            ledger = ledger,
        )
        record(reason, prediction)
        return prediction
    }

    private fun ReliabilityTrendReport.rollbackWeight(): Float {
        return if (recommendedRollback) 0.35f else 0f
    }

    private fun ReliabilityTrendReport.lifecycleWeight(): Float {
        var weight = 0f
        if (ReliabilityTrendSignal.LIFECYCLE_DRIFT_INCREASE in signals) weight += 0.45f
        if (ReliabilityTrendSignal.MEMORY_TREND_GROWTH in signals) weight += 0.25f
        if (ReliabilityTrendSignal.ROLLING_CRASH_RISK in signals) weight += 0.30f
        return weight
    }

    private fun ReliabilityTrendReport.overlayWeight(): Float {
        return if (ReliabilityTrendSignal.OVERLAY_DEGRADATION in signals) 0.45f else 0f
    }

    private fun TelecomAnomalyCorrelationReport.systemicWeight(): Float {
        return if (hasSystemicAnomaly) 0.25f else 0f
    }

    private fun TelecomAnomalyCorrelationReport.oemWeight(): Float {
        return (affectedOems.size * 0.25f).coerceAtMost(0.5f)
    }

    private fun TelecomAnomalyCorrelationReport.overlayClusterWeight(): Float {
        return if (clusters.any { TelecomIncidentType.OVERLAY_LEAK in it.incidentTypes ||
                TelecomIncidentType.WATCHDOG_TRIGGERED_CLEANUP in it.incidentTypes ||
                TelecomIncidentType.OEM_SUPPRESSION in it.incidentTypes
            }
        ) {
            0.25f
        } else {
            0f
        }
    }

    private fun TelecomReliabilityLedgerSnapshot.rollbackWeight(): Float {
        return (rollbackFrequency * 0.10f).coerceAtMost(0.35f)
    }

    private fun TelecomReliabilityLedgerSnapshot.confidenceRiskWeight(): Float {
        val latest = confidenceTrend.latestScore ?: 100
        val directionPenalty = if (confidenceTrend.direction == ReliabilityTrendDirection.DEGRADING) 0.15f else 0f
        return (((100 - latest).coerceAtLeast(0) / 100f) * 0.25f + directionPenalty).coerceAtMost(0.40f)
    }

    private fun TelecomReliabilityLedgerSnapshot.oemRiskWeight(): Float {
        val riskyOemCount = oemStability.count {
            it.cleanupFailures > 0 ||
                it.watchdogEvents >= 2 ||
                it.rollbackEvents > 0
        }
        return (riskyOemCount * 0.20f).coerceAtMost(0.5f)
    }

    private fun TelecomReliabilityLedgerSnapshot.cleanupRiskWeight(): Float {
        val cleanupFailures = oemStability.sumOf { it.cleanupFailures }
        return (cleanupFailures * 0.15f).coerceAtMost(0.45f)
    }

    private fun TelecomReliabilityLedgerSnapshot.watchdogRiskWeight(): Float {
        return (watchdogEventCount * 0.12f).coerceAtMost(0.45f)
    }

    private fun TelecomReliabilityLedgerSnapshot.unstableOems(): Set<String> {
        return oemStability
            .filter {
                it.cleanupFailures > 0 ||
                    it.watchdogEvents >= 2 ||
                    it.rollbackEvents > 0
            }
            .map { it.key }
            .toSet()
    }

    private fun TelecomReliabilityLedgerSnapshot.unstableAndroidSdks(): Set<Int> {
        return androidVersionStability
            .filter {
                it.cleanupFailures > 0 ||
                    it.watchdogEvents >= 2 ||
                    it.rollbackEvents > 0
            }
            .mapNotNull { it.key.toIntOrNull() }
            .toSet()
    }

    private fun record(
        reason: String,
        prediction: RolloutRiskPrediction,
    ) {
        val attributes = mapOf(
            "reason" to reason,
            "risk_level" to prediction.riskLevel.name,
            "action" to prediction.recommendedAction.name,
            "rollout_instability" to prediction.rolloutInstabilityProbability.percentString(),
            "oem_risk" to prediction.oemRiskEscalationProbability.percentString(),
            "lifecycle_risk" to prediction.lifecycleDegradationProbability.percentString(),
            "overlay_risk" to prediction.overlayFailureProbability.percentString(),
            "affected_oems" to prediction.affectedOems.joinToString(),
            "affected_android_sdks" to prediction.affectedAndroidSdks.joinToString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.ROLLOUT_RISK_PREDICTED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_2d_long_horizon_maturity",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.ROLLOUT_RISK_PREDICTED,
                attributes = attributes,
            ),
        )
    }

    private fun Float.percentString(): String {
        return (this * 100f).toInt().toString()
    }
}
