package com.chatr.app.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.chatr.app.MainActivity
import com.chatr.app.nativecalls.NativeGsmDefenseResult
import com.chatr.app.nativecalls.NativePhoneNormalizer
import kotlin.math.abs

object MissedCallInsightNotifier {
    private const val TAG = "MissedCallInsight"
    private const val CHANNEL_POST_CALL = "chatr_post_call_insights"
    private const val NOTIF_POST_CALL_BASE = 9100
    private const val PREFS_NAME = "chatr_missed_call_insights"
    private const val KEY_LAST_PREFIX = "last_posted_"
    private const val DEDUPE_WINDOW_MS = 90_000L

    fun generateAndNotify(
        context: Context,
        phoneNumber: String,
        contactName: String?,
        defenseResult: NativeGsmDefenseResult?,
        startedAt: Long,
        source: String,
    ): MissedCallInsight {
        val appContext = context.applicationContext
        val insight = MissedCallIntelligence.generate(
            context = appContext,
            phoneNumber = phoneNumber,
            contactName = contactName,
            defenseResult = defenseResult,
        )
        notifyIfNeeded(appContext, phoneNumber, insight, startedAt, source)
        return insight
    }

    fun notifyIfNeeded(
        context: Context,
        phoneNumber: String,
        insight: MissedCallInsight,
        startedAt: Long,
        source: String,
    ): Boolean {
        val appContext = context.applicationContext
        val normalized = NativePhoneNormalizer.normalize(phoneNumber).ifBlank { phoneNumber.trim() }
        if (normalized.isBlank()) return false
        if (wasRecentlyPosted(appContext, normalized, startedAt)) {
            Log.i(TAG, "Skipped duplicate missed-call insight for $normalized source=$source")
            return false
        }

        return try {
            createPostCallChannel(appContext)
            val intent = Intent(appContext, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra("show_post_call_ai", true)
                putExtra("phone_number", phoneNumber)
            }
            val pendingIntent = PendingIntent.getActivity(
                appContext,
                normalized.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val text = "${insight.title}: ${insight.body}"
            val notification = NotificationCompat.Builder(appContext, CHANNEL_POST_CALL)
                .setSmallIcon(NotificationBranding.SMALL_ICON)
                .setLargeIcon(NotificationBranding.largeIcon(appContext))
                .setContentTitle("Missed call intelligence")
                .setContentText(text)
                .setStyle(NotificationCompat.BigTextStyle().bigText(text))
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .build()

            appContext.getSystemService(NotificationManager::class.java)
                ?.notify(NOTIF_POST_CALL_BASE + abs(normalized.hashCode() % 10_000), notification)
            markPosted(appContext, normalized, startedAt)
            Log.i(TAG, "Posted missed-call intelligence for $normalized source=$source")
            true
        } catch (error: Exception) {
            Log.e(TAG, "Failed to show missed-call intelligence", error)
            false
        }
    }

    fun notifyCallCaptured(
        context: Context,
        phoneNumber: String,
        startedAt: Long = System.currentTimeMillis(),
        source: String = "unknown",
    ): Boolean {
        val appContext = context.applicationContext
        val normalized = NativePhoneNormalizer.normalize(phoneNumber).ifBlank { phoneNumber.trim() }
        if (normalized.isBlank()) return false
        if (wasRecentlyPosted(appContext, "captured:$normalized", startedAt)) {
            Log.i(TAG, "Skipped duplicate call-captured notification for $normalized source=$source")
            return false
        }

        try {
            createPostCallChannel(appContext)
            val intent = Intent(appContext, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra("show_post_call_ai", true)
                putExtra("phone_number", phoneNumber)
            }
            val pendingIntent = PendingIntent.getActivity(
                appContext,
                normalized.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val text = "Saved on this device. ChatrCalls will sync and reuse it next time."
            val notification = NotificationCompat.Builder(appContext, CHANNEL_POST_CALL)
                .setSmallIcon(NotificationBranding.SMALL_ICON)
                .setLargeIcon(NotificationBranding.largeIcon(appContext))
                .setContentTitle("Call saved")
                .setContentText(text)
                .setStyle(NotificationCompat.BigTextStyle().bigText(text))
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .build()

            appContext.getSystemService(NotificationManager::class.java)
                ?.notify(NOTIF_POST_CALL_BASE + abs(normalized.hashCode() % 10_000), notification)
            markPosted(appContext, "captured:$normalized", startedAt)
            Log.i(TAG, "Posted call-captured notification for $normalized source=$source")
            return true
        } catch (error: Exception) {
            Log.e(TAG, "Failed to show call-captured notification", error)
            return false
        }
    }

    private fun wasRecentlyPosted(context: Context, normalized: String, startedAt: Long): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val lastPostedAt = prefs.getLong(KEY_LAST_PREFIX + NativePhoneNormalizer.hash(normalized), 0L)
        val referenceTime = startedAt.takeIf { it > 0L } ?: System.currentTimeMillis()
        return lastPostedAt > 0L && abs(referenceTime - lastPostedAt) < DEDUPE_WINDOW_MS
    }

    private fun markPosted(context: Context, normalized: String, startedAt: Long) {
        val postedAt = startedAt.takeIf { it > 0L } ?: System.currentTimeMillis()
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_LAST_PREFIX + NativePhoneNormalizer.hash(normalized), postedAt)
            .apply()
    }

    private fun createPostCallChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            CHANNEL_POST_CALL,
            "ChatrCalls insights",
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = "Post-call caller ID and intelligence updates"
        }
        manager.createNotificationChannel(channel)
    }
}
