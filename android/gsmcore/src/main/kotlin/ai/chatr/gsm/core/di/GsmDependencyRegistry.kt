package ai.chatr.gsm.core.di

import android.content.Context
import ai.chatr.gsm.core.activation.AdaptivePilotController
import ai.chatr.gsm.core.activation.DeviceReadinessValidator
import ai.chatr.gsm.core.activation.DisabledGsmUserActivationStore
import ai.chatr.gsm.core.activation.DisabledDogfoodActivationPolicy
import ai.chatr.gsm.core.activation.DisabledGsmPilotRolloutController
import ai.chatr.gsm.core.activation.DogfoodActivationPolicy
import ai.chatr.gsm.core.activation.GsmFeatureActivationManager
import ai.chatr.gsm.core.activation.GsmPilotRolloutController
import ai.chatr.gsm.core.activation.GsmUserActivationStore
import ai.chatr.gsm.core.GsmFeatureFlagProvider
import ai.chatr.gsm.core.StaticGsmFeatureFlagProvider
import ai.chatr.gsm.core.capability.AndroidGsmCapabilityChecker
import ai.chatr.gsm.core.capability.GsmCapabilityChecker
import ai.chatr.gsm.core.diagnostics.GsmDeviceValidationMatrix
import ai.chatr.gsm.core.diagnostics.GsmDormantShipVerifier
import ai.chatr.gsm.core.safety.DisabledRemoteConfigGsmSafety
import ai.chatr.gsm.core.safety.GsmSafetyRecoveryManager
import ai.chatr.gsm.core.safety.GsmSafeMode
import ai.chatr.gsm.core.safety.RemoteConfigGsmSafety
import ai.chatr.gsm.core.safety.SharedPreferencesGsmSafeModeStore
import ai.chatr.gsm.core.safety.SharedPreferencesTelecomCrashLoopStore
import ai.chatr.gsm.core.safety.SilentFallbackController
import ai.chatr.gsm.core.safety.SilentRollbackOrchestrator
import ai.chatr.gsm.core.safety.TelecomCrashLoopProtector
import ai.chatr.gsm.core.safety.TelecomDeadmanSwitch
import ai.chatr.gsm.core.telecom.BoundedInMemoryTelecomEventRecorder
import ai.chatr.gsm.core.telecom.AndroidBluetoothTelecomSnapshotProvider
import ai.chatr.gsm.core.telecom.AndroidTelecomManagerStateProbe
import ai.chatr.gsm.core.telecom.AppUpgradeRecoveryValidator
import ai.chatr.gsm.core.telecom.BluetoothTelecomCoordinator
import ai.chatr.gsm.core.telecom.GsmSessionStateMachine
import ai.chatr.gsm.core.telecom.LifecycleExhaustionTester
import ai.chatr.gsm.core.telecom.MultiCallConflictResolver
import ai.chatr.gsm.core.telecom.OverlayLatencyProfiler
import ai.chatr.gsm.core.telecom.OvernightIdleMonitor
import ai.chatr.gsm.core.telecom.PilotDiagnosticsExporter
import ai.chatr.gsm.core.telecom.PilotConfidenceEngine
import ai.chatr.gsm.core.telecom.RecoveryEffectivenessAnalyzer
import ai.chatr.gsm.core.telecom.ReliabilityTrendAnalyzer
import ai.chatr.gsm.core.telecom.RolloutRiskPredictor
import ai.chatr.gsm.core.telecom.SessionConsistencyAuditor
import ai.chatr.gsm.core.telecom.TelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomHealthMonitor
import ai.chatr.gsm.core.telecom.TelecomIncidentClassifier
import ai.chatr.gsm.core.telecom.TelecomMemoryGuard
import ai.chatr.gsm.core.telecom.TelecomOperationalSlaMonitor
import ai.chatr.gsm.core.telecom.TelecomOperationalDashboard
import ai.chatr.gsm.core.telecom.TelecomProcessRecoveryCoordinator
import ai.chatr.gsm.core.telecom.TelecomReliabilityLedger
import ai.chatr.gsm.core.telecom.TelecomReliabilityScore
import ai.chatr.gsm.core.telecom.TelecomAnomalyCorrelator
import ai.chatr.gsm.core.telecom.TelecomStabilityBaseline
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

data class GsmDependencyGraph(
    val flags: GsmFeatureFlagProvider,
    val capabilityChecker: GsmCapabilityChecker,
    val activationStore: GsmUserActivationStore,
    val remoteConfig: RemoteConfigGsmSafety,
    val telemetrySink: GsmTelemetrySink,
    val telecomEventRecorder: TelecomEventRecorder,
    val sessionStateMachine: GsmSessionStateMachine,
    val safetyRecoveryManager: GsmSafetyRecoveryManager,
    val processRecoveryCoordinator: TelecomProcessRecoveryCoordinator,
    val multiCallConflictResolver: MultiCallConflictResolver,
    val bluetoothTelecomCoordinator: BluetoothTelecomCoordinator,
    val dogfoodActivationPolicy: DogfoodActivationPolicy,
    val pilotRolloutController: GsmPilotRolloutController,
    val telecomHealthMonitor: TelecomHealthMonitor,
    val sessionConsistencyAuditor: SessionConsistencyAuditor,
    val overlayLatencyProfiler: OverlayLatencyProfiler,
    val telecomMemoryGuard: TelecomMemoryGuard,
    val lifecycleExhaustionTester: LifecycleExhaustionTester,
    val appUpgradeRecoveryValidator: AppUpgradeRecoveryValidator,
    val overnightIdleMonitor: OvernightIdleMonitor,
    val telecomReliabilityScore: TelecomReliabilityScore,
    val silentFallbackController: SilentFallbackController,
    val pilotDiagnosticsExporter: PilotDiagnosticsExporter,
    val telecomIncidentClassifier: TelecomIncidentClassifier,
    val reliabilityTrendAnalyzer: ReliabilityTrendAnalyzer,
    val telecomOperationalDashboard: TelecomOperationalDashboard,
    val adaptivePilotController: AdaptivePilotController,
    val telecomStabilityBaseline: TelecomStabilityBaseline,
    val pilotConfidenceEngine: PilotConfidenceEngine,
    val telecomAnomalyCorrelator: TelecomAnomalyCorrelator,
    val silentRollbackOrchestrator: SilentRollbackOrchestrator,
    val telecomOperationalSlaMonitor: TelecomOperationalSlaMonitor,
    val rolloutRiskPredictor: RolloutRiskPredictor,
    val recoveryEffectivenessAnalyzer: RecoveryEffectivenessAnalyzer,
    val telecomReliabilityLedger: TelecomReliabilityLedger,
    val gsmSafeMode: GsmSafeMode,
    val telecomDeadmanSwitch: TelecomDeadmanSwitch,
    val telecomCrashLoopProtector: TelecomCrashLoopProtector,
    val deviceReadinessValidator: DeviceReadinessValidator,
    val dormantShipVerifier: GsmDormantShipVerifier,
    val deviceValidationMatrix: GsmDeviceValidationMatrix,
)

object GsmDependencyRegistry {
    @Volatile
    private var graph: GsmDependencyGraph? = null

    fun install(graph: GsmDependencyGraph) {
        this.graph = graph
    }

    fun reset() {
        graph = null
    }

    fun resolve(context: Context): GsmDependencyGraph {
        return graph ?: synchronized(this) {
            graph ?: createDefaultGraph(context.applicationContext).also { graph = it }
        }
    }

    private fun createDefaultGraph(context: Context): GsmDependencyGraph {
        val telemetrySink = NoOpGsmTelemetrySink()
        val recorder = BoundedInMemoryTelecomEventRecorder()
        val recoveryManager = GsmSafetyRecoveryManager(
            recorder = recorder,
            telemetrySink = telemetrySink,
        )
        val safeMode = GsmSafeMode(
            store = SharedPreferencesGsmSafeModeStore(context),
            recorder = recorder,
            telemetrySink = telemetrySink,
        )
        val crashLoopProtector = TelecomCrashLoopProtector(
            store = SharedPreferencesTelecomCrashLoopStore(context),
            safeMode = safeMode,
            recorder = recorder,
            telemetrySink = telemetrySink,
        )
        val deadmanSwitch = TelecomDeadmanSwitch(
            safeMode = safeMode,
            recoveryManager = recoveryManager,
            recorder = recorder,
            telemetrySink = telemetrySink,
        )
        val deviceReadinessValidator = DeviceReadinessValidator(
            safeMode = safeMode,
            recoveryManager = recoveryManager,
            crashLoopProtector = crashLoopProtector,
            recorder = recorder,
            telemetrySink = telemetrySink,
        )
        val sessionStateMachine = GsmSessionStateMachine(recorder = recorder)
        val memoryGuard = TelecomMemoryGuard(
            stateMachine = sessionStateMachine,
            recorder = recorder,
            recoveryManager = recoveryManager,
        )
        val healthMonitor = TelecomHealthMonitor(
            stateMachine = sessionStateMachine,
            recorder = recorder,
            recoveryManager = recoveryManager,
        )
        val latencyProfiler = OverlayLatencyProfiler(recorder = recorder)
        val reliabilityScore = TelecomReliabilityScore(
            recorder = recorder,
            healthMonitor = healthMonitor,
            memoryGuard = memoryGuard,
            overlayLatencyProfiler = latencyProfiler,
            telemetrySink = telemetrySink,
        )
        val incidentClassifier = TelecomIncidentClassifier(recorder = recorder)
        val trendAnalyzer = ReliabilityTrendAnalyzer(
            recorder = recorder,
            telemetrySink = telemetrySink,
        )
        val operationalDashboard = TelecomOperationalDashboard(
            recorder = recorder,
            incidentClassifier = incidentClassifier,
            telemetrySink = telemetrySink,
        )
        val stabilityBaseline = TelecomStabilityBaseline(
            recorder = recorder,
            incidentClassifier = incidentClassifier,
            telemetrySink = telemetrySink,
        )
        val anomalyCorrelator = TelecomAnomalyCorrelator(
            recorder = recorder,
            incidentClassifier = incidentClassifier,
            telemetrySink = telemetrySink,
        )
        val pilotConfidenceEngine = PilotConfidenceEngine(
            recorder = recorder,
            stabilityBaseline = stabilityBaseline,
            operationalDashboard = operationalDashboard,
            trendAnalyzer = trendAnalyzer,
            telemetrySink = telemetrySink,
        )
        val reliabilityLedger = TelecomReliabilityLedger(
            recorder = recorder,
            telemetrySink = telemetrySink,
        )
        val adaptivePilotController = AdaptivePilotController(
            recorder = recorder,
            telemetrySink = telemetrySink,
        )
        val silentFallbackController = SilentFallbackController(
            recoveryManager = recoveryManager,
            recorder = recorder,
            telemetrySink = telemetrySink,
        )
        val processRecoveryCoordinator = TelecomProcessRecoveryCoordinator(
            stateMachine = sessionStateMachine,
            telecomStateProbe = AndroidTelecomManagerStateProbe(context),
            recorder = recorder,
            recoveryManager = recoveryManager,
        )
        return GsmDependencyGraph(
            flags = StaticGsmFeatureFlagProvider,
            capabilityChecker = AndroidGsmCapabilityChecker(context),
            activationStore = DisabledGsmUserActivationStore,
            remoteConfig = DisabledRemoteConfigGsmSafety,
            telemetrySink = telemetrySink,
            telecomEventRecorder = recorder,
            sessionStateMachine = sessionStateMachine,
            safetyRecoveryManager = recoveryManager,
            dogfoodActivationPolicy = DisabledDogfoodActivationPolicy,
            processRecoveryCoordinator = processRecoveryCoordinator,
            multiCallConflictResolver = MultiCallConflictResolver(recorder = recorder),
            bluetoothTelecomCoordinator = BluetoothTelecomCoordinator(
                snapshotProvider = AndroidBluetoothTelecomSnapshotProvider(context),
                recorder = recorder,
            ),
            pilotRolloutController = DisabledGsmPilotRolloutController,
            telecomHealthMonitor = healthMonitor,
            sessionConsistencyAuditor = SessionConsistencyAuditor(
                stateMachine = sessionStateMachine,
                recorder = recorder,
            ),
            overlayLatencyProfiler = latencyProfiler,
            telecomMemoryGuard = memoryGuard,
            lifecycleExhaustionTester = LifecycleExhaustionTester(recorder = recorder),
            appUpgradeRecoveryValidator = AppUpgradeRecoveryValidator(
                recoveryCoordinator = processRecoveryCoordinator,
                memoryGuard = memoryGuard,
                recorder = recorder,
            ),
            overnightIdleMonitor = OvernightIdleMonitor(
                recorder = recorder,
                recoveryManager = recoveryManager,
            ),
            telecomReliabilityScore = reliabilityScore,
            silentFallbackController = silentFallbackController,
            pilotDiagnosticsExporter = PilotDiagnosticsExporter(
                recorder = recorder,
                reliabilityScore = reliabilityScore,
            ),
            telecomIncidentClassifier = incidentClassifier,
            reliabilityTrendAnalyzer = trendAnalyzer,
            telecomOperationalDashboard = operationalDashboard,
            adaptivePilotController = adaptivePilotController,
            telecomStabilityBaseline = stabilityBaseline,
            pilotConfidenceEngine = pilotConfidenceEngine,
            telecomAnomalyCorrelator = anomalyCorrelator,
            silentRollbackOrchestrator = SilentRollbackOrchestrator(
                fallbackController = silentFallbackController,
                adaptivePilotController = adaptivePilotController,
                recorder = recorder,
                telemetrySink = telemetrySink,
            ),
            telecomOperationalSlaMonitor = TelecomOperationalSlaMonitor(
                stabilityBaseline = stabilityBaseline,
                confidenceEngine = pilotConfidenceEngine,
                recorder = recorder,
                telemetrySink = telemetrySink,
            ),
            rolloutRiskPredictor = RolloutRiskPredictor(
                trendAnalyzer = trendAnalyzer,
                anomalyCorrelator = anomalyCorrelator,
                reliabilityLedger = reliabilityLedger,
                recorder = recorder,
                telemetrySink = telemetrySink,
            ),
            recoveryEffectivenessAnalyzer = RecoveryEffectivenessAnalyzer(
                recorder = recorder,
                telemetrySink = telemetrySink,
            ),
            telecomReliabilityLedger = reliabilityLedger,
            gsmSafeMode = safeMode,
            telecomDeadmanSwitch = deadmanSwitch,
            telecomCrashLoopProtector = crashLoopProtector,
            deviceReadinessValidator = deviceReadinessValidator,
            dormantShipVerifier = GsmDormantShipVerifier(
                flags = StaticGsmFeatureFlagProvider,
                activationManager = GsmFeatureActivationManager(
                    flags = StaticGsmFeatureFlagProvider,
                    activationStore = DisabledGsmUserActivationStore,
                    remoteConfig = DisabledRemoteConfigGsmSafety,
                    recoveryManager = recoveryManager,
                    dogfoodActivationPolicy = DisabledDogfoodActivationPolicy,
                    pilotRolloutController = DisabledGsmPilotRolloutController,
                    deviceReadinessValidator = deviceReadinessValidator,
                    telemetrySink = telemetrySink,
                ),
                recorder = recorder,
                telemetrySink = telemetrySink,
            ),
            deviceValidationMatrix = GsmDeviceValidationMatrix(
                recorder = recorder,
                telemetrySink = telemetrySink,
            ),
        )
    }
}
