package com.chatr.app.webrtc

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import android.util.Log
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody

interface SignalingListener {
    fun onOfferReceived(senderId: String, offerSdp: String, callId: String)
    fun onAnswerReceived(senderId: String, answerSdp: String)
    fun onIceCandidateReceived(senderId: String, candidate: String, sdpMid: String, sdpMLineIndex: Int)
    fun onCallEnded(senderId: String)
}


class NativeSignalingClient(private val context: android.content.Context, private val signalingUrl: String, private val userId: String) {
    private var socket: Socket? = null
    var listener: SignalingListener? = null
    
    private val scope = CoroutineScope(Dispatchers.IO)

    companion object {
        private const val TAG = "NativeSignaling"
    }

    fun connect() {
        scope.launch {
            try {
                val options = IO.Options()
                val validToken = com.chatr.app.auth.NativeAuthManager.getValidTokenAsync(context)
                if (validToken.isNullOrEmpty()) {
                    Log.e(TAG, "Authentication expired and refresh failed. Aborting connection.")
                    listener?.onCallEnded("")
                    return@launch
                }
                options.query = "userId=$userId&token=$validToken"
                options.transports = arrayOf("websocket")

            socket = IO.socket(signalingUrl, options)

            socket?.on(Socket.EVENT_CONNECT) {
                Log.d(TAG, "Connected to signaling server")
            }

            socket?.on(Socket.EVENT_DISCONNECT) {
                Log.d(TAG, "Disconnected from signaling server")
            }

            socket?.on("call-offer") { args ->
                try {
                    if (args.isNotEmpty()) {
                        val root = args[0] as JSONObject
                        Log.d(TAG, "Received call-offer: $root")
                        val data = if (root.has("data")) root.getJSONObject("data") else root
                        val from = root.optString("from", "")
                        val callId = root.optString("callId", "")
                        listener?.onOfferReceived(from, data.getString("sdp"), callId)
                    }
                } catch (e: Exception) { Log.e(TAG, "Error parsing call-offer", e) }
            }

            socket?.on("call-answer") { args ->
                try {
                    if (args.isNotEmpty()) {
                        val root = args[0] as JSONObject
                        Log.d(TAG, "Received call-answer: $root")
                        val data = if (root.has("data")) root.getJSONObject("data") else root
                        val from = root.optString("from", "")
                        listener?.onAnswerReceived(from, data.getString("sdp"))
                    }
                } catch (e: Exception) { Log.e(TAG, "Error parsing call-answer", e) }
            }

            socket?.on("call-candidate") { args ->
                try {
                    if (args.isNotEmpty()) {
                        val root = args[0] as JSONObject
                        Log.d(TAG, "Received call-candidate: $root")
                        val data = if (root.has("data")) root.getJSONObject("data") else root
                        val from = root.optString("from", "")
                        listener?.onIceCandidateReceived(
                            from,
                            data.getString("candidate"),
                            data.getString("sdpMid"),
                            data.getInt("sdpMLineIndex")
                        )
                    }
                } catch (e: Exception) { Log.e(TAG, "Error parsing call-candidate", e) }
            }
            
            socket?.on("call-end") { args ->
                try {
                    if (args.isNotEmpty()) {
                        val root = args[0] as JSONObject
                        val from = root.optString("from", "")
                        Log.d(TAG, "Received call-end from $from")
                        listener?.onCallEnded(from)
                    }
                } catch (e: Exception) { Log.e(TAG, "Error parsing call-end", e) }
            }

            socket?.connect()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to connect to signaling server", e)
        }
        }
    }

    private fun sendSignalToSupabase(type: String, targetUserId: String, data: JSONObject, callId: String) {
        Thread {
            try {
                val url = "${com.chatr.app.BuildConfig.SUPABASE_URL}/rest/v1/webrtc_signals"
                val payload = org.json.JSONObject().apply {
                    put("call_id", callId)
                    put("from_user", userId)
                    put("to_user", targetUserId)
                    put("signal_type", type)
                    put("signal_data", data)
                }

                val mediaType = "application/json; charset=utf-8".toMediaTypeOrNull()
                val requestBody = payload.toString().toRequestBody(mediaType)

                val validToken = com.chatr.app.auth.NativeAuthManager.getValidTokenBlocking(context) ?: ""
                val request = okhttp3.Request.Builder()
                    .url(url)
                    .post(requestBody)
                    .header("apikey", com.chatr.app.BuildConfig.SUPABASE_KEY)
                    .header("Authorization", "Bearer $validToken")
                    .header("Content-Type", "application/json")
                    .header("Prefer", "return=minimal")
                    .build()

                val client = okhttp3.OkHttpClient.Builder()
                    .authenticator(com.chatr.app.auth.SupabaseAuthenticator(context))
                    .build()
                val response = client.newCall(request).execute()
                Log.d(TAG, "Sent $type to Supabase: ${response.code}")
            } catch (e: Exception) {
                Log.e(TAG, "Error sending $type to Supabase", e)
            }
        }.start()
    }

    fun sendOffer(targetUserId: String, sdp: String, callId: String) {
        val data = JSONObject().apply {
            put("sdp", sdp)
            put("type", "offer")
        }
        sendSignalToSupabase("offer", targetUserId, data, callId)
        
        // Also emit to socket
        val payload = JSONObject().apply {
            put("callId", callId)
            put("targetId", targetUserId)
            put("from", userId)
            put("data", data)
        }
        socket?.emit("call-offer", payload)
        Log.d(TAG, "Sent call-offer to $targetUserId")
    }

    fun sendAnswer(targetUserId: String, sdp: String, callId: String) {
        val data = JSONObject().apply {
            put("sdp", sdp)
            put("type", "answer")
        }
        sendSignalToSupabase("answer", targetUserId, data, callId)
        
        // Also emit to socket
        val payload = JSONObject().apply {
            put("callId", callId)
            put("targetId", targetUserId)
            put("from", userId)
            put("data", data)
        }
        socket?.emit("call-answer", payload)
        Log.d(TAG, "Sent call-answer to $targetUserId")
    }

    fun sendIceCandidate(targetUserId: String, candidate: String, sdpMid: String, sdpMLineIndex: Int, callId: String) {
        val data = JSONObject().apply {
            put("candidate", candidate)
            put("sdpMid", sdpMid)
            put("sdpMLineIndex", sdpMLineIndex)
            put("type", "ice-candidate")
        }
        sendSignalToSupabase("ice-candidate", targetUserId, data, callId)
        
        // Also emit to socket
        val payload = JSONObject().apply {
            put("callId", callId)
            put("targetId", targetUserId)
            put("from", userId)
            put("data", data)
        }
        socket?.emit("call-candidate", payload)
        Log.d(TAG, "Sent ICE candidate to $targetUserId")
    }

    fun sendCallEnd(targetUserId: String, callId: String) {
        val data = JSONObject().apply {
            put("type", "call-end")
        }
        sendSignalToSupabase("call-end", targetUserId, data, callId)
        
        val payload = JSONObject().apply {
            put("callId", callId)
            put("targetId", targetUserId)
            put("from", userId)
            put("data", data)
        }
        socket?.emit("call-end", payload)
        Log.d(TAG, "Sent call-end to $targetUserId")
    }

    fun disconnect() {
        socket?.disconnect()
        socket = null
    }
}
