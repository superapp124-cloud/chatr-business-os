package ai.chatr.gsm.core.telecom

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OvernightIdleMonitorTest {
    @Test
    fun immatureWindowDoesNotFlagBatteryDrop() {
        val monitor = OvernightIdleMonitor(
            thresholds = OvernightIdleThresholds(minimumWindowMillis = 1_000L),
        )
        monitor.begin(
            OvernightIdleSnapshot(
                timestampMillis = 0L,
                elapsedRealtimeMillis = 0L,
                batteryLevelPercent = 100,
            ),
        )

        val report = monitor.evaluate(
            reason = "test",
            current = OvernightIdleSnapshot(
                timestampMillis = 500L,
                elapsedRealtimeMillis = 500L,
                batteryLevelPercent = 80,
            ),
        )

        assertTrue(report.healthy)
        assertFalse(report.windowMature)
    }

    @Test
    fun matureWindowFlagsBatteryAndCallbackGrowth() {
        val monitor = OvernightIdleMonitor(
            thresholds = OvernightIdleThresholds(
                minimumWindowMillis = 1_000L,
                maxBatteryDropPercent = 3,
                maxCallbackIncrease = 0,
            ),
        )
        monitor.begin(
            OvernightIdleSnapshot(
                timestampMillis = 0L,
                elapsedRealtimeMillis = 0L,
                batteryLevelPercent = 100,
                callbackCount = 0,
            ),
        )

        val report = monitor.evaluate(
            reason = "test",
            current = OvernightIdleSnapshot(
                timestampMillis = 2_000L,
                elapsedRealtimeMillis = 2_000L,
                batteryLevelPercent = 94,
                callbackCount = 1,
            ),
        )

        assertFalse(report.healthy)
        assertTrue(OvernightIdleRisk.BATTERY_SPIKE in report.risks)
        assertTrue(OvernightIdleRisk.CALLBACK_ACCUMULATION in report.risks)
    }

    @Test
    fun serviceWakeupObservationContributesToIdleReport() {
        val monitor = OvernightIdleMonitor(
            thresholds = OvernightIdleThresholds(
                minimumWindowMillis = 1_000L,
                maxServiceWakeups = 0,
            ),
        )
        monitor.begin(
            OvernightIdleSnapshot(
                timestampMillis = 0L,
                elapsedRealtimeMillis = 0L,
            ),
        )
        monitor.observeServiceWakeup("test_wakeup")

        val report = monitor.evaluate(
            reason = "test",
            current = OvernightIdleSnapshot(
                timestampMillis = 2_000L,
                elapsedRealtimeMillis = 2_000L,
            ),
        )

        assertFalse(report.healthy)
        assertTrue(OvernightIdleRisk.SERVICE_WAKEUP_ACCUMULATION in report.risks)
    }
}
