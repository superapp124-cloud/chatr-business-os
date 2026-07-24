package com.chatr.app.receivers

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.chatr.app.MainActivity
import com.chatr.app.R
import com.chatr.app.services.NotificationBranding

class CallReminderReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_CALL_BACK_REMINDER = "com.chatr.app.ACTION_CALL_BACK_REMINDER"

        private const val TAG = "CallReminderReceiver"
        private const val CHANNEL_ID = "call_reminders"
        private const val CHANNEL_NAME = "Call reminders"
        private const val NOTIFICATION_BASE_ID = 7000
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_CALL_BACK_REMINDER) return

        val callId = intent.getStringExtra("call_id") ?: return
        val callerName = intent.getStringExtra("caller_name").orEmpty()
        val callerPhone = intent.getStringExtra("caller_phone")
            ?: intent.getStringExtra("caller_number")
            ?: ""
        val conversationId = intent.getStringExtra("conversation_id").orEmpty()
        val callerLabel = callerName.ifBlank { callerPhone.ifBlank { "this caller" } }

        val notificationManager = context.getSystemService(NotificationManager::class.java) ?: return
        ensureChannel(notificationManager)

        val destinationPath = if (conversationId.isNotBlank()) {
            "/chat/$conversationId"
        } else {
            "/call-history"
        }

        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("action", "mark_missed")
            putExtra("call_id", callId)
            putExtra("navigate_to", destinationPath)
        }
        val openPendingIntent = PendingIntent.getActivity(
            context,
            stableRequestCode("open-$callId"),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(NotificationBranding.SMALL_ICON)
            .setLargeIcon(NotificationBranding.largeIcon(context))
            .setContentTitle("Call back reminder")
            .setContentText(callerLabel)
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText("You asked to be reminded to call back $callerLabel.")
            )
            .setContentIntent(openPendingIntent)
            .addAction(R.drawable.ic_message, "Message", openPendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()

        notificationManager.notify(NOTIFICATION_BASE_ID + (stableRequestCode(callId) % 100_000), notification)
        Log.i(TAG, "Displayed callback reminder for $callId")
    }

    private fun ensureChannel(notificationManager: NotificationManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val existing = notificationManager.getNotificationChannel(CHANNEL_ID)
        if (existing != null) return

        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Reminders to return missed Chatr calls"
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        }

        notificationManager.createNotificationChannel(channel)
    }

    private fun stableRequestCode(seed: String): Int {
        return seed.hashCode().let { if (it == Int.MIN_VALUE) 0 else kotlin.math.abs(it) }
    }
}
