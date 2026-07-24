package com.chatr.app.telecom

import android.content.Context
import android.net.Uri
import android.os.Build
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.util.Log

/**
 * ChatrPhoneAccountManager
 *
 * Registers Chatr+ as a phone account with the Android Telecom stack.
 * This is required for:
 *   - Placing outgoing GSM calls via Chatr+
 *   - The system showing "via Chatr+" in the dialer
 *   - ChatrConnectionService receiving incoming call routing
 *
 * SAFE: Registration is idempotent. Re-registering an existing account is a no-op.
 * Called once from ChatrApplication.onCreate() after the user grants permissions.
 */
object ChatrPhoneAccountManager {

    private const val TAG = "ChatrPhoneAccountMgr"
    private const val ACCOUNT_ID = "chatr_voip_account"

    fun getHandle(context: Context): PhoneAccountHandle {
        val component = android.content.ComponentName(
            context.packageName,
            "com.chatr.app.services.ChatrConnectionService"
        )
        return PhoneAccountHandle(component, ACCOUNT_ID)
    }

    /**
     * Register the Chatr+ phone account with TelecomManager.
     * Safe to call multiple times — updates if already registered.
     */
    fun registerPhoneAccount(context: Context) {
        try {
            val telecomManager = context.getSystemService(TelecomManager::class.java)
                ?: run {
                    Log.e(TAG, "TelecomManager not available")
                    return
                }

            val handle = getHandle(context)

            val capabilities = PhoneAccount.CAPABILITY_CALL_PROVIDER or
                    PhoneAccount.CAPABILITY_CONNECTION_MANAGER

            val builder = PhoneAccount.builder(handle, "Chatr+")
                .setCapabilities(capabilities)
                .setIcon(android.graphics.drawable.Icon.createWithResource(
                    context, com.chatr.app.R.mipmap.ic_launcher
                ))
                .setSupportedUriSchemes(listOf(PhoneAccount.SCHEME_TEL, PhoneAccount.SCHEME_SIP))

            // Android 11+ supports short description
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                builder.setShortDescription("Chatr+ AI-powered calls")
            }

            telecomManager.registerPhoneAccount(builder.build())
            Log.i(TAG, "✅ Phone account registered: $ACCOUNT_ID")

        } catch (e: SecurityException) {
            // This is expected if MANAGE_OWN_CALLS permission is not yet granted
            Log.w(TAG, "⚠️ SecurityException registering phone account — permissions not granted yet")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to register phone account", e)
        }
    }

    /**
     * Check whether the Chatr+ phone account is currently registered and enabled.
     */
    fun isRegistered(context: Context): Boolean {
        return try {
            val telecomManager = context.getSystemService(TelecomManager::class.java) ?: return false
            val handle = getHandle(context)
            val account = telecomManager.getPhoneAccount(handle)
            val enabled = account?.isEnabled ?: false
            Log.d(TAG, "Phone account registered=$enabled")
            enabled
        } catch (e: SecurityException) {
            Log.w(TAG, "Cannot check phone account — permission denied")
            false
        } catch (e: Exception) {
            Log.e(TAG, "Error checking phone account", e)
            false
        }
    }

    /**
     * Unregister the Chatr+ phone account.
     * Call this on logout or when the user explicitly disconnects.
     */
    fun unregister(context: Context) {
        try {
            val telecomManager = context.getSystemService(TelecomManager::class.java) ?: return
            val handle = getHandle(context)
            telecomManager.unregisterPhoneAccount(handle)
            Log.i(TAG, "🗑️ Phone account unregistered")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to unregister phone account", e)
        }
    }
}
