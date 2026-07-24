package com.chatr.app.services

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.telecom.TelecomManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.chatr.app.ChatrApplication
import com.chatr.app.MainActivity
import com.chatr.app.R

/**
 * CALL FOREGROUND SERVICE
 * 
 * Keeps the app alive during active calls.
 * Required for Android 8.0+ to maintain background execution.
 */
class CallForegroundService : Service() {
    private var activeCallId: String? = null

    companion object {
        private const val TAG = "CallForegroundService"
        const val NOTIFICATION_ID = 3001
        
        const val ACTION_START = "com.chatr.app.action.START_CALL_SERVICE"
        const val ACTION_STOP = "com.chatr.app.action.STOP_CALL_SERVICE"
        const val ACTION_RELEASE_IF_IDLE = "com.chatr.app.action.RELEASE_CALL_SERVICE_IF_IDLE"

        private const val EXTRA_REASON = "reason"

        fun releaseIfNoActiveCall(context: Context, reason: String) {
            val intent = Intent(context, CallForegroundService::class.java).apply {
                action = ACTION_RELEASE_IF_IDLE
                putExtra(EXTRA_REASON, reason)
            }
            try {
                context.startService(intent)
            } catch (error: IllegalStateException) {
                Log.w(TAG, "Could not request call foreground release ($reason)", error)
            }
        }

        fun clearStaleNotificationIfTelecomIdle(context: Context, reason: String) {
            if (ChatrConnectionService.hasActiveConnections()) {
                Log.i(TAG, "Keeping call notification; CHATR call still active ($reason)")
                return
            }

            if (isTelecomBusy(context, reason)) {
                Log.i(TAG, "Keeping call notification; Android Telecom is busy ($reason)")
                return
            }

            Log.i(TAG, "Clearing stale call notification ($reason)")
            val notificationManager = context.getSystemService(NotificationManager::class.java)
            notificationManager?.cancel(NOTIFICATION_ID)
            val appContext = context.applicationContext
            val stopped = appContext.stopService(Intent(appContext, CallForegroundService::class.java))
            if (stopped) {
                Log.i(TAG, "Stopped stale call foreground service ($reason)")
            }
        }

        private fun isTelecomBusy(context: Context, reason: String): Boolean {
            val telecomManager = context.getSystemService(TelecomManager::class.java)
            if (telecomManager == null) {
                Log.w(TAG, "Cannot inspect TelecomManager; preserving call notification ($reason)")
                return true
            }

            return try {
                telecomManager.isInCall
            } catch (error: SecurityException) {
                Log.w(TAG, "No permission to inspect Telecom state; preserving call notification ($reason)", error)
                true
            } catch (error: RuntimeException) {
                Log.w(TAG, "Could not inspect Telecom state; preserving call notification ($reason)", error)
                true
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                activeCallId = intent.getStringExtra("call_id")
                val callType = intent.getStringExtra("call_type") ?: "audio"
                val partnerName = intent.getStringExtra("partner_name") ?: "Active Call"
                startForegroundWithNotification(callType, partnerName, activeCallId)
            }
            ACTION_STOP -> {
                val callId = intent.getStringExtra("call_id") ?: activeCallId
                if (!callId.isNullOrBlank()) {
                    val endIntent = Intent(this, MainActivity::class.java).apply {
                        this.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        putExtra("action", "end_call")
                        putExtra("call_id", callId)
                    }
                    startActivity(endIntent)
                }
                releaseForegroundIfIdle("stop_requested")
            }
            ACTION_RELEASE_IF_IDLE -> {
                val reason = intent.getStringExtra(EXTRA_REASON) ?: "unknown"
                releaseForegroundIfIdle(reason)
            }
        }
        
        return START_NOT_STICKY
    }

    private fun releaseForegroundIfIdle(reason: String) {
        if (ChatrConnectionService.hasActiveConnections()) {
            Log.i(TAG, "Keeping call foreground service; CHATR call still active ($reason)")
            return
        }

        Log.i(TAG, "Releasing call foreground service ($reason)")
        activeCallId = null
        removeForegroundNotification()
        stopSelf()
    }

    private fun removeForegroundNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }

        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager?.cancel(NOTIFICATION_ID)
    }

    private fun startForegroundWithNotification(callType: String, partnerName: String, callId: String?) {
        Log.i(TAG, "🔔 Starting call foreground service: $partnerName ($callType)")

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val endCallIntent = Intent(this, CallForegroundService::class.java).apply {
            action = ACTION_STOP
            if (!callId.isNullOrBlank()) {
                putExtra("call_id", callId)
            }
        }
        val endCallPendingIntent = PendingIntent.getService(
            this, 1, endCallIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val callTypeEmoji = if (callType == "video") "📹" else "📞"
        
        val notification = NotificationCompat.Builder(this, ChatrApplication.CHANNEL_FOREGROUND)
            .setSmallIcon(NotificationBranding.SMALL_ICON)
            .setLargeIcon(NotificationBranding.largeIcon(this))
            .setContentTitle("$callTypeEmoji ${if (callType == "video") "Video" else "Voice"} Call")
            .setContentText("In call with $partnerName")
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setContentIntent(pendingIntent)
            .addAction(R.drawable.ic_call_end, "End Call", endCallPendingIntent)
            .setUsesChronometer(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
            } else {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
            }
            startForeground(NOTIFICATION_ID, notification, type)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    override fun onDestroy() {
        if (!ChatrConnectionService.hasActiveConnections()) {
            removeForegroundNotification()
        }
        Log.i(TAG, "🔕 Call foreground service stopped")
        super.onDestroy()
    }
}
