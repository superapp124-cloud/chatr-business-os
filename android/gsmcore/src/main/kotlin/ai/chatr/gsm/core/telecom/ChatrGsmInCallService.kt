package ai.chatr.gsm.core.telecom

import android.telecom.Call
import android.telecom.InCallService
import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.activation.GsmFeatureActivationManager
import ai.chatr.gsm.core.di.GsmDependencyRegistry
import ai.chatr.gsm.core.safety.GsmRecoverySignal
import ai.chatr.gsm.core.safety.TelecomCrashLoopSignal
import java.util.concurrent.ConcurrentHashMap

class ChatrGsmInCallService : InCallService() {
    private val observer = InMemoryGsmPassiveCallObserver()
    private val lifecycleBridge = ThreadSafeGsmTelecomLifecycleBridge()
    private val callbacks = ConcurrentHashMap<Int, Call.Callback>()
    private val serviceMemoryKey = "in_call_service:${System.identityHashCode(this)}"

    override fun onCreate() {
        super.onCreate()
        val graph = GsmDependencyRegistry.resolve(applicationContext)
        runCatching {
            graph.telecomMemoryGuard.onServiceCreated(serviceMemoryKey)
            graph.overnightIdleMonitor.observeServiceWakeup("in_call_service_created")
            graph.processRecoveryCoordinator.reconcile(TelecomProcessRecoveryReason.SERVICE_RECREATED)
            graph.bluetoothTelecomCoordinator.observe("in_call_service_created")
            graph.sessionConsistencyAuditor.audit("in_call_service_created")
            graph.telecomHealthMonitor.evaluate("in_call_service_created")
            graph.telecomMemoryGuard.evaluate("in_call_service_created")
        }
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        val graph = GsmDependencyRegistry.resolve(applicationContext)
        val activationManager = GsmFeatureActivationManager(
            flags = graph.flags,
            activationStore = graph.activationStore,
            remoteConfig = graph.remoteConfig,
            recoveryManager = graph.safetyRecoveryManager,
            dogfoodActivationPolicy = graph.dogfoodActivationPolicy,
            pilotRolloutController = graph.pilotRolloutController,
            deviceReadinessValidator = graph.deviceReadinessValidator,
            telemetrySink = graph.telemetrySink,
        )
        if (!activationManager.canActivate(applicationContext, GsmFeature.PASSIVE_CALL_OBSERVATION).allowed) return

        val snapshot = call.toSnapshot()
        observer.onCallObserved(snapshot)
        graph.sessionStateMachine.onSnapshot(snapshot)
        graph.multiCallConflictResolver.resolve(
            sessions = graph.sessionStateMachine.sessions.value.values,
            currentOverlaySessionKey = null,
        )
        graph.bluetoothTelecomCoordinator.observe("call_added")
        graph.sessionConsistencyAuditor.audit("call_added")
        graph.telecomHealthMonitor.evaluate("call_added")
        lifecycleBridge.onCallAdded(snapshot)
        val callback = object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) {
                onTelecomCallback(call)
            }

            override fun onDetailsChanged(call: Call, details: Call.Details) {
                onTelecomCallback(call)
            }
        }
        callbacks[call.hashCode()] = callback
        graph.telecomMemoryGuard.onCallbackRegistered(call.hashCode())
        call.registerCallback(callback)
        graph.telecomMemoryGuard.evaluate("call_callback_registered")
        graph.telecomCrashLoopProtector.evaluateRecentEvents("call_added")
        graph.telecomDeadmanSwitch.evaluateAndTripIfNeeded("call_added")
        graph.silentFallbackController.evaluateAndApply(
            feature = GsmFeature.PASSIVE_CALL_OBSERVATION,
            reliability = graph.telecomReliabilityScore.calculate("call_added"),
            reason = "call_added",
        )
    }

    override fun onCallRemoved(call: Call) {
        val graph = GsmDependencyRegistry.resolve(applicationContext)
        val snapshot = call.toSnapshot().copy(lifecycle = GsmCallLifecycle.DISCONNECTED)
        callbacks.remove(call.hashCode())?.let { callback ->
            runCatching { call.unregisterCallback(callback) }
        }
        graph.telecomMemoryGuard.onCallbackUnregistered(call.hashCode())
        observer.onCallRemoved(call.hashCode())
        graph.sessionStateMachine.onRemoved(
            snapshot = snapshot,
            failed = call.details?.disconnectCause?.code == android.telecom.DisconnectCause.ERROR,
        )
        graph.multiCallConflictResolver.resolve(
            sessions = graph.sessionStateMachine.sessions.value.values,
            currentOverlaySessionKey = null,
        )
        lifecycleBridge.onCallRemoved(
            snapshot = snapshot,
            disconnectCauseCode = call.details?.disconnectCause?.code,
        )
        graph.sessionStateMachine.markCleanupComplete(
            telecomCallHash = call.hashCode(),
            success = true,
            reason = "in_call_removed",
        )
        graph.sessionConsistencyAuditor.audit("call_removed")
        graph.telecomHealthMonitor.evaluate("call_removed")
        graph.telecomMemoryGuard.evaluate("call_removed")
        graph.telecomCrashLoopProtector.evaluateRecentEvents("call_removed")
        graph.telecomDeadmanSwitch.evaluateAndTripIfNeeded("call_removed")
        graph.silentFallbackController.evaluateAndApply(
            feature = GsmFeature.PASSIVE_CALL_OBSERVATION,
            reliability = graph.telecomReliabilityScore.calculate("call_removed"),
            reason = "call_removed",
        )
        super.onCallRemoved(call)
    }

    override fun onDestroy() {
        val graph = GsmDependencyRegistry.resolve(applicationContext)
        graph.telecomMemoryGuard.evaluate("in_call_service_destroy_pre_cleanup")
        callbacks.keys.forEach { key ->
            graph.telecomMemoryGuard.onCallbackUnregistered(key)
        }
        callbacks.clear()
        graph.telecomMemoryGuard.onServiceDestroyed(serviceMemoryKey)
        graph.telecomMemoryGuard.evaluate("in_call_service_destroyed")
        super.onDestroy()
    }

    private fun onTelecomCallback(call: Call) {
        val graph = GsmDependencyRegistry.resolve(applicationContext)
        runCatching {
            val snapshot = call.toSnapshot()
            graph.sessionStateMachine.onSnapshot(snapshot)
            graph.multiCallConflictResolver.resolve(
                sessions = graph.sessionStateMachine.sessions.value.values,
                currentOverlaySessionKey = null,
            )
            graph.bluetoothTelecomCoordinator.observe("telecom_callback")
            graph.sessionConsistencyAuditor.audit("telecom_callback")
            graph.telecomHealthMonitor.evaluate("telecom_callback")
            graph.telecomMemoryGuard.evaluate("telecom_callback")
            graph.telecomCrashLoopProtector.evaluateRecentEvents("telecom_callback")
            graph.telecomDeadmanSwitch.evaluateAndTripIfNeeded("telecom_callback")
            graph.silentFallbackController.evaluateAndApply(
                feature = GsmFeature.PASSIVE_CALL_OBSERVATION,
                reliability = graph.telecomReliabilityScore.calculate("telecom_callback"),
                reason = "telecom_callback",
            )
            lifecycleBridge.onCallChanged(snapshot)
        }.onFailure { throwable ->
            graph.sessionStateMachine.onCallbackFailure(
                telecomCallHash = call.hashCode(),
                failureReason = throwable.javaClass.simpleName.ifBlank { "callback_failure" },
            )
            graph.safetyRecoveryManager.report(
                signal = GsmRecoverySignal.TELECOM_CALLBACK_FAILURE,
                feature = GsmFeature.PASSIVE_CALL_OBSERVATION,
                reason = throwable.javaClass.simpleName.ifBlank { "callback_failure" },
                sessionKey = call.hashCode(),
            )
            graph.telecomCrashLoopProtector.report(
                signal = TelecomCrashLoopSignal.SERVICE_CRASH,
                reason = throwable.javaClass.simpleName.ifBlank { "callback_failure" },
            )
            graph.telecomDeadmanSwitch.evaluateAndTripIfNeeded("telecom_callback_failure")
        }
    }

    private fun Call.toSnapshot(): GsmCallSnapshot {
        return GsmCallSnapshot(
            telecomCallHash = hashCode(),
            phoneNumber = details?.handle?.schemeSpecificPart,
            direction = when (details?.callDirection) {
                Call.Details.DIRECTION_INCOMING -> GsmCallDirection.INCOMING
                Call.Details.DIRECTION_OUTGOING -> GsmCallDirection.OUTGOING
                else -> GsmCallDirection.UNKNOWN
            },
            lifecycle = when (state) {
                Call.STATE_RINGING -> GsmCallLifecycle.RINGING
                Call.STATE_DIALING -> GsmCallLifecycle.DIALING
                Call.STATE_ACTIVE -> GsmCallLifecycle.ACTIVE
                Call.STATE_HOLDING -> GsmCallLifecycle.HOLDING
                Call.STATE_DISCONNECTING -> GsmCallLifecycle.DISCONNECTING
                Call.STATE_DISCONNECTED -> GsmCallLifecycle.DISCONNECTED
                else -> GsmCallLifecycle.UNKNOWN
            },
            phoneAccountId = details?.accountHandle?.id,
            simSlotIndex = details?.extras?.getInt("android.telecom.extra.SLOT_INDEX")
                ?.takeIf { it >= 0 },
            capturedAtMillis = System.currentTimeMillis(),
        )
    }
}
