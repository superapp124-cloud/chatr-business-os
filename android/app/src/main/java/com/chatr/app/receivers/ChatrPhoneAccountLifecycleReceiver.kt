package com.chatr.app.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.util.Log
import com.chatr.app.telecom.ChatrPhoneAccountManager

/**
 * ChatrPhoneAccountLifecycleReceiver — Tier 2
 *
 * Receives system broadcasts when phone accounts are registered or unregistered
 * on the device. Used to:
 *   1. Re-register the Chatr+ phone account if it was cleared (e.g. after OS upgrade)
 *   2. Log account state changes for debugging
 *   3. Notify the web layer that account status has changed
 *
 * Declared in manifest with:
 *   <receiver android:name=".receivers.ChatrPhoneAccountLifecycleReceiver" android:exported="true">
 *     <intent-filter>
 *       <action android:name="android.telecom.action.PHONE_ACCOUNT_REGISTERED"/>
 *       <action android:name="android.telecom.action.PHONE_ACCOUNT_UNREGISTERED"/>
 *     </intent-filter>
 *   </receiver>
 *
 * SAFETY: Always null-checks the account handle before acting — never crashes
 * on events about OTHER apps' phone accounts.
 */
class ChatrPhoneAccountLifecycleReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "PhoneAccountLifecycle"

        // These actions are available from API 26+
        const val ACTION_REGISTERED   = "android.telecom.action.PHONE_ACCOUNT_REGISTERED"
        const val ACTION_UNREGISTERED = "android.telecom.action.PHONE_ACCOUNT_UNREGISTERED"
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        // Safety: always guard against null context/intent
        if (context == null || intent == null) return

        val action = intent.action ?: return
        Log.d(TAG, "📞 PhoneAccount broadcast: action=$action")

        // Extract the PhoneAccountHandle from the intent extras
        val handle: PhoneAccountHandle? = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            intent.getParcelableExtra(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE)
        } else null

        // Only act on events about OUR phone account
        val ourHandle = ChatrPhoneAccountManager.getHandle(context)
        if (handle != null && handle.componentName != ourHandle.componentName) {
            Log.d(TAG, "Event is for a different app's account — ignoring")
            return
        }

        when (action) {
            ACTION_REGISTERED -> {
                Log.i(TAG, "✅ Chatr+ phone account registered/updated")
                notifyWebLayer(context, "registered")
            }
            ACTION_UNREGISTERED -> {
                Log.w(TAG, "⚠️ Chatr+ phone account unregistered — scheduling re-registration")
                notifyWebLayer(context, "unregistered")

                // Re-register after a short delay to handle OS-upgrade scenarios
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    ChatrPhoneAccountManager.registerPhoneAccount(context)
                }, 3000L)
            }
        }
    }

    private fun notifyWebLayer(context: Context, status: String) {
        // Write to SharedPreferences — the web layer reads this on next foreground
        context.getSharedPreferences("chatr_phone_account", Context.MODE_PRIVATE)
            .edit()
            .putString("account_status", status)
            .putLong("status_ts", System.currentTimeMillis())
            .apply()

        // Local broadcast for any in-process listener
        val broadcastIntent = Intent("com.chatr.app.PHONE_ACCOUNT_STATUS").apply {
            setPackage(context.packageName)
            putExtra("status", status)
        }
        context.sendBroadcast(broadcastIntent)
    }
}
