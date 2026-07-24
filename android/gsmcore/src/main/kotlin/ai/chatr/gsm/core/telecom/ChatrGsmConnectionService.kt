package ai.chatr.gsm.core.telecom

import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.DisconnectCause
import android.telecom.PhoneAccountHandle
import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.activation.GsmFeatureActivationManager
import ai.chatr.gsm.core.di.GsmDependencyRegistry

class ChatrGsmConnectionService : ConnectionService() {
    override fun onCreateOutgoingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?,
    ): Connection {
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
        if (!activationManager.canActivate(applicationContext, GsmFeature.GSM_INTELLIGENCE).allowed) {
            return failedConnection()
        }

        return failedConnection()
    }

    private fun failedConnection(): Connection {
        return Connection.createFailedConnection(DisconnectCause(DisconnectCause.ERROR))
    }
}
