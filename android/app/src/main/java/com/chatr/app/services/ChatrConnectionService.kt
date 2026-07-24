package com.chatr.app.services

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.telecom.CallAudioState
import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.DisconnectCause
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.util.Log
import com.chatr.app.ChatrApplication
import java.util.concurrent.ConcurrentHashMap

/**
 * CHATR+ Connection Service
 *
 * Provides GSM-like call management via Android's TelecomManager.
 */
class ChatrConnectionService : ConnectionService() {

    companion object {
        private const val TAG = "ChatrConnectionService"

        private val activeConnections = ConcurrentHashMap<String, ChatrConnection>()

        fun getConnection(callId: String): ChatrConnection? = activeConnections[callId]

        fun hasActiveConnections(): Boolean = activeConnections.isNotEmpty()

        fun addConnection(callId: String, connection: ChatrConnection) {
            activeConnections.put(callId, connection)?.closeAsReplaced("duplicate_connection")
        }

        fun removeConnection(callId: String, releaseForeground: Boolean = true) {
            activeConnections.remove(callId)
            if (releaseForeground && activeConnections.isEmpty()) {
                CallForegroundService.releaseIfNoActiveCall(
                    ChatrApplication.getInstance(),
                    "connection_removed",
                )
            }
        }

        fun answerConnection(callId: String) {
            endOtherConnections(callId, "answering_new_call")
            activeConnections[callId]?.onAnswer()
        }

        private fun endOtherConnections(callId: String, reason: String) {
            activeConnections.entries
                .filter { it.key != callId }
                .forEach { (existingCallId, existingConnection) ->
                    Log.i(TAG, "Ending stale Chatr connection $existingCallId before $reason for $callId")
                    activeConnections.remove(existingCallId)
                    existingConnection.closeAsReplaced(reason)
                }
        }

        fun rejectConnection(callId: String) {
            val connection = activeConnections[callId]
            if (connection != null) {
                connection.onReject()
            } else if (activeConnections.isEmpty()) {
                CallForegroundService.releaseIfNoActiveCall(
                    ChatrApplication.getInstance(),
                    "reject_without_connection",
                )
            }
        }

        fun missConnection(callId: String) {
            val connection = activeConnections[callId]
            if (connection != null) {
                connection.markMissed()
            } else if (activeConnections.isEmpty()) {
                CallForegroundService.releaseIfNoActiveCall(
                    ChatrApplication.getInstance(),
                    "missed_without_connection",
                )
            }
        }
    }

    override fun onCreateOutgoingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?
    ): Connection {
        Log.i(TAG, "onCreateOutgoingConnection address=${request?.address} extras=${request?.extras}")

        val callId = request?.extras?.getString("call_id") ?: java.util.UUID.randomUUID().toString()
        val dialedNumber = request?.address?.schemeSpecificPart
            ?: request?.extras?.getString("phone_number")
            ?: ""
        val address = request?.address ?: Uri.fromParts(PhoneAccount.SCHEME_TEL, dialedNumber, null)
        val connection = ChatrConnection(callId, true)

        connection.setAddress(address, TelecomManager.PRESENTATION_ALLOWED)
        connection.setInitialized()
        connection.setDialing()

        addConnection(callId, connection)
        launchOutgoingCallUi(callId, dialedNumber)

        return connection
    }

    override fun onCreateIncomingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?
    ): Connection {
        Log.i(TAG, "onCreateIncomingConnection address=${request?.address} extras=${request?.extras}")

        val rootExtras = request?.extras ?: Bundle()
        val extras = rootExtras.getBundle(TelecomManager.EXTRA_INCOMING_CALL_EXTRAS) ?: rootExtras
        val activeIdentity = ChatrVoipCallRegistry.activeIdentity(this)
        
        val callId = extras.getString("call_id") 
            ?: activeIdentity?.callId 
            ?: java.util.UUID.randomUUID().toString()
        val callerNumber = request?.address?.schemeSpecificPart
            ?: extras.getString("caller_phone")
            ?: extras.getString("caller_number")
            ?: activeIdentity?.callerPhone
            ?: extras.getString("caller_name")?.takeIf { value -> value.any(Char::isDigit) }
            ?: ""
        val callerId = extras.getString("caller_id") ?: activeIdentity?.callerId ?: ""
        val callerName = ChatrVoipCallRegistry.resolveDisplayName(
            context = this,
            callId = callId,
            callerId = callerId,
            proposedName = extras.getString("caller_name") ?: activeIdentity?.callerName,
            callerPhone = callerNumber,
        )
        val callerAvatar = extras.getString("caller_avatar") ?: activeIdentity?.callerAvatar
        val callType = extras.getString("call_type") ?: activeIdentity?.callType ?: "audio"
        val conversationId = extras.getString("conversation_id") ?: activeIdentity?.conversationId ?: ""

        val connection = ChatrConnection(
            callId = callId,
            isOutgoing = false,
            callerId = callerId,
            callerName = callerName,
            callerAvatar = callerAvatar,
            callerPhone = callerNumber,
            callType = callType,
            conversationId = conversationId,
        ).apply {
            setAddress(
                Uri.fromParts(PhoneAccount.SCHEME_TEL, callerNumber.ifBlank { "unknown" }, null),
                TelecomManager.PRESENTATION_ALLOWED
            )
            setCallerDisplayName(callerName, TelecomManager.PRESENTATION_ALLOWED)
            setRinging()
        }

        addConnection(callId, connection)

        return connection
    }

    override fun onCreateIncomingConnectionFailed(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?
    ) {
        Log.e(TAG, "onCreateIncomingConnectionFailed")
        super.onCreateIncomingConnectionFailed(connectionManagerPhoneAccount, request)
        CallForegroundService.releaseIfNoActiveCall(this, "incoming_connection_failed")

        val extras = request?.extras ?: Bundle()
        val rootExtras = extras.getBundle(TelecomManager.EXTRA_INCOMING_CALL_EXTRAS) ?: extras
        val activeIdentity = ChatrVoipCallRegistry.activeIdentity(this)
        
        val callId = rootExtras.getString("call_id") ?: activeIdentity?.callId ?: ""
        if (callId.isNotBlank()) {
            val callerId = rootExtras.getString("caller_id") ?: activeIdentity?.callerId ?: ""
            val callerName = rootExtras.getString("caller_name") ?: activeIdentity?.callerName ?: ""
            val callerAvatar = rootExtras.getString("caller_avatar") ?: activeIdentity?.callerAvatar
            val callerPhone = rootExtras.getString("caller_phone") ?: rootExtras.getString("caller_number") ?: activeIdentity?.callerPhone ?: ""
            val callType = rootExtras.getString("call_type") ?: activeIdentity?.callType ?: "audio"
            val conversationId = rootExtras.getString("conversation_id") ?: activeIdentity?.conversationId ?: ""

            Log.i(TAG, "TelecomManager incoming call failed; triggering high-reliability fallback notification and UI for $callId")
            ChatrNotificationCoordinator.triggerIncomingCallFallback(
                context = applicationContext,
                callId = callId,
                callerId = callerId,
                callerName = callerName,
                callerAvatar = callerAvatar,
                callerPhone = callerPhone,
                callType = callType,
                conversationId = conversationId
            )
        }
    }

    override fun onCreateOutgoingConnectionFailed(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?
    ) {
        Log.e(TAG, "onCreateOutgoingConnectionFailed")
        CallForegroundService.releaseIfNoActiveCall(this, "outgoing_connection_failed")
        super.onCreateOutgoingConnectionFailed(connectionManagerPhoneAccount, request)
    }

    private fun launchOutgoingCallUi(callId: String, phoneNumber: String) {
        try {
            val intent = Intent(this, com.chatr.app.webrtc.ShieldOutgoingCallActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("call_id", callId)
                putExtra("phone_number", phoneNumber)
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch outgoing call UI", e)
        }
    }
}

class ChatrConnection(
    val callId: String,
    val isOutgoing: Boolean,
    val callerId: String = "",
    val callerName: String = "",
    val callerAvatar: String? = null,
    val callerPhone: String = "",
    val callType: String = "audio",
    val conversationId: String = "",
) : Connection() {

    var connectTimeMs: Long = 0L
    var disconnectTimeMs: Long = 0L

    private var audioBridge: com.chatr.app.webrtc.WebRTCAudioBridge? = null

    fun setAudioBridge(bridge: com.chatr.app.webrtc.WebRTCAudioBridge?) {
        this.audioBridge = bridge
        if (state == STATE_ACTIVE) {
            bridge?.onAudioFocusGranted()
        }
    }

    companion object {
        private const val TAG = "ChatrConnection"
    }

    init {
        connectionProperties = Connection.PROPERTY_SELF_MANAGED
        connectionCapabilities =
            Connection.CAPABILITY_HOLD or
                Connection.CAPABILITY_SUPPORT_HOLD or
                Connection.CAPABILITY_MUTE or
                Connection.CAPABILITY_SUPPORTS_VT_LOCAL_BIDIRECTIONAL or
                Connection.CAPABILITY_SUPPORTS_VT_REMOTE_BIDIRECTIONAL

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioModeIsVoip = true
        }
        // Do NOT force earpiece here — Telecom picks the best default route.
        // Forcing earpiece here causes very low volume on some devices.
    }

    override fun onAnswer() {
        Log.i(TAG, "onAnswer: $callId")
        // Audio mode is managed by Telecom via onCallAudioStateChanged.
        // DO NOT set AudioManager.mode or isSpeakerphoneOn here —
        // doing so races with the Telecom audio router on OEM builds
        // (Xiaomi MIUI, Samsung OneUI) and causes near-silent audio.

        setActive()
        audioBridge?.onAudioFocusGranted()

        // START NATIVE WEBRTC INSTEAD OF WEBVIEW
        val context = ChatrApplication.getInstance()
        com.chatr.app.webrtc.WebRTCMediaService.startService(context)

        val intent = Intent(context, com.chatr.app.webrtc.ShieldActiveCallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("call_id", callId)
            putExtra("caller_id", callerId)
            putExtra("caller_name", callerName)
            putExtra("caller_phone", callerPhone)
            putExtra("call_type", callType)
            putExtra("conversation_id", conversationId)
        }
        context.startActivity(intent)
    }

    override fun onAnswer(videoState: Int) {
        Log.i(TAG, "onAnswer(video=$videoState): $callId")
        // Audio mode is managed by Telecom via onCallAudioStateChanged.
        // DO NOT set AudioManager.mode or isSpeakerphoneOn here.

        setActive()
        audioBridge?.onAudioFocusGranted()

        // START NATIVE WEBRTC INSTEAD OF WEBVIEW
        val context = ChatrApplication.getInstance()
        com.chatr.app.webrtc.WebRTCMediaService.startService(context)

        val intent = Intent(context, com.chatr.app.webrtc.ShieldActiveCallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("call_id", callId)
            putExtra("caller_id", callerId)
            putExtra("caller_name", callerName)
            putExtra("caller_phone", callerPhone)
            putExtra("call_type", callType)
            putExtra("conversation_id", conversationId)
        }
        context.startActivity(intent)
    }

    override fun onShowIncomingCallUi() {
        if (isOutgoing) return

        Log.i(TAG, "onShowIncomingCallUi: $callId")

        val context = ChatrApplication.getInstance()
        val intent = Intent(context, com.chatr.app.webrtc.ShieldIncomingCallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("call_id", callId)
            putExtra("caller_id", callerId)
            putExtra("caller_name", callerName)
            putExtra("caller_avatar", callerAvatar)
            putExtra("caller_phone", callerPhone)
            putExtra("caller_number", callerPhone)
            putExtra("call_type", callType)
            putExtra("conversation_id", conversationId)
        }

        try {
            context.startActivity(intent)
            Log.i(TAG, "ShieldIncomingCallActivity launched from Connection.onShowIncomingCallUi")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch ShieldIncomingCallActivity from Connection", e)
        }
    }

    override fun onReject() {
        Log.i(TAG, "onReject: $callId")
        setDisconnected(DisconnectCause(DisconnectCause.REJECTED))
        destroy()

        ChatrConnectionService.removeConnection(callId)
        notifyWebView("reject")
    }

    override fun onDisconnect() {
        Log.i(TAG, "onDisconnect: $callId")
        setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
        destroy()

        ChatrConnectionService.removeConnection(callId)
        notifyWebView("end")
    }

    override fun onHold() {
        Log.i(TAG, "onHold: $callId")
        setOnHold()
        notifyWebView("hold")
    }

    override fun onUnhold() {
        Log.i(TAG, "onUnhold: $callId")
        setActive()
        audioBridge?.onAudioFocusGranted()
        notifyWebView("unhold")
    }

    override fun onPlayDtmfTone(c: Char) {
        Log.d(TAG, "DTMF: $c")
        notifyWebView("dtmf:$c")
    }

    override fun onStopDtmfTone() {
        // no-op
    }

    override fun onCallAudioStateChanged(state: android.telecom.CallAudioState?) {
        Log.d(TAG, "Audio state changed: ${state?.route}")

        val routeName = when (state?.route) {
            android.telecom.CallAudioState.ROUTE_EARPIECE -> "earpiece"
            android.telecom.CallAudioState.ROUTE_SPEAKER -> "speaker"
            android.telecom.CallAudioState.ROUTE_BLUETOOTH -> "bluetooth"
            android.telecom.CallAudioState.ROUTE_WIRED_HEADSET -> "wired"
            else -> "default"
        }

        audioBridge?.setAudioRoute(routeName)
        notifyWebView("audio_route:$routeName")
    }

    private fun notifyWebView(action: String) {
        Log.d(TAG, "Notifying WebView: $action for call $callId")

        val context = ChatrApplication.getInstance()
        val intent = Intent("com.chatr.app.CALL_ACTION").apply {
            setPackage(context.packageName)
            putExtra("action", action)
            putExtra("call_id", callId)
            putExtra("caller_id", callerId)
            putExtra("caller_name", callerName)
            putExtra("caller_avatar", callerAvatar)
            putExtra("caller_phone", callerPhone)
            putExtra("caller_number", callerPhone)
            putExtra("call_type", callType)
            putExtra("conversation_id", conversationId)
        }
        context.sendBroadcast(intent)
    }

    fun endCall() {
        Log.i(TAG, "Ending call programmatically: $callId")
        setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
        destroy()
        ChatrConnectionService.removeConnection(callId)
    }

    fun handoffToWebCall() {
        Log.i(TAG, "Releasing native Telecom shell for WebView media call: $callId")
        setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
        destroy()
        ChatrConnectionService.removeConnection(callId, releaseForeground = false)
    }

    fun closeAsReplaced(reason: String) {
        Log.i(TAG, "Closing replaced/stale call $callId ($reason)")
        try {
            setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
            destroy()
        } catch (error: Exception) {
            Log.w(TAG, "Failed to close replaced connection $callId", error)
        }
    }

    fun markMissed() {
        Log.i(TAG, "Marking call missed: $callId")
        setDisconnected(DisconnectCause(DisconnectCause.MISSED))
        destroy()
        ChatrConnectionService.removeConnection(callId)
        notifyWebView("missed")
    }

    fun markAnswered() {
        setActive()
        audioBridge?.onAudioFocusGranted()
    }

    fun markDialing() {
        setDialing()
    }
}
