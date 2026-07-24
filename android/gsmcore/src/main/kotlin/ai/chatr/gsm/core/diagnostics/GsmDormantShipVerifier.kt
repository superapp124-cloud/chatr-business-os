package ai.chatr.gsm.core.diagnostics

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.GsmFeatureFlagProvider
import ai.chatr.gsm.core.StaticGsmFeatureFlagProvider
import ai.chatr.gsm.core.activation.GsmActivationDecision
import ai.chatr.gsm.core.activation.GsmActivationStage
import ai.chatr.gsm.core.activation.GsmFeatureActivationManager
import ai.chatr.gsm.core.activation.GsmUserActivationState
import ai.chatr.gsm.core.telecom.NoOpTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEvent
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class GsmDormantShipBlocker {
    FEATURE_FLAG_ENABLED,
    TELECOM_OBSERVATION_ENABLED,
    AI_OR_AUDIO_ENABLED,
    RECORDING_ENABLED,
    ACTIVATION_ALLOWED,
}

data class GsmDormantShipReport(
    val readyToShipDormant: Boolean,
    val blockers: Set<GsmDormantShipBlocker>,
    val featureFlagStates: Map<GsmFeature, Boolean>,
    val activationDecisions: List<GsmActivationDecision>,
    val preservesExistingChatrBehavior: Boolean = true,
)

class GsmDormantShipVerifier(
    private val flags: GsmFeatureFlagProvider = StaticGsmFeatureFlagProvider,
    private val activationManager: GsmFeatureActivationManager = GsmFeatureActivationManager(flags = flags),
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun verify(
        reason: String,
        capabilityReport: GsmCapabilityReport? = null,
    ): GsmDormantShipReport {
        val flagStates = GsmFeature.values().associateWith { feature -> flags.isEnabled(feature) }
        val activationDecisions = capabilityReport?.let { report ->
            GsmFeature.values().map { feature ->
                activationManager.canActivate(
                    feature = feature,
                    userState = maxOptInState,
                    report = report,
                )
            }
        } ?: emptyList()
        val blockers = buildSet {
            if (flagStates.values.any { it }) add(GsmDormantShipBlocker.FEATURE_FLAG_ENABLED)
            if (flagStates.any { (feature, enabled) ->
                    enabled && feature in telecomObservationFeatures
                }
            ) {
                add(GsmDormantShipBlocker.TELECOM_OBSERVATION_ENABLED)
            }
            if (flagStates.any { (feature, enabled) ->
                    enabled && feature in aiOrAudioFeatures
                }
            ) {
                add(GsmDormantShipBlocker.AI_OR_AUDIO_ENABLED)
            }
            if (flagStates[GsmFeature.RECORDING] == true) add(GsmDormantShipBlocker.RECORDING_ENABLED)
            if (activationDecisions.any { it.allowed }) add(GsmDormantShipBlocker.ACTIVATION_ALLOWED)
        }
        val report = GsmDormantShipReport(
            readyToShipDormant = blockers.isEmpty(),
            blockers = blockers,
            featureFlagStates = flagStates,
            activationDecisions = activationDecisions,
        )
        record(reason, report)
        return report
    }

    private fun record(
        reason: String,
        report: GsmDormantShipReport,
    ) {
        val enabledFeatures = report.featureFlagStates
            .filterValues { it }
            .keys
            .joinToString { it.name }
        val attributes = mapOf(
            "reason" to reason,
            "ready" to report.readyToShipDormant.toString(),
            "blockers" to report.blockers.joinToString { it.name },
            "enabled_features" to enabledFeatures,
            "activation_allowed_count" to report.activationDecisions.count { it.allowed }.toString(),
            "preserves_existing_chatr" to report.preservesExistingChatrBehavior.toString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.DORMANT_SHIP_VERIFIED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "dormant_internal_qa_ship",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.DORMANT_SHIP_VERIFIED,
                attributes = attributes,
            ),
        )
    }

    companion object {
        private val maxOptInState = GsmUserActivationState(
            optedIn = true,
            requestedStage = GsmActivationStage.CHATR_PEER_ENRICHMENT,
            passiveOverlayEnabled = true,
            spamProtectionEnabled = true,
            peerEnrichmentEnabled = true,
        )
        private val telecomObservationFeatures = setOf(
            GsmFeature.PASSIVE_CALL_OBSERVATION,
            GsmFeature.SHIELD,
            GsmFeature.CALL_SCREENING,
            GsmFeature.OVERLAY,
            GsmFeature.GSM_INTELLIGENCE,
        )
        private val aiOrAudioFeatures = setOf(
            GsmFeature.AI,
            GsmFeature.TRANSCRIPTION,
            GsmFeature.RECORDING,
        )
    }
}
