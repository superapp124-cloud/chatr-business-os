package com.chatr.app.plugins

import android.Manifest
import android.app.role.RoleManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telecom.TelecomManager
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import android.util.Log
import androidx.activity.result.ActivityResult
import android.app.Activity

/**
 * ChatrCallScreeningPlugin
 *
 * Capacitor bridge for the web layer to:
 *   1. Request the ROLE_CALL_SCREENING system role
 *   2. Query if screening is active
 *   3. Set allow/reject decisions from the web UI
 *
 * Pairs with ChatrCallScreeningService (native InCallService layer).
 *
 * JS usage:
 *   const { ChatrCallScreening } = Plugins;
 *   await ChatrCallScreening.requestScreeningRole();
 *   const { active } = await ChatrCallScreening.isScreeningActive();
 */
@CapacitorPlugin(
    name = "ChatrCallScreening",
    permissions = [
        Permission(strings = [Manifest.permission.READ_PHONE_STATE], alias = "phone")
    ]
)
class ChatrCallScreeningPlugin : Plugin() {

    companion object {
        private const val TAG = "ChatrCallScreeningPlugin"
        private const val PREFS = "chatr_screening"
        private const val KEY_ACTIVE = "screening_active"
        private const val KEY_LAST_VERDICT = "last_verdict"
    }

    @PluginMethod
    fun requestScreeningRole(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = context.getSystemService(Context.ROLE_SERVICE) as? RoleManager
            if (roleManager == null) {
                call.reject("RoleManager not available")
                return
            }
            if (roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) {
                call.resolve(JSObject().apply { put("held", true) })
                return
            }
            val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)
            startActivityForResult(call, intent, "screeningRoleResult")
        } else {
            call.reject("Call Screening Role requires Android 10+")
        }
    }

    @ActivityCallback
    private fun screeningRoleResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val granted = result.resultCode == Activity.RESULT_OK
        if (granted) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putBoolean(KEY_ACTIVE, true).apply()
        }
        call.resolve(JSObject().apply { put("granted", granted) })
    }

    @PluginMethod
    fun isScreeningActive(call: PluginCall) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val active = prefs.getBoolean(KEY_ACTIVE, false)

        // Also verify via RoleManager if API >= 29
        val roleHeld = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val rm = context.getSystemService(Context.ROLE_SERVICE) as? RoleManager
            rm?.isRoleHeld(RoleManager.ROLE_CALL_SCREENING) ?: false
        } else false

        call.resolve(JSObject().apply {
            put("active", active || roleHeld)
            put("roleHeld", roleHeld)
        })
    }

    @PluginMethod
    fun setScreeningEnabled(call: PluginCall) {
        val enabled = call.getBoolean("enabled", true) ?: true
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_ACTIVE, enabled).apply()
        Log.i(TAG, "🔒 Screening enabled=$enabled")
        call.resolve()
    }

    @PluginMethod
    fun getLastScreeningVerdict(call: PluginCall) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val verdict = prefs.getString(KEY_LAST_VERDICT, "none") ?: "none"
        call.resolve(JSObject().apply { put("verdict", verdict) })
    }

    @PluginMethod
    fun setScreeningVerdict(call: PluginCall) {
        val verdict = call.getString("verdict", "allow") ?: "allow"
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_LAST_VERDICT, verdict).apply()

        // Broadcast to ChatrCallScreeningService if it's running
        val intent = android.content.Intent("com.chatr.app.SCREENING_VERDICT")
        intent.putExtra("verdict", verdict)
        intent.setPackage(context.packageName)
        context.sendBroadcast(intent)

        call.resolve()
    }
}
