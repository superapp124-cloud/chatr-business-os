package ai.chatr.gsm.core.telecom

enum class AppUpgradeRecoveryScenario {
    DORMANT_GSM_STATE,
    ACTIVE_GSM_OBSERVATION,
    OVERLAY_VISIBLE_DURING_UPGRADE,
    SERVICE_RECREATED_AFTER_PACKAGE_REPLACE,
}

enum class AppUpgradeRecoveryRisk {
    ORPHAN_OVERLAY_REQUIRES_DETACH,
    STALE_SESSION_REQUIRES_CLEANUP,
    TELECOM_CALLBACK_MISMATCH,
    MEMORY_RETENTION_DETECTED,
}

data class AppUpgradeRecoveryReport(
    val safeToContinue: Boolean,
    val scenario: AppUpgradeRecoveryScenario,
    val risks: Set<AppUpgradeRecoveryRisk>,
    val recoveryActions: Set<TelecomProcessRecoveryAction>,
    val staleSessionCount: Int,
    val activeSessionCount: Int,
    val memoryHealthy: Boolean,
)

class AppUpgradeRecoveryValidator(
    private val recoveryCoordinator: TelecomProcessRecoveryCoordinator,
    private val memoryGuard: TelecomMemoryGuard,
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun validate(
        scenario: AppUpgradeRecoveryScenario,
        overlaySnapshot: ProcessRecoveryOverlaySnapshot? = null,
    ): AppUpgradeRecoveryReport {
        val recoveryDecision = recoveryCoordinator.reconcile(
            reason = TelecomProcessRecoveryReason.APP_UPGRADED,
            overlaySnapshot = overlaySnapshot,
        )
        val memoryReport = memoryGuard.evaluate("app_upgrade_${scenario.name.lowercase()}")
        val risks = buildSet {
            if (TelecomProcessRecoveryAction.DETACH_ORPHAN_OVERLAY in recoveryDecision.actions) {
                add(AppUpgradeRecoveryRisk.ORPHAN_OVERLAY_REQUIRES_DETACH)
            }
            if (TelecomProcessRecoveryAction.MARK_CLEANUP_COMPLETE in recoveryDecision.actions) {
                add(AppUpgradeRecoveryRisk.STALE_SESSION_REQUIRES_CLEANUP)
            }
            if (TelecomProcessRecoveryAction.REPORT_TELECOM_MISMATCH in recoveryDecision.actions) {
                add(AppUpgradeRecoveryRisk.TELECOM_CALLBACK_MISMATCH)
            }
            if (!memoryReport.healthy) {
                add(AppUpgradeRecoveryRisk.MEMORY_RETENTION_DETECTED)
            }
        }
        val report = AppUpgradeRecoveryReport(
            safeToContinue = AppUpgradeRecoveryRisk.TELECOM_CALLBACK_MISMATCH !in risks &&
                AppUpgradeRecoveryRisk.MEMORY_RETENTION_DETECTED !in risks,
            scenario = scenario,
            risks = risks,
            recoveryActions = recoveryDecision.actions,
            staleSessionCount = recoveryDecision.staleSessionKeys.size,
            activeSessionCount = recoveryDecision.activeSessionCount,
            memoryHealthy = memoryReport.healthy,
        )
        record(report)
        return report
    }

    private fun record(report: AppUpgradeRecoveryReport) {
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.APP_UPGRADE_RECOVERY_VALIDATED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_1f_long_run_validation",
                attributes = mapOf(
                    "scenario" to report.scenario.name,
                    "safe_to_continue" to report.safeToContinue.toString(),
                    "risks" to report.risks.joinToString { it.name },
                    "actions" to report.recoveryActions.joinToString { it.name },
                    "stale_sessions" to report.staleSessionCount.toString(),
                    "active_sessions" to report.activeSessionCount.toString(),
                    "memory_healthy" to report.memoryHealthy.toString(),
                ),
            ),
        )
    }
}
