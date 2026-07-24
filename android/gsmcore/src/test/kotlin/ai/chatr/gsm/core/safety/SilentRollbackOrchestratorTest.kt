package ai.chatr.gsm.core.safety

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.activation.AdaptivePilotController
import ai.chatr.gsm.core.activation.GsmPilotRolloutRules
import ai.chatr.gsm.core.telecom.OperationalLatencyTrend
import ai.chatr.gsm.core.telecom.OperationalRate
import ai.chatr.gsm.core.telecom.PilotConfidenceComponents
import ai.chatr.gsm.core.telecom.PilotConfidenceLevel
import ai.chatr.gsm.core.telecom.PilotConfidenceReport
import ai.chatr.gsm.core.telecom.ReliabilityTrendReport
import ai.chatr.gsm.core.telecom.BoundedInMemoryTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomAnomalyCorrelationReport
import ai.chatr.gsm.core.telecom.TelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomIncidentSummary
import ai.chatr.gsm.core.telecom.TelecomOperationalDashboardSnapshot
import ai.chatr.gsm.core.telecom.TelecomStabilityBaselineReport
import ai.chatr.gsm.core.telecom.TelecomStabilityViolation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SilentRollbackOrchestratorTest {
    @Test
    fun overlayOnlyBaselineViolationDisablesOverlayFirst() {
        val recoveryManager = GsmSafetyRecoveryManager()
        val orchestrator = orchestrator(recoveryManager)
        val baseline = baseline(
            acceptable = false,
            violations = setOf(TelecomStabilityViolation.OVERLAY_ATTACH_P95_THRESHOLD),
        )

        val decision = orchestrator.orchestrate(
            reason = "slow_overlay",
            currentRules = GsmPilotRolloutRules.pixelAndSamsungInternal(percent = 20),
            baseline = baseline,
            confidence = confidence(PilotConfidenceLevel.READY, baseline),
            anomalyReport = anomaly(),
            dashboard = dashboard(),
            trend = trend(),
        )

        assertEquals(SilentRollbackStage.PARTIAL_OVERLAY_DISABLE, decision.stage)
        assertEquals(setOf(GsmFeature.OVERLAY), decision.disabledFeatures)
        assertTrue(recoveryManager.isFeatureAutoDisabled(GsmFeature.OVERLAY))
        assertTrue(decision.preservesCarrierCalling)
    }

    @Test
    fun oemAnomalyContractsAllowedManufacturers() {
        val baseline = baseline()
        val orchestrator = orchestrator()

        val decision = orchestrator.orchestrate(
            reason = "samsung_cluster",
            currentRules = GsmPilotRolloutRules.pixelAndSamsungInternal(percent = 20),
            baseline = baseline,
            confidence = confidence(PilotConfidenceLevel.READY, baseline),
            anomalyReport = anomaly(affectedOems = setOf("Samsung")),
            dashboard = dashboard(),
            trend = trend(),
        )

        assertEquals(SilentRollbackStage.OEM_TARGETED_ROLLBACK, decision.stage)
        assertFalse("Samsung" in decision.recommendedRules.allowedManufacturerFamilies)
        assertEquals(5, decision.recommendedRules.rolloutPercentage)
    }

    @Test
    fun rollbackConfidenceDisablesGsmLayer() {
        val recoveryManager = GsmSafetyRecoveryManager()
        val orchestrator = orchestrator(recoveryManager)
        val baseline = baseline()

        val decision = orchestrator.orchestrate(
            reason = "critical_confidence",
            currentRules = GsmPilotRolloutRules.pixelAndSamsungInternal(percent = 20),
            baseline = baseline,
            confidence = confidence(PilotConfidenceLevel.ROLLBACK, baseline),
            anomalyReport = anomaly(),
            dashboard = dashboard(),
            trend = trend(),
        )

        assertEquals(SilentRollbackStage.EMERGENCY_TELECOM_DISABLE, decision.stage)
        assertEquals(0, decision.recommendedRules.rolloutPercentage)
        assertFalse(decision.recommendedRules.enabled)
        assertTrue(GsmFeature.GSM_INTELLIGENCE in decision.disabledFeatures)
        assertTrue(recoveryManager.isFeatureAutoDisabled(GsmFeature.GSM_INTELLIGENCE))
    }

    private fun orchestrator(
        recoveryManager: GsmSafetyRecoveryManager = GsmSafetyRecoveryManager(),
        recorder: TelecomEventRecorder = BoundedInMemoryTelecomEventRecorder(),
    ): SilentRollbackOrchestrator {
        return SilentRollbackOrchestrator(
            fallbackController = SilentFallbackController(
                recoveryManager = recoveryManager,
                recorder = recorder,
            ),
            adaptivePilotController = AdaptivePilotController(recorder = recorder),
            recorder = recorder,
        )
    }

    private fun confidence(
        level: PilotConfidenceLevel,
        baseline: TelecomStabilityBaselineReport,
    ): PilotConfidenceReport {
        return PilotConfidenceReport(
            score = if (level == PilotConfidenceLevel.ROLLBACK) 40 else 95,
            level = level,
            expansionAllowed = level == PilotConfidenceLevel.READY,
            reasons = emptySet(),
            components = PilotConfidenceComponents(
                crashFreeRuntime = 100,
                cleanupCorrectness = 100,
                watchdogStability = 100,
                oemStability = 100,
                memoryTrend = 100,
                callbackReconciliation = 100,
            ),
            baseline = baseline,
            trend = trend(),
        )
    }

    private fun baseline(
        acceptable: Boolean = true,
        violations: Set<TelecomStabilityViolation> = emptySet(),
    ): TelecomStabilityBaselineReport {
        return TelecomStabilityBaselineReport(
            acceptable = acceptable,
            violations = violations,
            evaluatedEventCount = 1,
            overlayLeakIncidents = 0,
            callbackDriftIncidents = 0,
            memoryRiskEvents = 0,
            cleanupFailureEvents = 0,
            watchdogInterventions = 0,
            criticalIncidents = 0,
            overlayAttachP95Millis = 90L,
            overlayAttachLatencyRangeMillis = 0L,
            overlaySuccessRate = OperationalRate(1, 1),
            cleanupSuccessRate = OperationalRate(1, 1),
        )
    }

    private fun anomaly(
        affectedOems: Set<String> = emptySet(),
        affectedAndroidSdks: Set<Int> = emptySet(),
    ): TelecomAnomalyCorrelationReport {
        return TelecomAnomalyCorrelationReport(
            hasSystemicAnomaly = affectedOems.isNotEmpty() || affectedAndroidSdks.isNotEmpty(),
            clusters = emptyList(),
            affectedOems = affectedOems,
            affectedAndroidSdks = affectedAndroidSdks,
            bluetoothStates = emptySet(),
            batteryModes = emptySet(),
        )
    }

    private fun dashboard(): TelecomOperationalDashboardSnapshot {
        return TelecomOperationalDashboardSnapshot(
            generatedAtMillis = 1_000L,
            activationAllowedCount = 0,
            activationDeniedCount = 0,
            overlaySuccessRate = OperationalRate(1, 1),
            watchdogInterventions = 0,
            cleanupFailures = 0,
            attachLatencyTrend = OperationalLatencyTrend(0, null, null, null),
            detachLatencyTrend = OperationalLatencyTrend(0, null, null, null),
            oemStability = emptyList(),
            incidentSummary = TelecomIncidentSummary(
                totalCount = 0,
                byType = emptyMap(),
                highestSeverity = null,
                incidents = emptyList(),
            ),
        )
    }

    private fun trend(): ReliabilityTrendReport {
        return ReliabilityTrendReport(
            healthy = true,
            signals = emptySet(),
            metrics = emptyList(),
            affectedManufacturers = emptySet(),
            recommendedRollback = false,
        )
    }
}
