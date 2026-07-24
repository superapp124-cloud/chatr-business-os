package com.chatr.app.sos

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * SosAlarmReceiver
 *
 * Receives the alarm from SosRetryScheduler for time-delayed SOS retries.
 * Also handles the "Cancel SOS" action from the SOS notification.
 *
 * Registered in manifest with no intent-filter broadcast — only
 * called by explicit PendingIntent from SosRetryScheduler.
 */
class SosAlarmReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SosAlarmReceiver"

        const val ACTION_SOS_RETRY  = "com.chatr.app.SOS_RETRY"
        const val ACTION_SOS_CANCEL = "com.chatr.app.SOS_ALARM_CANCEL"
        const val EXTRA_NUMBER   = "alarm_number"
        const val EXTRA_MESSAGE  = "alarm_message"

        fun buildRetryPendingIntent(context: Context, number: String, message: String, requestCode: Int): PendingIntent {
            val intent = Intent(context, SosAlarmReceiver::class.java).apply {
                action = ACTION_SOS_RETRY
                putExtra(EXTRA_NUMBER, number)
                putExtra(EXTRA_MESSAGE, message)
            }
            return PendingIntent.getBroadcast(
                context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        context ?: return
        when (intent?.action) {
            ACTION_SOS_RETRY -> {
                val number  = intent.getStringExtra(EXTRA_NUMBER) ?: return
                val message = intent.getStringExtra(EXTRA_MESSAGE) ?: return
                Log.i(TAG, "⏰ SOS alarm fired — retrying SMS to $number")
                SosRetryScheduler.schedule(context, number, message)
            }
            ACTION_SOS_CANCEL -> {
                Log.i(TAG, "🚫 SOS cancelled via alarm receiver")
                SosService.cancel(context)
            }
            else -> {
                Log.w(TAG, "Unknown action: ${intent?.action}")
            }
        }
    }
}
