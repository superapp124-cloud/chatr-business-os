package ai.chatr.gsm.callscreening

import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import androidx.annotation.RequiresApi
import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.activation.GsmFeatureActivationManager
import ai.chatr.gsm.core.di.GsmDependencyRegistry

@RequiresApi(Build.VERSION_CODES.N)
class ChatrGsmCallScreeningService : CallScreeningService() {
    override fun onScreenCall(callDetails: Call.Details) {
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

        if (!activationManager.canActivate(applicationContext, GsmFeature.CALL_SCREENING).allowed) {
            allow(callDetails)
            return
        }

        allow(callDetails)
    }

    private fun allow(callDetails: Call.Details) {
        respondToCall(
            callDetails,
            CallResponse.Builder()
                .setDisallowCall(false)
                .setRejectCall(false)
                .setSkipCallLog(false)
                .setSkipNotification(false)
                .build(),
        )
    }
}
