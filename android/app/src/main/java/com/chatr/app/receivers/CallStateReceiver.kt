package com.chatr.app.receivers

import android.os.Build

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.chatr.app.services.IncomingCallOverlayService
import com.chatr.app.services.InCallOverlayService
import com.chatr.app.services.NotificationBranding
import com.chatr.app.MainActivity
import com.chatr.app.R
import com.chatr.app.PostCallSummaryActivity
import com.chatr.app.nativecalls.NativeCallEvent
import com.chatr.app.nativecalls.NativeCallRepository
import com.chatr.app.nativecalls.NativeCallSyncWorker
import com.chatr.app.nativecalls.NativeGsmDefenseEngine
import com.chatr.app.nativecalls.NativePhoneNormalizer
import com.chatr.app.nativecalls.SupabaseNativeCallClient
import org.json.JSONObject
import com.chatr.app.services.ChatrVoipCallRegistry
import com.chatr.app.services.CallSummaryEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class CallStateReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return

        val stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
        val incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)
        val pending = goAsync()

        Thread {
            try {
                handlePhoneState(context.applicationContext, stateStr, incomingNumber)
            } finally {
                pending.finish()
            }
        }.start()
    }

    private fun handlePhoneState(context: Context, stateStr: String?, incomingNumber: String?) {
        Log.d(TAG, "Phone state changed: $stateStr (Number: $incomingNumber)")

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val lastState = prefs.getString(KEY_LAST_STATE, TelephonyManager.EXTRA_STATE_IDLE)
        val storedNumber = prefs.getString(KEY_ACTIVE_NUMBER, null)
        val hasNewIncomingNumber =
            !incomingNumber.isNullOrBlank() && incomingNumber != storedNumber

        if (stateStr == lastState && !(stateStr == TelephonyManager.EXTRA_STATE_RINGING && hasNewIncomingNumber)) {
            return
        }

        prefs.edit().putString(KEY_LAST_STATE, stateStr ?: TelephonyManager.EXTRA_STATE_IDLE).apply()

        val phoneNumber = incomingNumber?.takeIf { it.isNotBlank() } ?: storedNumber

        @Suppress("DEPRECATION")
        when (stateStr) {
            TelephonyManager.EXTRA_STATE_RINGING -> {
                val displayNumber = incomingNumber?.takeIf { it.isNotBlank() } ?: storedNumber
                if (ChatrVoipCallRegistry.hasRecentIncoming(context)) {
                    Log.i(TAG, "Suppressing GSM Caller ID overlay while Chatr VoIP call is ringing.")
                    return
                }
                if (displayNumber.isNullOrBlank()) {
                    Log.i(TAG, "Suppressing GSM Caller ID overlay because Android did not provide a GSM number.")
                    return
                }
                Log.i(TAG, "Incoming call ringing. Starting Caller ID overlay for: $displayNumber")
                startOverlayService(context, displayNumber)

                if (!incomingNumber.isNullOrBlank()) {
                    val normalized = NativePhoneNormalizer.normalize(incomingNumber)
                    if (normalized.isNotBlank()) {
                        val eventId = prefs.getString(KEY_ACTIVE_EVENT_ID, null)
                            ?: "phone:$normalized:${System.currentTimeMillis()}"
                        val startedAt = prefs.getLong(KEY_ACTIVE_STARTED_AT, System.currentTimeMillis())
                        prefs.edit()
                            .putString(KEY_ACTIVE_EVENT_ID, eventId)
                            .putString(KEY_ACTIVE_NUMBER, incomingNumber)
                            .putLong(KEY_ACTIVE_STARTED_AT, startedAt)
                            .putBoolean(KEY_WAS_OFFHOOK, false)
                            .apply()

                        recordPhoneStateEvent(
                            context = context,
                            deviceEventId = eventId,
                            rawNumber = incomingNumber,
                            status = "ringing",
                            direction = "incoming",
                            startedAt = startedAt,
                            endedAt = null,
                            durationSeconds = 0,
                        )
                    }
                }
            }
            TelephonyManager.EXTRA_STATE_OFFHOOK -> {
                Log.i(TAG, "Call answered. Stopping Caller ID overlay.")
                prefs.edit().putBoolean(KEY_WAS_OFFHOOK, true).apply()

                stopOverlayService(context)

                if (ChatrVoipCallRegistry.hasRecentIncoming(context)) {
                    Log.i(TAG, "Suppressing GSM AI overlay because a Chatr VoIP call is active.")
                    return
                }

                val eventId = prefs.getString(KEY_ACTIVE_EVENT_ID, null)
                if (!eventId.isNullOrBlank() && !phoneNumber.isNullOrBlank()) {
                    recordPhoneStateEvent(
                        context = context,
                        deviceEventId = eventId,
                        rawNumber = phoneNumber,
                        status = "active",
                        direction = "incoming",
                        startedAt = prefs.getLong(KEY_ACTIVE_STARTED_AT, System.currentTimeMillis()),
                        endedAt = null,
                        durationSeconds = 0,
                    )
                }

                // Start the CHATR AI GSM Layer overlay for active call
                val activeNum = phoneNumber ?: "Unknown"
                InCallOverlayService.start(context, activeNum)
            }
            TelephonyManager.EXTRA_STATE_IDLE -> {
                Log.i(TAG, "Call ended. Stopping Caller ID overlay and syncing call log.")
                stopOverlayService(context)
                InCallOverlayService.stop(context)

                if (ChatrVoipCallRegistry.hasRecentIncoming(context)) {
                    return
                }

                val eventId = prefs.getString(KEY_ACTIVE_EVENT_ID, null)
                val wasOffhook = prefs.getBoolean(KEY_WAS_OFFHOOK, false)
                val startedAt = prefs.getLong(KEY_ACTIVE_STARTED_AT, System.currentTimeMillis())
                val endedAt = System.currentTimeMillis()
                val status = if (wasOffhook) "completed" else "missed"

                if (!eventId.isNullOrBlank() && !phoneNumber.isNullOrBlank()) {
                    recordPhoneStateEvent(
                        context = context,
                        deviceEventId = eventId,
                        rawNumber = phoneNumber,
                        status = status,
                        direction = "incoming",
                        startedAt = startedAt,
                        endedAt = endedAt,
                        durationSeconds = if (wasOffhook) ((endedAt - startedAt) / 1000).coerceAtLeast(0) else 0,
                    )
                    
                    // Generate AI Call Summary (Phase 4)
                    if (status == "completed") {
                        val duration = (endedAt - startedAt) / 1000
                        CoroutineScope(Dispatchers.IO).launch {
                            try {
                                val engine = CallSummaryEngine()
                                val callNotes = prefs.getString("active_notes", "") ?: ""
                                val summary = engine.generateCallSummary(
                                    phoneNumber = phoneNumber,
                                    contactName = null, // Can map to local contacts if needed
                                    durationSeconds = duration,
                                    callNotes = callNotes
                                )
                                CallSummaryEngine.saveSummary(context, summary)
                                SupabaseNativeCallClient(context).syncAiSummary(summary)
                                Log.i(TAG, "AI Summary generated and saved for $phoneNumber")
                                
                                // Launch sleek popup UI
                                withContext(Dispatchers.Main) {
                                    PostCallSummaryActivity.start(
                                        context,
                                        phone = summary.phoneNumber,
                                        summary = summary.summary,
                                        keyPoints = summary.keyPoints,
                                        actionItems = summary.actionItems + summary.calendarEvents.map { "Event: ${it.title} on ${it.date}" }
                                    )
                                }
                            } catch (e: Exception) {
                                Log.e(TAG, "Failed to generate AI summary", e)
                            }
                        }
                    }
                    showPostCallNotification(context, phoneNumber, status)
                }

                prefs.edit()
                    .remove(KEY_ACTIVE_EVENT_ID)
                    .remove(KEY_ACTIVE_NUMBER)
                    .remove(KEY_ACTIVE_STARTED_AT)
                    .remove(KEY_WAS_OFFHOOK)
                    .remove("active_notes")
                    .apply()

                NativeCallSyncWorker.enqueue(context, "phone_state_idle", delaySeconds = 3)
            }
        }
    }

    private fun startOverlayService(context: Context, phoneNumber: String) {
        val startIntent = Intent(context, IncomingCallOverlayService::class.java).apply {
            putExtra("phone_number", phoneNumber)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(startIntent)
        } else {
            context.startService(startIntent)
        }
    }

    private fun stopOverlayService(context: Context) {
        val stopIntent = Intent(context, IncomingCallOverlayService::class.java)
        context.stopService(stopIntent)
    }

    private fun recordPhoneStateEvent(
        context: Context,
        deviceEventId: String,
        rawNumber: String,
        status: String,
        direction: String,
        startedAt: Long,
        endedAt: Long?,
        durationSeconds: Long,
    ) {
        val normalized = NativePhoneNormalizer.normalize(rawNumber)
        if (normalized.isBlank()) return

        NativeGsmDefenseEngine.evaluateIncoming(
            context = context,
            rawNumber = rawNumber,
            status = status,
            source = "phone_state",
            deviceEventId = deviceEventId,
            direction = direction,
            startedAt = startedAt,
            endedAt = endedAt,
            durationSeconds = durationSeconds,
            allowLiveLookup = status == "ringing",
        )
    }

    private fun showPostCallNotification(context: Context, phoneNumber: String, status: String) {
        try {
            createPostCallChannel(context)
            val intent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra("show_post_call_ai", true)
                putExtra("phone_number", phoneNumber)
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                phoneNumber.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val title = if (status == "missed") "Missed call captured" else "Call captured"
            val notification = NotificationCompat.Builder(context, CHANNEL_POST_CALL)
                .setSmallIcon(NotificationBranding.SMALL_ICON)
                .setLargeIcon(NotificationBranding.largeIcon(context))
                .setContentTitle(title)
                .setContentText("ChatrCalls saved caller intelligence for $phoneNumber")
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .build()

            context.getSystemService(NotificationManager::class.java)
                ?.notify(NOTIF_POST_CALL_BASE + kotlin.math.abs(phoneNumber.hashCode() % 10000), notification)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to show post-call notification", e)
        }
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

    companion object {
        private const val TAG = "CallStateReceiver"
        private const val PREFS_NAME = "chatr_native_call_capture"
        private const val KEY_LAST_STATE = "last_state"
        private const val KEY_ACTIVE_EVENT_ID = "active_event_id"
        private const val KEY_ACTIVE_NUMBER = "active_number"
        private const val KEY_ACTIVE_STARTED_AT = "active_started_at"
        private const val KEY_WAS_OFFHOOK = "was_offhook"
        private const val CHANNEL_POST_CALL = "chatr_post_call_insights"
        private const val NOTIF_POST_CALL_BASE = 9100
    }
}
