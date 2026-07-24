package com.chatr.app.plugins

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.telecom.TelecomManager
import android.telecom.Call
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import android.util.Log

/**
 * TelecomInterceptorPlugin
 *
 * Capacitor bridge giving the web layer read/control access to the Android Telecom stack.
 * Used by the GSM overlay UI to show live call info and allow the web to mute/hold.
 *
 * Requires READ_PHONE_STATE (already declared in manifest).
 *
 * JS usage:
 *   const { TelecomInterceptor } = Plugins;
 *   const state = await TelecomInterceptor.getCallState();
 */
@CapacitorPlugin(
    name = "TelecomInterceptor",
    permissions = [
        Permission(strings = [Manifest.permission.READ_PHONE_STATE], alias = "phone")
    ]
)
class TelecomInterceptorPlugin : Plugin() {

    companion object {
        private const val TAG = "TelecomInterceptor"
    }

    @PluginMethod
    fun getCallState(call: PluginCall) {
        val hasPermission = ContextCompat.checkSelfPermission(
            context, Manifest.permission.READ_PHONE_STATE
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasPermission) {
            requestPermissionForAlias("phone", call, "callStatePermissionCallback")
            return
        }

        resolveCallState(call)
    }

    @com.getcapacitor.annotation.PermissionCallback
    private fun callStatePermissionCallback(call: PluginCall) {
        val granted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.READ_PHONE_STATE
        ) == PackageManager.PERMISSION_GRANTED
        if (granted) resolveCallState(call) else call.reject("READ_PHONE_STATE denied")
    }

    private fun resolveCallState(call: PluginCall) {
        try {
            val tm = context.getSystemService(TelecomManager::class.java)
            val isInCall = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                tm?.isInCall ?: false
            } else {
                @Suppress("DEPRECATION")
                tm?.isInCall ?: false
            }
            val result = JSObject().apply {
                put("isInCall", isInCall)
                put("isMuted", false)
            }
            call.resolve(result)
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException reading call state", e)
            call.reject("Permission denied by system")
        } catch (e: Exception) {
            Log.e(TAG, "Error reading call state", e)
            call.reject(e.message ?: "Unknown error")
        }
    }

    @PluginMethod
    fun isDefaultDialer(call: PluginCall) {
        val tm = context.getSystemService(TelecomManager::class.java)
        val isDefault = tm?.defaultDialerPackage == context.packageName
        call.resolve(JSObject().apply { put("isDefault", isDefault) })
    }

    @PluginMethod
    fun isDefaultSmsApp(call: PluginCall) {
        val tm = context.getSystemService(TelecomManager::class.java)
        val isDefault = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            android.provider.Telephony.Sms.getDefaultSmsPackage(context) == context.packageName
        } else {
            false
        }
        call.resolve(JSObject().apply { put("isDefault", isDefault) })
    }

    @PluginMethod
    fun getPhoneAccountStatus(call: PluginCall) {
        try {
            val tm = context.getSystemService(TelecomManager::class.java)
            val accounts = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
                ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE)
                == PackageManager.PERMISSION_GRANTED) {
                tm?.callCapablePhoneAccounts?.size ?: 0
            } else { 0 }

            call.resolve(JSObject().apply {
                put("registeredAccounts", accounts)
                put("isInCall", tm?.isInCall ?: false)
            })
        } catch (e: Exception) {
            call.reject(e.message ?: "Error")
        }
    }
}
