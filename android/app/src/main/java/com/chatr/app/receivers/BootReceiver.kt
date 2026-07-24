package com.chatr.app.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.chatr.app.nativecalls.NativeCallSyncWorker
import com.chatr.app.services.BackgroundSyncService

/**
 * BOOT RECEIVER
 * 
 * Ensures Chatr+ services restart after device reboot.
 * Critical for maintaining push notification reliability.
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return

        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            Intent.ACTION_LOCKED_BOOT_COMPLETED -> {
                Log.i(TAG, "📱 Device booted - initializing Chatr+ services")
                
                // Trigger background sync
                val syncIntent = Intent(context, BackgroundSyncService::class.java).apply {
                    action = BackgroundSyncService.ACTION_SYNC_ALL
                }
                
                try {
                    context.startForegroundService(syncIntent)
                    NativeCallSyncWorker.enqueue(context, "boot_completed", delaySeconds = 10)
                    Log.i(TAG, "✅ Background sync triggered")
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Failed to start sync service", e)
                }
            }
        }
    }
}
