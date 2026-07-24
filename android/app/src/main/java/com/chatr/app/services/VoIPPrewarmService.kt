package com.chatr.app.services

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.util.Log
import android.os.PowerManager
import android.os.Build
import android.app.NotificationChannel
import android.app.NotificationManager
import androidx.core.app.NotificationCompat
import com.chatr.app.auth.NativeAuthManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * VoIPPrewarmService
 *
 * Boots a lightweight background context when an FCM push arrives BEFORE the
 * user taps "Accept". This gives WebRTC time to complete ICE gathering and
 * getUserMedia so the call connects instantly when the user responds.
 *
 * STATELESS: writes only to SharedPreferences, never touches call state.
 * Safe to start multiple times — idempotent.
 *
 * Started by: ChatrFirebaseMessagingService when payload has "type":"incoming_call"
 */
class VoIPPrewarmService : Service() {

    companion object {
        private const val TAG = "VoIPPrewarmService"
        const val EXTRA_CALL_ID    = "call_id"
        const val EXTRA_CALLER_ID  = "caller_id"
        const val EXTRA_CALL_TYPE  = "call_type"
        private const val PREFS    = "chatr_prewarm"
        private const val KEY_LAST = "last_prewarm_call_id"
        private const val TIMEOUT_MS = 30_000L // Shut down after 30s max

        fun start(context: Context, callId: String, callerId: String, callType: String) {
            val intent = Intent(context, VoIPPrewarmService::class.java).apply {
                putExtra(EXTRA_CALL_ID, callId)
                putExtra(EXTRA_CALLER_ID, callerId)
                putExtra(EXTRA_CALL_TYPE, callType)
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
                Log.i(TAG, "🔥 VoIPPrewarm requested for callId=$callId")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start prewarm service", e)
            }
        }
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Chatr::VoIPPrewarm")
        wakeLock?.acquire(TIMEOUT_MS)
        Log.i(TAG, "WakeLock acquired")
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel("Prewarm", "Prewarm", NotificationManager.IMPORTANCE_NONE)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
            val notif = NotificationCompat.Builder(this, "Prewarm")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .build()
            startForeground(9998, notif)
        }
        val callId   = intent?.getStringExtra(EXTRA_CALL_ID) ?: ""
        val callerId = intent?.getStringExtra(EXTRA_CALLER_ID) ?: ""
        val callType = intent?.getStringExtra(EXTRA_CALL_TYPE) ?: "voip"

        if (callId.isBlank()) {
            Log.w(TAG, "No callId — ignoring prewarm")
            stopSelf(startId)
            return START_NOT_STICKY
        }

        // Mark prewarm in SharedPrefs so MainActivity can read it on resume
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_LAST, callId)
            .putString("prewarm_caller_id", callerId)
            .putString("prewarm_call_type", callType)
            .putLong("prewarm_ts", System.currentTimeMillis())
            .apply()

        Log.i(TAG, "🔥 Prewarm started: callId=$callId caller=$callerId type=$callType")

        scope.launch {
            // Prewarm JWT immediately
            NativeAuthManager.getValidTokenAsync(applicationContext)

            // Allow a window for ICE gathering to complete via the WebView in MainActivity
            // After timeout, we clean up regardless
            delay(TIMEOUT_MS)
            Log.i(TAG, "⏱ Prewarm timeout reached for callId=$callId")
            stopSelf(startId)
        }

        return START_NOT_STICKY
    }

    override fun onDestroy() {
        scope.cancel()
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
                Log.i(TAG, "WakeLock released")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing WakeLock", e)
        }
        Log.i(TAG, "🛑 VoIPPrewarmService destroyed")
        super.onDestroy()
    }
}
