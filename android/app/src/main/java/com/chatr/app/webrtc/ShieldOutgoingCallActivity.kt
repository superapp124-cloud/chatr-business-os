package com.chatr.app.webrtc

import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.bumptech.glide.Glide
import com.chatr.app.R
import com.chatr.app.services.ChatrConnectionService
import com.chatr.app.services.ChatrVoipCallRegistry
import android.media.AudioManager
import org.webrtc.IceCandidate
import org.webrtc.VideoTrack
import android.media.ToneGenerator
import java.util.concurrent.atomic.AtomicBoolean

/**
 * ShieldOutgoingCallActivity
 * 
 * The native Android outgoing call UI for the Chatr Shield experience.
 */
class ShieldOutgoingCallActivity : AppCompatActivity(), WebRTCEventListener, SignalingListener {

    private lateinit var webrtcClient: NativeWebRTCClient
    private lateinit var signalingClient: NativeSignalingClient

    private var callId: String = ""
    private var phoneNumber: String = ""
    
    private var toneGenerator: ToneGenerator? = null
    private val isRinging = AtomicBoolean(true)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        setupImmersiveMode()
        setContentView(R.layout.activity_shield_outgoing_call)

        callId = intent.getStringExtra("call_id") ?: ""
        phoneNumber = intent.getStringExtra("phone_number") ?: ""
        
        setupAudio()
        setupUI()
        initWebRTC()
    }

    private fun setupImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).let { controller ->
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun setupAudio() {
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        audioManager.isSpeakerphoneOn = false

        try {
            toneGenerator = ToneGenerator(AudioManager.STREAM_VOICE_CALL, 100)
            Thread {
                while (isRinging.get() && toneGenerator != null) {
                    toneGenerator?.startTone(ToneGenerator.TONE_SUP_RINGTONE)
                    Thread.sleep(2000)
                    toneGenerator?.stopTone()
                    if (isRinging.get()) Thread.sleep(4000)
                }
            }.start()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun setupUI() {
        val callerName = ChatrVoipCallRegistry.resolveDisplayName(this, callId, "", "", phoneNumber)
        val callerAvatar = ChatrVoipCallRegistry.resolveAvatar(this, callId, "", null, phoneNumber, "")

        findViewById<TextView>(R.id.callerNameText)?.text = callerName.ifBlank { phoneNumber }
        
        val avatarView = findViewById<ImageView>(R.id.callerAvatarImage)
        val initialView = findViewById<TextView>(R.id.callerInitialText)
        if (!callerAvatar.isNullOrBlank()) {
            initialView?.visibility = View.GONE
            avatarView?.visibility = View.VISIBLE
            avatarView?.let { Glide.with(this).load(callerAvatar).circleCrop().into(it) }
            findViewById<ImageView>(R.id.backgroundBlurImage)?.let { bgView ->
                Glide.with(this).load(callerAvatar).centerCrop().into(bgView)
            }
        } else {
            avatarView?.visibility = View.INVISIBLE
            avatarView?.setImageDrawable(null)
            initialView?.visibility = View.VISIBLE
            initialView?.text = callerName.firstOrNull { it.isLetterOrDigit() }?.uppercaseChar()?.toString() ?: "C"
        }

        findViewById<View>(R.id.btnEndCall)?.setOnClickListener { endCall() }
    }

    private fun initWebRTC() {
        val prefs = getSharedPreferences("chatr_prefs", Context.MODE_PRIVATE)
        val myUserId = prefs.getString("user_id", "") ?: ""
        
        signalingClient = NativeSignalingClient(this, com.chatr.app.BuildConfig.SOCKET_URL, myUserId)
        webrtcClient = NativeWebRTCClient(applicationContext, signalingClient)
        
        ChatrConnectionService.getConnection(callId)?.setAudioBridge(webrtcClient)

        signalingClient.connect()
        
        webrtcClient.currentCallId = callId
        webrtcClient.eventListener = this
        signalingClient.listener = this
        
        // Setup WebRTC and create offer (signaling handles DB storage)
        webrtcClient.startCall()
    }

    private fun endCall() {
        isRinging.set(false)
        toneGenerator?.release()
        toneGenerator = null
        ChatrConnectionService.getConnection(callId)?.endCall()
        webrtcClient.endCall()
        WebRTCMediaService.stopService(this)
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
    }

    // WebRTC Listeners
    override fun onRemoteVideoTrackAdded(userId: String, track: VideoTrack) {}
    override fun onRemoteVideoTrackRemoved(userId: String) {}

    override fun onOfferReceived(senderId: String, offerSdp: String, callId: String) {}

    override fun onAnswerReceived(senderId: String, answerSdp: String) {
        runOnUiThread {
            isRinging.set(false)
            toneGenerator?.release()
            toneGenerator = null
            findViewById<TextView>(R.id.callStatusText)?.text = "Connected"
            webrtcClient.handleRemoteAnswerFromDB(answerSdp, senderId) 
        }
    }

    override fun onIceCandidateReceived(senderId: String, candidate: String, sdpMid: String, sdpMLineIndex: Int) {
        runOnUiThread { webrtcClient.handleRemoteIceCandidate(IceCandidate(sdpMid, sdpMLineIndex, candidate), senderId) }
    }

    override fun onCallEnded(senderId: String) {
        runOnUiThread { endCall() }
    }
}
