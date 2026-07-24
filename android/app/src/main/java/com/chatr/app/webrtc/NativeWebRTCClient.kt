package com.chatr.app.webrtc

import android.content.Context
import android.util.Log
import org.webrtc.*
import java.util.concurrent.ConcurrentHashMap

interface WebRTCEventListener {
    fun onRemoteVideoTrackAdded(userId: String, track: VideoTrack)
    fun onRemoteVideoTrackRemoved(userId: String)
}

class NativeWebRTCClient(private val context: Context, private val signalingClient: NativeSignalingClient) : WebRTCAudioBridge {
    private var factory: PeerConnectionFactory? = null
    
    // Mesh Network: Map of targetUserId to their PeerConnection
    private val peerConnections = ConcurrentHashMap<String, PeerConnection>()
    
    private var audioSource: AudioSource? = null
    private var localAudioTrack: AudioTrack? = null
    private var videoSource: VideoSource? = null
    private var localVideoTrack: VideoTrack? = null
    private var videoCapturer: VideoCapturer? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null

    var localVideoView: SurfaceViewRenderer? = null
    
    var eventListener: WebRTCEventListener? = null

    var currentCallId: String = ""
    var targetUserIds: MutableList<String> = mutableListOf() // The initial targets when starting a call

    companion object {
        private const val TAG = "NativeWebRTCClient"
        private const val VIDEO_RESOLUTION_WIDTH = 640 // Lower resolution for mesh to save bandwidth
        private const val VIDEO_RESOLUTION_HEIGHT = 480
        private const val VIDEO_FPS = 24
    }

    init {
        factory = WebRTCFactoryManager.factory
        createAudioTrack()
    }

    fun startCall() {
        if (targetUserIds.isEmpty() || currentCallId.isEmpty()) {
            Log.e(TAG, "Cannot start call without targets or callId")
            return
        }

        // For a mesh network, initiate a connection and offer to EVERY target user
        for (userId in targetUserIds) {
            initiateConnectionToUser(userId)
        }
    }
    
    fun addParticipant(userId: String) {
        if (!targetUserIds.contains(userId)) {
            targetUserIds.add(userId)
        }
        initiateConnectionToUser(userId)
    }

    private fun initiateConnectionToUser(userId: String) {
        val pc = getOrCreatePeerConnection(userId)
        
        val isVideo = localVideoTrack != null
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", if (isVideo) "true" else "false"))
        }

        pc.createOffer(object : SimpleSdpObserver() {
            override fun onCreateSuccess(sessionDescription: SessionDescription) {
                val optimizedSdp = applySdpTweaks(sessionDescription.description)
                val newDesc = SessionDescription(sessionDescription.type, optimizedSdp)
                pc.setLocalDescription(SimpleSdpObserver(), newDesc)
                
                signalingClient.sendOffer(userId, newDesc.description, currentCallId)
            }
        }, constraints)
    }

    fun handleRemoteOfferFromDB(offerSdp: String, senderId: String, callId: String) {
        currentCallId = callId
        if (!targetUserIds.contains(senderId)) {
            targetUserIds.add(senderId)
        }
        
        val pc = getOrCreatePeerConnection(senderId)
        pc.setRemoteDescription(SimpleSdpObserver(), SessionDescription(SessionDescription.Type.OFFER, offerSdp))

        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "true"))
        }

        pc.createAnswer(object : SimpleSdpObserver() {
            override fun onCreateSuccess(sessionDescription: SessionDescription) {
                val optimizedSdp = applySdpTweaks(sessionDescription.description)
                val newDesc = SessionDescription(sessionDescription.type, optimizedSdp)
                pc.setLocalDescription(SimpleSdpObserver(), newDesc)
                
                signalingClient.sendAnswer(senderId, newDesc.description, currentCallId)
            }
        }, constraints)
    }

    fun handleRemoteAnswerFromDB(answerSdp: String, senderId: String) {
        val pc = peerConnections[senderId]
        if (pc != null) {
            pc.setRemoteDescription(SimpleSdpObserver(), SessionDescription(SessionDescription.Type.ANSWER, answerSdp))
        } else {
            Log.e(TAG, "Received answer for unknown user: $senderId")
        }
    }

    fun handleRemoteIceCandidate(iceCandidate: IceCandidate, senderId: String) {
        val pc = getOrCreatePeerConnection(senderId)
        pc.addIceCandidate(iceCandidate)
    }

    private fun getOrCreatePeerConnection(userId: String): PeerConnection {
        if (peerConnections.containsKey(userId)) {
            return peerConnections[userId]!!
        }

        val iceServers = mutableListOf<PeerConnection.IceServer>(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
            PeerConnection.IceServer.builder("stun:stun.cloudflare.com:3478").createIceServer(),
            PeerConnection.IceServer.builder("turn:turn.cloudflare.com:3478?transport=udp")
                .setUsername("chatr")
                .setPassword("chatrpass")
                .createIceServer(),
            PeerConnection.IceServer.builder("turn:turn.cloudflare.com:3478?transport=tcp")
                .setUsername("chatr")
                .setPassword("chatrpass")
                .createIceServer()
        )

        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        }

        val pc = factory?.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onTrack(transceiver: RtpTransceiver?) {
                val track = transceiver?.receiver?.track()
                if (track is VideoTrack) {
                    Log.i(TAG, "Received remote video track from $userId")
                    eventListener?.onRemoteVideoTrackAdded(userId, track)
                }
            }

            override fun onIceCandidate(iceCandidate: IceCandidate) {
                signalingClient.sendIceCandidate(userId, iceCandidate.sdp, iceCandidate.sdpMid, iceCandidate.sdpMLineIndex, currentCallId)
            }

            override fun onSignalingChange(newState: PeerConnection.SignalingState) {}
            override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState) {
                if (newState == PeerConnection.IceConnectionState.DISCONNECTED || newState == PeerConnection.IceConnectionState.FAILED) {
                    eventListener?.onRemoteVideoTrackRemoved(userId)
                    // Trigger renegotiation on ICE failure
                    renegotiate(userId)
                }
            }
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(newState: PeerConnection.IceGatheringState) {}
            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) {}
            override fun onDataChannel(dataChannel: DataChannel) {}
            
            override fun onRenegotiationNeeded() {
                renegotiate(userId)
            }
            override fun onAddStream(stream: MediaStream) {
                Log.i(TAG, "Received onAddStream from $userId")
                if (stream.videoTracks.isNotEmpty()) {
                    val track = stream.videoTracks[0]
                    Log.i(TAG, "Extracted remote video track from stream for $userId")
                    eventListener?.onRemoteVideoTrackAdded(userId, track)
                }
            }
            override fun onRemoveStream(stream: MediaStream) {}
            override fun onConnectionChange(newState: PeerConnection.PeerConnectionState) {
                Log.d(TAG, "Connection state changed for $userId: $newState")
            }
        })

        if (pc != null) {
            localAudioTrack?.let { pc.addTrack(it, listOf("ARDAMS")) }
            localVideoTrack?.let { pc.addTrack(it, listOf("ARDAMS")) }
            peerConnections[userId] = pc
        }

        return pc!!
    }

    private fun renegotiate(userId: String) {
        val pc = peerConnections[userId] ?: return
        if (currentCallId.isEmpty()) return
        
        val isVideo = localVideoTrack != null
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("IceRestart", "true")) // Helpful if ICE failed
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", if (isVideo) "true" else "false"))
        }
        pc.createOffer(object : SimpleSdpObserver() {
            override fun onCreateSuccess(sessionDescription: SessionDescription) {
                val optimizedSdp = applySdpTweaks(sessionDescription.description)
                val newDesc = SessionDescription(sessionDescription.type, optimizedSdp)
                pc.setLocalDescription(SimpleSdpObserver(), newDesc)
                signalingClient.sendOffer(userId, newDesc.description, currentCallId)
            }
        }, constraints)
    }

    private fun createAudioTrack() {
        val audioConstraints = MediaConstraints()
        audioSource = factory?.createAudioSource(audioConstraints)
        localAudioTrack = factory?.createAudioTrack("ARDAMSa0", audioSource)
        localAudioTrack?.setEnabled(false) // Wait for Telecom focus
        
        // Add to existing connections
        peerConnections.values.forEach { pc ->
            localAudioTrack?.let { pc.addTrack(it, listOf("ARDAMS")) }
        }
    }

    fun createVideoTrack() {
        if (localVideoTrack != null) return
        
        videoCapturer = createVideoCapturer()
        surfaceTextureHelper = SurfaceTextureHelper.create("CaptureThread", WebRTCFactoryManager.eglBase!!.eglBaseContext)
        videoSource = factory?.createVideoSource(videoCapturer!!.isScreencast)
        videoCapturer?.initialize(surfaceTextureHelper, context, videoSource?.capturerObserver)
        videoCapturer?.startCapture(VIDEO_RESOLUTION_WIDTH, VIDEO_RESOLUTION_HEIGHT, VIDEO_FPS)

        localVideoTrack = factory?.createVideoTrack("ARDAMSv0", videoSource)
        localVideoTrack?.setEnabled(true)
        localVideoView?.let { localVideoTrack?.addSink(it) }
        
        // Add to existing connections and immediately renegotiate so remote sees our video
        peerConnections.keys.forEach { userId ->
            val pc = peerConnections[userId] ?: return@forEach
            localVideoTrack?.let { pc.addTrack(it, listOf("ARDAMS")) }
            // Renegotiate to send updated offer with video to the remote peer
            renegotiateWithVideo(userId, pc)
        }
    }

    fun renegotiateWithVideo(userId: String, pc: PeerConnection) {
        if (currentCallId.isEmpty()) return
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "true"))
        }
        pc.createOffer(object : SimpleSdpObserver() {
            override fun onCreateSuccess(sessionDescription: SessionDescription) {
                val optimizedSdp = applySdpTweaks(sessionDescription.description)
                val newDesc = SessionDescription(sessionDescription.type, optimizedSdp)
                pc.setLocalDescription(SimpleSdpObserver(), newDesc)
                signalingClient.sendOffer(userId, newDesc.description, currentCallId)
                Log.i(TAG, "Renegotiated with video for $userId")
            }
        }, constraints)
    }


    private fun createVideoCapturer(): VideoCapturer? {
        val enumerator = Camera2Enumerator(context)
        val deviceNames = enumerator.deviceNames
        for (deviceName in deviceNames) {
            if (enumerator.isFrontFacing(deviceName)) {
                return enumerator.createCapturer(deviceName, null)
            }
        }
        for (deviceName in deviceNames) {
            if (enumerator.isBackFacing(deviceName)) {
                return enumerator.createCapturer(deviceName, null)
            }
        }
        return null
    }

    fun startScreenCapture(mediaProjectionPermissionResultData: android.content.Intent) {
        if (videoSource == null) return
        
        // Stop current camera capture
        videoCapturer?.stopCapture()
        videoCapturer?.dispose()
        
        // Create screen capturer
        videoCapturer = ScreenCapturerAndroid(mediaProjectionPermissionResultData, object : android.media.projection.MediaProjection.Callback() {
            override fun onStop() {
                Log.e(TAG, "Screen capture stopped")
            }
        })
        
        // Reinitialize and start
        videoCapturer?.initialize(surfaceTextureHelper, context, videoSource?.capturerObserver)
        videoCapturer?.startCapture(1280, 720, 30)
    }

    fun stopScreenCapture() {
        if (videoSource == null) return
        
        // Stop screen capture
        videoCapturer?.stopCapture()
        videoCapturer?.dispose()
        
        // Revert back to camera
        videoCapturer = createVideoCapturer()
        videoCapturer?.initialize(surfaceTextureHelper, context, videoSource?.capturerObserver)
        videoCapturer?.startCapture(VIDEO_RESOLUTION_WIDTH, VIDEO_RESOLUTION_HEIGHT, VIDEO_FPS)
    }

    fun endCall() {
        for (userId in targetUserIds) {
            signalingClient.sendCallEnd(userId, currentCallId)
        }
        
        peerConnections.values.forEach { it.close() }
        peerConnections.clear()

        videoCapturer?.stopCapture()
        videoCapturer?.dispose()
        surfaceTextureHelper?.dispose()
        videoSource?.dispose()
        audioSource?.dispose()
        signalingClient.disconnect()
    }

    fun release() {
        Log.i(TAG, "Releasing NativeWebRTCClient")
        localAudioTrack?.dispose()
        localVideoTrack?.dispose()
        peerConnections.values.forEach { it.dispose() }
        peerConnections.clear()
    }

    override fun onAudioFocusGranted() {
        localAudioTrack?.setEnabled(true)
    }

    override fun onAudioFocusLost() {
        localAudioTrack?.setEnabled(false)
    }

    override fun setAudioRoute(route: String) {}

    fun getEglBaseContext(): EglBase.Context {
        return WebRTCFactoryManager.eglBase!!.eglBaseContext
    }

    fun toggleAudio(enable: Boolean) {
        localAudioTrack?.setEnabled(enable)
    }

    fun toggleVideo(enable: Boolean) {
        if (enable && localVideoTrack == null) {
            createVideoTrack()
        }
        localVideoTrack?.setEnabled(enable)
    }

    fun switchCamera() {
        videoCapturer?.let {
            if (it is org.webrtc.CameraVideoCapturer) {
                it.switchCamera(null)
            }
        }
    }

    fun sendDtmf(digit: String) {
        try {
            peerConnections.values.firstOrNull()?.senders?.firstOrNull { it.track()?.kind() == "audio" }
                ?.dtmf()?.insertDtmf(digit, 100, 50)
        } catch (e: Exception) {
            android.util.Log.w("NativeWebRTCClient", "DTMF send failed: ${e.message}")
        }
    }

    private fun applySdpTweaks(sdp: String): String {
        var modifiedSdp = sdp
        if (!modifiedSdp.contains("b=AS:1500")) {
            modifiedSdp = modifiedSdp.replace(Regex("(m=video .*?)\r\n"), "$1\r\nb=AS:1500\r\n") // Lowered for mesh
        }
        if (!modifiedSdp.contains("b=AS:128")) {
            modifiedSdp = modifiedSdp.replace(Regex("(m=audio .*?)\r\n"), "$1\r\nb=AS:128\r\n")
        }
        if (!modifiedSdp.contains("usedtx=1")) {
            modifiedSdp = modifiedSdp.replace("useinbandfec=1", "useinbandfec=1;usedtx=1")
        }
        return modifiedSdp
    }
}

open class SimpleSdpObserver : SdpObserver {
    override fun onCreateSuccess(sessionDescription: SessionDescription) {}
    override fun onSetSuccess() {}
    override fun onCreateFailure(s: String) {}
    override fun onSetFailure(s: String) {}
}
