package com.chatr.app.webrtc

import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.bumptech.glide.Glide
import com.chatr.app.R
import com.chatr.app.services.ChatrConnectionService
import com.chatr.app.services.ChatrNotificationCoordinator
import com.chatr.app.services.ChatrVoipCallRegistry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * ShieldIncomingCallActivity
 * 
 * The native Android incoming call UI for the Chatr Shield experience.
 * Fully replaces the Capacitor WebView for answering calls.
 */
class ShieldIncomingCallActivity : ComponentActivity() {

    companion object {
        private const val TAG = "ShieldIncomingCallActivity"
        private const val CALL_TIMEOUT_MS = 60_000L
        private const val CALL_ACTION_FILTER = "com.chatr.app.CALL_ACTION"
    }

    private var callId: String = ""
    private var callerId: String = ""
    private var callerName: String = ""
    private var callerAvatar: String? = null
    private var callerPhone: String = ""
    private var callType: String = "audio"
    private var conversationId: String = ""

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var timeoutJob: Job? = null
    private var incomingUiFinishStarted = false
    private val scope = CoroutineScope(Dispatchers.Main)

    private val callActionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent == null) return
            val targetCallId = intent.getStringExtra("call_id") ?: return
            if (targetCallId != callId) return

            when (val action = intent.getStringExtra("action")) {
                "answer", "reject", "end" -> finishIncomingUi("external call action: $action")
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i(TAG, "ShieldIncomingCallActivity onCreate")

        setupFullscreenOverLockscreen()
        extractCallData()
        registerCallReceiver()
        setContentView(R.layout.activity_shield_incoming_call)
        setupUI()
        startRinging()
        setupTimeout()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        
        val newCallId = intent.getStringExtra("call_id") ?: ""
        if (newCallId.isNotEmpty() && newCallId == callId) return

        stopRinging()
        timeoutJob?.cancel()
        incomingUiFinishStarted = false

        extractCallData()
        setupUI()
        startRinging()
        setupTimeout()
    }

    private fun setupFullscreenOverLockscreen() {
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }

        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).let { controller ->
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun extractCallData() {
        callId = intent.getStringExtra("call_id") ?: ""
        callerId = intent.getStringExtra("caller_id") ?: ""
        val rawCallerName = intent.getStringExtra("caller_name")
        callerPhone = intent.getStringExtra("caller_phone")
            ?: intent.getStringExtra("caller_number")
            ?: ChatrVoipCallRegistry.extractPhoneCandidate(rawCallerName)
            ?: ""
        callerName = ChatrVoipCallRegistry.resolveDisplayName(this, callId, callerId, rawCallerName, callerPhone)
        callerAvatar = ChatrVoipCallRegistry.resolveAvatar(this, callId, callerId, intent.getStringExtra("caller_avatar"), callerPhone, rawCallerName)
        callType = intent.getStringExtra("call_type") ?: "audio"
        conversationId = intent.getStringExtra("conversation_id") ?: ""
        
        ChatrVoipCallRegistry.markIncoming(this, callId, callerId, callerName, callerAvatar, callerPhone, callType, conversationId)
    }

    private fun registerCallReceiver() {
        val filter = IntentFilter(CALL_ACTION_FILTER)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(callActionReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            registerReceiver(callActionReceiver, filter)
        }
    }

    private fun setupUI() {
        val displayPhone = formatCallerPhone(callerPhone)
        val displayName = callerName.ifBlank { displayPhone.ifBlank { "Unknown caller" } }

        findViewById<TextView>(R.id.callerNameText)?.text = displayName
        findViewById<TextView>(R.id.callerPhoneText)?.text = if (displayPhone == displayName) "Incoming Call" else displayPhone

        val avatarView = findViewById<ImageView>(R.id.callerAvatarImage)
        val initialView = findViewById<TextView>(R.id.callerInitialText)
        
        if (!callerAvatar.isNullOrBlank()) {
            initialView?.visibility = View.GONE
            avatarView?.let {
                Glide.with(this).load(callerAvatar).circleCrop().into(it)
            }
            findViewById<ImageView>(R.id.backgroundBlurImage)?.let { bgView ->
                Glide.with(this).load(callerAvatar).centerCrop().into(bgView)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    bgView.setRenderEffect(android.graphics.RenderEffect.createBlurEffect(50f, 50f, android.graphics.Shader.TileMode.CLAMP))
                }
            }
        } else {
            avatarView?.setImageDrawable(null)
            initialView?.visibility = View.VISIBLE
            initialView?.text = displayName.firstOrNull { it.isLetterOrDigit() }?.uppercaseChar()?.toString() ?: "C"
        }

        findViewById<View>(R.id.btnAnswer)?.setOnClickListener { answerCall() }
        findViewById<View>(R.id.btnDecline)?.setOnClickListener { rejectCall() }
    }

    private fun formatCallerPhone(phone: String): String {
        val digits = phone.filter { it.isDigit() }
        return when {
            digits.length == 12 && digits.startsWith("91") -> "+91 ${digits.substring(2, 7)} ${digits.substring(7)}"
            digits.length == 10 -> "${digits.substring(0, 5)} ${digits.substring(5)}"
            phone.isNotBlank() -> phone
            else -> ""
        }
    }

    private fun startRinging() {
        stopRinging()
        try {
            val pattern = longArrayOf(0, 500, 800, 500, 800)
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start vibration", e)
        }

        try {
            val fallbackUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(this@ShieldIncomingCallActivity, fallbackUri)
                isLooping = true
                prepare()
                start()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start ringtone", e)
        }
    }

    private fun stopRinging() {
        try {
            vibrator?.cancel()
            mediaPlayer?.stop()
            mediaPlayer?.release()
        } catch (_: Exception) {} finally {
            mediaPlayer = null
        }
    }

    private fun setupTimeout() {
        timeoutJob = scope.launch {
            delay(CALL_TIMEOUT_MS)
            Log.i(TAG, "Incoming call timed out - marking missed")
            ChatrConnectionService.missConnection(callId)
            finishIncomingUi("missed call")
        }
    }

    private fun answerCall() {
        Log.i(TAG, "Answering call via Telecom: $callId")
        ChatrNotificationCoordinator.cancelIncomingCallNotification(this, callId)
        
        // Let Telecom Connection handle launching ShieldActiveCallActivity
        ChatrConnectionService.answerConnection(callId)
        
        finishIncomingUi("answer button")
    }

    private fun rejectCall() {
        Log.i(TAG, "Rejecting call via Telecom: $callId")
        ChatrNotificationCoordinator.cancelIncomingCallNotification(this, callId)
        ChatrConnectionService.rejectConnection(callId)
        finishIncomingUi("reject button")
    }

    private fun finishIncomingUi(reason: String) {
        if (incomingUiFinishStarted || isFinishing || isDestroyed) return
        incomingUiFinishStarted = true
        Log.i(TAG, "Closing incoming UI for $callId ($reason)")
        
        if (reason.contains("reject") || reason.contains("missed")) {
            ChatrVoipCallRegistry.clear(this, callId)
        }
        
        stopRinging()
        timeoutJob?.cancel()
        finish()
    }

    override fun onDestroy() {
        stopRinging()
        timeoutJob?.cancel()
        try { unregisterReceiver(callActionReceiver) } catch (_: Exception) {}
        super.onDestroy()
    }

    override fun onBackPressed() {}
}
