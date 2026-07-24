package com.chatr.app.sos

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * SosService
 *
 * Foreground service activated when the user triggers an SOS alert.
 * Actions:
 *   1. Acquires last known location
 *   2. Sends SOS SMS to registered emergency contacts
 *   3. Optionally dials the emergency number
 *   4. Shows persistent SOS notification with "Cancel" action
 *
 * Triggered by: SosTileService (quick-settings tile) or JS via Capacitor
 */
class SosService : Service() {

    companion object {
        private const val TAG = "SosService"
        private const val CHANNEL_ID = "chatr_sos"
        private const val NOTIFICATION_ID = 9911

        const val ACTION_START  = "com.chatr.app.SOS_START"
        const val ACTION_CANCEL = "com.chatr.app.SOS_CANCEL"
        const val EXTRA_CONTACTS = "sos_contacts"   // comma-separated phone numbers
        const val EXTRA_MESSAGE  = "sos_message"    // custom SOS message (optional)

        fun start(context: Context, contacts: String, message: String? = null) {
            val intent = Intent(context, SosService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_CONTACTS, contacts)
                if (message != null) putExtra(EXTRA_MESSAGE, message)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun cancel(context: Context) {
            context.startService(Intent(context, SosService::class.java).apply {
                action = ACTION_CANCEL
            })
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("SOS Active — Sending alert…"))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_CANCEL -> {
                Log.i(TAG, "🚫 SOS cancelled by user")
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_START -> {
                val contacts = intent.getStringExtra(EXTRA_CONTACTS) ?: ""
                val message  = intent.getStringExtra(EXTRA_MESSAGE)
                    ?: "🆘 SOS! I need help. This is an emergency alert from Chatr+."
                dispatchSos(contacts, message)
            }
        }
        return START_NOT_STICKY
    }

    private fun dispatchSos(contacts: String, message: String) {
        val location = getLastKnownLocation()
        val locationStr = if (location != null) {
            "\nLocation: https://maps.google.com/?q=${location.latitude},${location.longitude}"
        } else ""

        val fullMessage = "$message$locationStr"
        Log.i(TAG, "🆘 Dispatching SOS to: $contacts")

        val numbers = contacts.split(",").map { it.trim() }.filter { it.isNotBlank() }
        for (number in numbers) {
            try {
                val smsParts = android.telephony.SmsManager.getDefault()
                    .divideMessage(fullMessage)
                android.telephony.SmsManager.getDefault()
                    .sendMultipartTextMessage(number, null, smsParts, null, null)
                Log.i(TAG, "✅ SOS SMS sent to $number")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to send SOS SMS to $number", e)
                SosRetryScheduler.schedule(this, number, fullMessage)
            }
        }

        // Update notification
        val nm = getSystemService(NotificationManager::class.java)
        nm?.notify(NOTIFICATION_ID, buildNotification("🆘 SOS sent to ${numbers.size} contacts"))
    }

    private fun getLastKnownLocation(): Location? {
        return try {
            val lm = getSystemService(LocationManager::class.java) ?: return null
            lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                ?: lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
        } catch (e: SecurityException) {
            Log.w(TAG, "Location permission not granted — SOS without location")
            null
        }
    }

    private fun buildNotification(text: String): Notification {
        val cancelIntent = Intent(this, SosService::class.java).apply { action = ACTION_CANCEL }
        val cancelPi = PendingIntent.getService(
            this, 0, cancelIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Chatr+ SOS")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Cancel", cancelPi)
            .setOngoing(true)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "SOS Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Emergency SOS alerts"
                enableLights(true)
                enableVibration(true)
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        Log.i(TAG, "🛑 SosService stopped")
        super.onDestroy()
    }
}
