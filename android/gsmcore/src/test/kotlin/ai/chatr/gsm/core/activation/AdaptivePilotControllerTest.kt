package ai.chatr.gsm.core.activation

import ai.chatr.gsm.core.telecom.OperationalLatencyTrend
import ai.chatr.gsm.core.telecom.OperationalRate
import ai.chatr.gsm.core.telecom.OemOperationalStats
import ai.chatr.gsm.core.telecom.ReliabilityTrendReport
import ai.chatr.gsm.core.telecom.ReliabilityTrendSignal
import ai.chatr.gsm.core.telecom.TelecomIncident
import ai.chatr.gsm.core.telecom.TelecomIncidentSeverity
import ai.chatr.gsm.core.telecom.TelecomIncidentSummary
import ai.chatr.gsm.core.telecom.TelecomIncidentType
import ai.chatr.gsm.core.telecom.TelecomOperationalDashboardSnapshot
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AdaptivePilotControllerTest {
    @Test
    fun criticalIncidentEscalatesRollback() {
        val controller = AdaptivePilotController()

        val decision = controller.adapt(
            reason = "test",
            currentRules = rules(),
            dashboard = dashboard(
                incidentSummary = incidentSummary(TelecomIncidentSeverity.CRITICAL),
            ),
            trend = trend(),
        )

        assertEquals(AdaptivePilotAction.ESCALATE_ROLLBACK, decision.action)
        assertFalse(decision.recommendedRules.enabled)
        assertEquals(0, decision.recommendedRolloutPercentage)
    }

    @Test
    fun unstableOemIsThrottledOutOfRules() {
        val controller = AdaptivePilotController()

        val decision = controller.adapt(
            reason = "test",
            currentRules = rules(),
            dashboard = dashboard(
                oemStats = listOf(
                    OemOperationalStats(
                        manufacturer = "Samsung",
                        eventCount = 10,
                        overlaySuccessRate = OperationalRate(8, 10),
                        watchdogInterventions = 2,
                        cleanupFailures = 0,
                        incidentCount = 3,
                    ),
                ),
            ),
            trend = trend(),
        )

        assertEquals(AdaptivePilotAction.THROTTLE_OEM, decision.action)
        assertTrue("Samsung" in decision.suppressedManufacturers)
        assertTrue("Samsung" !in decision.recommendedRules.allowedManufacturerFamilies)
    }

    @Test
    fun androidVersionIncidentVolumeSuppressesSdk() {
        val controller = AdaptivePilotController()

        val decision = controller.adapt(
            reason = "test",
            currentRules = rules(),
            dashboard = dashboard(
                incidentSummary = TelecomIncidentSummary(
                    totalCount = 3,
                    byType = mapOf(TelecomIncidentType.CALLBACK_DRIFT to 3),
                    highestSeverity = TelecomIncidentSeverity.MEDIUM,
                    incidents = List(3) {
                        incident(androidSdk = 34, severity = TelecomIncidentSeverity.MEDIUM)
                    },
                ),
            ),
            trend = trend(),
        )

        assertEquals(AdaptivePilotAction.SUPPRESS_ANDROID_VERSION, decision.action)
        assertTrue(34 in decision.suppressedAndroidSdks)
        assertTrue(34 !in decision.recommendedRules.allowedAndroidSdks)
    }

    private fun rules(): GsmPilotRolloutRules {
        return GsmPilotRolloutRules(
            enabled = true,
            allowedManufacturerFamilies = setOf("Pixel", "Samsung"),
            allowedAndroidSdks = setOf(34, 35),
            rolloutPercentage = 10,
        )
    }

    private fun dashboard(
        incidentSummary: TelecomIncidentSummary = TelecomIncidentSummary(
            totalCount = 0,
            byType = emptyMap(),
            highestSeverity = null,
            incidents = emptyList(),
        ),
        oemStats: List<OemOperationalStats> = listOf(
            OemOperationalStats(
                manufacturer = "Pixel",
                eventCount = 10,
                overlaySuccessRate = OperationalRate(10, 10),
                watchdogInterventions = 0,
                cleanupFailures = 0,
                incidentCount = 0,
            ),
        ),
    ): TelecomOperationalDashboardSnapshot {
        return TelecomOperationalDashboardSnapshot(
            generatedAtMillis = 100L,
            activationAllowedCount = 5,
            activationDeniedCount = 0,
            overlaySuccessRate = OperationalRate(10, 10),
            watchdogInterventions = 0,
            cleanupFailures = 0,
            attachLatencyTrend = OperationalLatencyTrend(1, 80L, 90L, 90L),
            detachLatencyTrend = OperationalLatencyTrend(1, 120L, 130L, 130L),
            oemStability = oemStats,
            incidentSummary = incidentSummary,
        )
    }

    private fun trend(
        rollback: Boolean = false,
        signals: Set<ReliabilityTrendSignal> = emptySet(),
    ): ReliabilityTrendReport {
        return ReliabilityTrendReport(
            healthy = signals.isEmpty(),
            signals = signals,
            metrics = emptyList(),
            affectedManufacturers = emptySet(),
            recommendedRollback = rollback,
        )
    }

    private fun incident(
        androidSdk: Int = 35,
        severity: TelecomIncidentSeverity,
    ): TelecomIncident {
        return TelecomIncident(
            type = TelecomIncidentType.CALLBACK_DRIFT,
            severity = severity,
            sourceEventType = TelecomRecordedEventType.TELECOM_HEALTH_REPORTED,
            timestampMillis = 100L,
            manufacturer = "Google",
            androidSdk = androidSdk,
            reason = "test",
        )
    }

    private fun incidentSummary(severity: TelecomIncidentSeverity): TelecomIncidentSummary {
        val incident = incident(severity = severity)
        return TelecomIncidentSummary(
            totalCount = 1,
            byType = mapOf(incident.type to 1),
            highestSeverity = severity,
            incidents = listOf(incident),
        )
    }
}
