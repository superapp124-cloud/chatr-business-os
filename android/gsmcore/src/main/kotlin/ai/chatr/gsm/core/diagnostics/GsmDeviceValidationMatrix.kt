package ai.chatr.gsm.core.diagnostics

import ai.chatr.gsm.core.telecom.NoOpTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEvent
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class GsmValidationDevice {
    PIXEL_8_9_ANDROID_14_15,
    SAMSUNG_S23_S24_ONEUI,
    ONEPLUS,
}

enum class GsmValidationArea {
    PROCESS_CHAOS,
    BATTERY_RESTRICTION,
    OEM_TELECOM,
    BLUETOOTH_ANDROID_AUTO,
    LONG_RUN,
}

enum class GsmValidationScenario {
    INCOMING_GSM,
    OUTGOING_GSM,
    LOCKSCREEN,
    FORCE_STOP_RINGING,
    FORCE_STOP_ACTIVE_CALL,
    REBOOT_DURING_OBSERVATION,
    PACKAGE_REPLACE_DURING_LIFECYCLE,
    BATTERY_SAVER,
    RESTRICTED_BACKGROUND,
    OEM_BATTERY_KILLER,
    OVERLAY_SUPPRESSION,
    CALL_WAITING,
    SERVICE_RECREATION,
    CALLBACK_ORDERING,
    OVERLAY_DETACH_RELIABILITY,
    EARBUDS,
    CAR_BLUETOOTH,
    ANDROID_AUTO,
    RAPID_ROUTE_SWITCHING,
    TWENTY_FOUR_HOUR_IDLE,
    CALL_CHURN,
    OVERNIGHT_CHARGING,
    SIM_SWITCHING,
}

data class GsmValidationCase(
    val device: GsmValidationDevice,
    val area: GsmValidationArea,
    val scenario: GsmValidationScenario,
    val minimumDurationHours: Int = 0,
)

data class GsmValidationEvidence(
    val case: GsmValidationCase,
    val passed: Boolean,
    val notes: String = "",
)

data class GsmDeviceValidationReport(
    val readyForPassiveObservationPilot: Boolean,
    val requiredCaseCount: Int,
    val passedCaseCount: Int,
    val missingCases: List<GsmValidationCase>,
    val failedCases: List<GsmValidationCase>,
)

class GsmDeviceValidationMatrix(
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun requiredCases(): List<GsmValidationCase> = requiredCases

    fun evaluate(
        reason: String,
        evidence: List<GsmValidationEvidence>,
    ): GsmDeviceValidationReport {
        val evidenceByCase = evidence.associateBy { it.case }
        val missing = requiredCases.filter { required -> required !in evidenceByCase }
        val failed = evidence
            .filter { it.case in requiredCases && !it.passed }
            .map { it.case }
        val passed = requiredCases.count { required -> evidenceByCase[required]?.passed == true }
        val report = GsmDeviceValidationReport(
            readyForPassiveObservationPilot = missing.isEmpty() && failed.isEmpty(),
            requiredCaseCount = requiredCases.size,
            passedCaseCount = passed,
            missingCases = missing,
            failedCases = failed,
        )
        record(reason, report)
        return report
    }

    private fun record(
        reason: String,
        report: GsmDeviceValidationReport,
    ) {
        val attributes = mapOf(
            "reason" to reason,
            "ready_for_passive_pilot" to report.readyForPassiveObservationPilot.toString(),
            "required_cases" to report.requiredCaseCount.toString(),
            "passed_cases" to report.passedCaseCount.toString(),
            "missing_cases" to report.missingCases.size.toString(),
            "failed_cases" to report.failedCases.size.toString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.DEVICE_VALIDATION_MATRIX_EVALUATED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "dormant_internal_qa_ship",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.DEVICE_VALIDATION_MATRIX_EVALUATED,
                attributes = attributes,
            ),
        )
    }

    companion object {
        private val pixelCases = listOf(
            GsmValidationCase(GsmValidationDevice.PIXEL_8_9_ANDROID_14_15, GsmValidationArea.OEM_TELECOM, GsmValidationScenario.INCOMING_GSM),
            GsmValidationCase(GsmValidationDevice.PIXEL_8_9_ANDROID_14_15, GsmValidationArea.OEM_TELECOM, GsmValidationScenario.OUTGOING_GSM),
            GsmValidationCase(GsmValidationDevice.PIXEL_8_9_ANDROID_14_15, GsmValidationArea.OEM_TELECOM, GsmValidationScenario.LOCKSCREEN),
            GsmValidationCase(GsmValidationDevice.PIXEL_8_9_ANDROID_14_15, GsmValidationArea.PROCESS_CHAOS, GsmValidationScenario.FORCE_STOP_RINGING),
            GsmValidationCase(GsmValidationDevice.PIXEL_8_9_ANDROID_14_15, GsmValidationArea.PROCESS_CHAOS, GsmValidationScenario.FORCE_STOP_ACTIVE_CALL),
            GsmValidationCase(GsmValidationDevice.PIXEL_8_9_ANDROID_14_15, GsmValidationArea.PROCESS_CHAOS, GsmValidationScenario.REBOOT_DURING_OBSERVATION),
            GsmValidationCase(GsmValidationDevice.PIXEL_8_9_ANDROID_14_15, GsmValidationArea.PROCESS_CHAOS, GsmValidationScenario.PACKAGE_REPLACE_DURING_LIFECYCLE),
            GsmValidationCase(GsmValidationDevice.PIXEL_8_9_ANDROID_14_15, GsmValidationArea.LONG_RUN, GsmValidationScenario.TWENTY_FOUR_HOUR_IDLE, minimumDurationHours = 24),
        )
        private val samsungCases = listOf(
            GsmValidationCase(GsmValidationDevice.SAMSUNG_S23_S24_ONEUI, GsmValidationArea.BATTERY_RESTRICTION, GsmValidationScenario.RESTRICTED_BACKGROUND),
            GsmValidationCase(GsmValidationDevice.SAMSUNG_S23_S24_ONEUI, GsmValidationArea.BATTERY_RESTRICTION, GsmValidationScenario.OEM_BATTERY_KILLER),
            GsmValidationCase(GsmValidationDevice.SAMSUNG_S23_S24_ONEUI, GsmValidationArea.OEM_TELECOM, GsmValidationScenario.LOCKSCREEN),
            GsmValidationCase(GsmValidationDevice.SAMSUNG_S23_S24_ONEUI, GsmValidationArea.OEM_TELECOM, GsmValidationScenario.OVERLAY_SUPPRESSION),
            GsmValidationCase(GsmValidationDevice.SAMSUNG_S23_S24_ONEUI, GsmValidationArea.OEM_TELECOM, GsmValidationScenario.CALL_WAITING),
        )
        private val onePlusCases = listOf(
            GsmValidationCase(GsmValidationDevice.ONEPLUS, GsmValidationArea.PROCESS_CHAOS, GsmValidationScenario.SERVICE_RECREATION),
            GsmValidationCase(GsmValidationDevice.ONEPLUS, GsmValidationArea.OEM_TELECOM, GsmValidationScenario.CALLBACK_ORDERING),
            GsmValidationCase(GsmValidationDevice.ONEPLUS, GsmValidationArea.OEM_TELECOM, GsmValidationScenario.OVERLAY_DETACH_RELIABILITY),
        )
        private val bluetoothAndLongRunCases = listOf(
            GsmValidationCase(GsmValidationDevice.PIXEL_8_9_ANDROID_14_15, GsmValidationArea.BLUETOOTH_ANDROID_AUTO, GsmValidationScenario.EARBUDS),
            GsmValidationCase(GsmValidationDevice.PIXEL_8_9_ANDROID_14_15, GsmValidationArea.BLUETOOTH_ANDROID_AUTO, GsmValidationScenario.CAR_BLUETOOTH),
            GsmValidationCase(GsmValidationDevice.PIXEL_8_9_ANDROID_14_15, GsmValidationArea.BLUETOOTH_ANDROID_AUTO, GsmValidationScenario.ANDROID_AUTO),
            GsmValidationCase(GsmValidationDevice.PIXEL_8_9_ANDROID_14_15, GsmValidationArea.BLUETOOTH_ANDROID_AUTO, GsmValidationScenario.RAPID_ROUTE_SWITCHING),
            GsmValidationCase(GsmValidationDevice.SAMSUNG_S23_S24_ONEUI, GsmValidationArea.LONG_RUN, GsmValidationScenario.CALL_CHURN),
            GsmValidationCase(GsmValidationDevice.ONEPLUS, GsmValidationArea.LONG_RUN, GsmValidationScenario.OVERNIGHT_CHARGING),
            GsmValidationCase(GsmValidationDevice.PIXEL_8_9_ANDROID_14_15, GsmValidationArea.LONG_RUN, GsmValidationScenario.SIM_SWITCHING),
        )
        private val requiredCases = pixelCases + samsungCases + onePlusCases + bluetoothAndLongRunCases
    }
}
