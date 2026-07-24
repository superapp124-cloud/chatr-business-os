package ai.chatr.gsm.core.telecom

import android.net.Uri
import android.os.Build
import android.telecom.CallRedirectionService
import android.telecom.PhoneAccountHandle
import androidx.annotation.RequiresApi
import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.activation.GsmFeatureActivationManager
import ai.chatr.gsm.core.di.GsmDependencyRegistry

@RequiresApi(Build.VERSION_CODES.Q)
class ChatrGsmCallRedirectionService : CallRedirectionService() {
    override fun onPlaceCall(
        handle: Uri,
        initialPhoneAccount: PhoneAccountHandle,
        allowInteractiveResponse: Boolean,
    ) {
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
        if (!activationManager.canActivate(applicationContext, GsmFeature.PASSIVE_CALL_OBSERVATION).allowed) {
            placeCallUnmodified()
            return
        }

        placeCallUnmodified()
    }
}
