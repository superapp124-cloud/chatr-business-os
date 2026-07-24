package ai.chatr.gsm.core.telecom

import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class TelecomAnomalyDimension {
    OEM_MODEL,
    ANDROID_VERSION,
    BLUETOOTH_STATE,
    BATTERY_MODE,
}

data class TelecomAnomalyCluster(
    val dimension: TelecomAnomalyDimension,
    val key: String,
    val incidentCount: Int,
    val highestSeverity: TelecomIncidentSeverity,
    val incidentTypes: Set<TelecomIncidentType>,
)

data class TelecomAnomalyCorrelationReport(
    val hasSystemicAnomaly: Boolean,
    val clusters: List<TelecomAnomalyCluster>,
    val affectedOems: Set<String>,
    val affectedAndroidSdks: Set<Int>,
    val bluetoothStates: Set<String>,
    val batteryModes: Set<String>,
)

class TelecomAnomalyCorrelator(
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val incidentClassifier: TelecomIncidentClassifier = TelecomIncidentClassifier(recorder),
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun correlate(
        reason: String,
        windowMillis: Long = 24 * 60 * 60 * 1000L,
        minClusterSize: Int = 2,
    ): TelecomAnomalyCorrelationReport {
        val cutoff = now() - windowMillis
        val sourceEvents = recorder.snapshot().filter { it.timestampMillis >= cutoff }
        val incidents = sourceEvents.mapNotNull { event ->
            incidentClassifier.classify(event)?.let { event to it }
        }
        val clusters = buildList {
            addAll(incidents.toClusters(TelecomAnomalyDimension.OEM_MODEL, minClusterSize) { event, _ ->
                event.manufacturer.ifBlank { "unknown" }
            })
            addAll(incidents.toClusters(TelecomAnomalyDimension.ANDROID_VERSION, minClusterSize) { event, _ ->
                event.androidSdk.toString()
            })
            addAll(incidents.toClusters(TelecomAnomalyDimension.BLUETOOTH_STATE, minClusterSize) { event, _ ->
                event.attributes["route"]
            })
            addAll(incidents.toClusters(TelecomAnomalyDimension.BATTERY_MODE, minClusterSize) { event, _ ->
                event.attributes["battery_mode"]
                    ?: event.attributes["battery_restriction"]
                    ?: event.attributes["battery_optimization"]
            })
        }.sortedWith(
            compareByDescending<TelecomAnomalyCluster> { it.highestSeverity.ordinal }
                .thenByDescending { it.incidentCount },
        )
        val report = TelecomAnomalyCorrelationReport(
            hasSystemicAnomaly = clusters.isNotEmpty(),
            clusters = clusters,
            affectedOems = clusters
                .filter { it.dimension == TelecomAnomalyDimension.OEM_MODEL }
                .map { it.key }
                .toSet(),
            affectedAndroidSdks = clusters
                .filter { it.dimension == TelecomAnomalyDimension.ANDROID_VERSION }
                .mapNotNull { it.key.toIntOrNull() }
                .toSet(),
            bluetoothStates = clusters
                .filter { it.dimension == TelecomAnomalyDimension.BLUETOOTH_STATE }
                .map { it.key }
                .toSet(),
            batteryModes = clusters
                .filter { it.dimension == TelecomAnomalyDimension.BATTERY_MODE }
                .map { it.key }
                .toSet(),
        )
        record(reason, report)
        return report
    }

    private fun List<Pair<TelecomRecordedEvent, TelecomIncident>>.toClusters(
        dimension: TelecomAnomalyDimension,
        minClusterSize: Int,
        keySelector: (TelecomRecordedEvent, TelecomIncident) -> String?,
    ): List<TelecomAnomalyCluster> {
        return mapNotNull { (event, incident) ->
            keySelector(event, incident)
                ?.takeIf { it.isNotBlank() }
                ?.let { key -> key to incident }
        }
            .groupBy({ it.first }, { it.second })
            .filter { (_, incidents) -> incidents.size >= minClusterSize }
            .map { (key, incidents) ->
                TelecomAnomalyCluster(
                    dimension = dimension,
                    key = key,
                    incidentCount = incidents.size,
                    highestSeverity = incidents.maxBy { it.severity.ordinal }.severity,
                    incidentTypes = incidents.map { it.type }.toSet(),
                )
            }
    }

    private fun record(
        reason: String,
        report: TelecomAnomalyCorrelationReport,
    ) {
        val attributes = mapOf(
            "reason" to reason,
            "systemic" to report.hasSystemicAnomaly.toString(),
            "cluster_count" to report.clusters.size.toString(),
            "affected_oems" to report.affectedOems.joinToString(),
            "affected_android_sdks" to report.affectedAndroidSdks.joinToString(),
            "bluetooth_states" to report.bluetoothStates.joinToString(),
            "battery_modes" to report.batteryModes.joinToString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.TELECOM_ANOMALY_CORRELATED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_2c_operational_validation",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.TELECOM_ANOMALY_CORRELATED,
                attributes = attributes,
            ),
        )
    }
}
