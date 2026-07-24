package ai.chatr.gsm.core.telecom

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.safety.GsmRecoverySignal
import ai.chatr.gsm.core.safety.GsmSafetyRecoveryManager

enum class OvernightIdleRisk {
    BATTERY_SPIKE,
    SERVICE_WAKEUP_ACCUMULATION,
    CALLBACK_ACCUMULATION,
    FOREGROUND_SERVICE_ACTIVE,
    WAKELOCK_HELD,
    MEMORY_GROWTH,
}

data class OvernightIdleThresholds(
    val minimumWindowMillis: Long = 8 * 60 * 60 * 1000L,
    val maxBatteryDropPercent: Int = 3,
    val maxServiceWakeups: Int = 2,
    val maxCallbackIncrease: Int = 0,
    val maxForegroundServices: Int = 0,
    val maxWakeLocks: Int = 0,
    val maxMemoryGrowthKb: Long = 20 * 1024L,
)

data class OvernightIdleSnapshot(
    val timestampMillis: Long,
    val elapsedRealtimeMillis: Long = timestampMillis,
    val batteryLevelPercent: Int? = null,
    val isCharging: Boolean = false,
    val serviceWakeupCount: Int = 0,
    val callbackCount: Int = 0,
    val foregroundServiceCount: Int = 0,
    val wakeLockHeldCount: Int = 0,
    val usedMemoryKb: Long? = null,
)

data class OvernightIdleReport(
    val healthy: Boolean,
    val windowMature: Boolean,
    val windowMillis: Long,
    val risks: Set<OvernightIdleRisk>,
    val batteryDropPercent: Int?,
    val serviceWakeupDelta: Int,
    val callbackDelta: Int,
    val memoryGrowthKb: Long?,
)

class OvernightIdleMonitor(
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val recoveryManager: GsmSafetyRecoveryManager = GsmSafetyRecoveryManager(),
    private val thresholds: OvernightIdleThresholds = OvernightIdleThresholds(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    private val lock = Any()
    private var baseline: OvernightIdleSnapshot? = null
    private var observedWakeups = 0

    fun begin(snapshot: OvernightIdleSnapshot) {
        synchronized(lock) {
            baseline = snapshot
            observedWakeups = 0
        }
        record(
            reason = "begin",
            report = OvernightIdleReport(
                healthy = true,
                windowMature = false,
                windowMillis = 0L,
                risks = emptySet(),
                batteryDropPercent = null,
                serviceWakeupDelta = 0,
                callbackDelta = 0,
                memoryGrowthKb = null,
            ),
            timestamp = snapshot.timestampMillis,
        )
    }

    fun observeServiceWakeup(reason: String) {
        synchronized(lock) {
            observedWakeups += 1
        }
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.OVERNIGHT_IDLE_REPORTED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_1f_long_run_validation",
                attributes = mapOf(
                    "reason" to reason,
                    "service_wakeup_observed" to true.toString(),
                ),
            ),
        )
    }

    fun evaluate(
        reason: String,
        current: OvernightIdleSnapshot,
    ): OvernightIdleReport {
        val start = synchronized(lock) { baseline }
        if (start == null) {
            begin(current)
            return OvernightIdleReport(
                healthy = true,
                windowMature = false,
                windowMillis = 0L,
                risks = emptySet(),
                batteryDropPercent = null,
                serviceWakeupDelta = 0,
                callbackDelta = 0,
                memoryGrowthKb = null,
            )
        }

        val wakeups = synchronized(lock) { observedWakeups }
        val windowMillis = current.elapsedRealtimeMillis - start.elapsedRealtimeMillis
        val windowMature = windowMillis >= thresholds.minimumWindowMillis
        val batteryDrop = if (!start.isCharging && !current.isCharging) {
            start.batteryLevelPercent?.let { baselineBattery ->
                current.batteryLevelPercent?.let { currentBattery ->
                    baselineBattery - currentBattery
                }
            }
        } else {
            null
        }
        val serviceWakeupDelta = current.serviceWakeupCount - start.serviceWakeupCount + wakeups
        val callbackDelta = current.callbackCount - start.callbackCount
        val memoryGrowth = start.usedMemoryKb?.let { startMemory ->
            current.usedMemoryKb?.let { currentMemory -> currentMemory - startMemory }
        }

        val risks = if (!windowMature) {
            emptySet()
        } else {
            buildSet {
                if ((batteryDrop ?: 0) > thresholds.maxBatteryDropPercent) {
                    add(OvernightIdleRisk.BATTERY_SPIKE)
                }
                if (serviceWakeupDelta > thresholds.maxServiceWakeups) {
                    add(OvernightIdleRisk.SERVICE_WAKEUP_ACCUMULATION)
                }
                if (callbackDelta > thresholds.maxCallbackIncrease) {
                    add(OvernightIdleRisk.CALLBACK_ACCUMULATION)
                }
                if (current.foregroundServiceCount > thresholds.maxForegroundServices) {
                    add(OvernightIdleRisk.FOREGROUND_SERVICE_ACTIVE)
                }
                if (current.wakeLockHeldCount > thresholds.maxWakeLocks) {
                    add(OvernightIdleRisk.WAKELOCK_HELD)
                }
                if ((memoryGrowth ?: 0L) > thresholds.maxMemoryGrowthKb) {
                    add(OvernightIdleRisk.MEMORY_GROWTH)
                }
            }
        }

        val report = OvernightIdleReport(
            healthy = risks.isEmpty(),
            windowMature = windowMature,
            windowMillis = windowMillis,
            risks = risks,
            batteryDropPercent = batteryDrop,
            serviceWakeupDelta = serviceWakeupDelta,
            callbackDelta = callbackDelta,
            memoryGrowthKb = memoryGrowth,
        )
        record(reason, report, current.timestampMillis)
        triggerRecovery(report)
        return report
    }

    private fun triggerRecovery(report: OvernightIdleReport) {
        if (!report.windowMature || report.healthy) return
        recoveryManager.report(
            signal = GsmRecoverySignal.TELECOM_CALLBACK_FAILURE,
            feature = GsmFeature.GSM_INTELLIGENCE,
            reason = "overnight_idle_${report.risks.joinToString("_") { it.name.lowercase() }}",
        )
    }

    private fun record(
        reason: String,
        report: OvernightIdleReport,
        timestamp: Long,
    ) {
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.OVERNIGHT_IDLE_REPORTED,
                sessionKey = null,
                timestampMillis = timestamp,
                activationPath = "phase_1f_long_run_validation",
                attributes = mapOf(
                    "reason" to reason,
                    "healthy" to report.healthy.toString(),
                    "window_mature" to report.windowMature.toString(),
                    "window_millis" to report.windowMillis.toString(),
                    "risks" to report.risks.joinToString { it.name },
                    "battery_drop" to report.batteryDropPercent.toString(),
                    "service_wakeup_delta" to report.serviceWakeupDelta.toString(),
                    "callback_delta" to report.callbackDelta.toString(),
                    "memory_growth_kb" to report.memoryGrowthKb.toString(),
                ),
            ),
        )
    }
}
