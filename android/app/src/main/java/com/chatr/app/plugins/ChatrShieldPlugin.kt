package com.chatr.app.plugins

import android.app.Activity
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.telecom.TelecomManager
import com.chatr.app.nativecalls.NativeCallerProtection
import com.chatr.app.nativecalls.NativeGsmDefenseEngine
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "ChatrShield")
class ChatrShieldPlugin : Plugin() {

    @PluginMethod
    fun getProtectionState(call: PluginCall) {
        call.resolve(JSObject(NativeCallerProtection.statusJson(context).toString()))
    }

    @PluginMethod
    fun requestCallScreeningRole(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = context.getSystemService(Context.ROLE_SERVICE) as RoleManager
            if (roleManager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) &&
                !roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) {
                val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)
                startActivityForResult(call, intent, "callScreeningRoleResult")
            } else {
                call.resolve()
            }
        } else {
            call.reject("Call Screening Role requires Android 10+")
        }
    }

    @ActivityCallback
    private fun callScreeningRoleResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode == Activity.RESULT_OK) {
            call.resolve()
        } else {
            call.reject("Role request denied")
        }
    }

    @PluginMethod
    fun requestDefaultDialerRole(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = context.getSystemService(Context.ROLE_SERVICE) as RoleManager
            if (roleManager.isRoleAvailable(RoleManager.ROLE_DIALER) &&
                !roleManager.isRoleHeld(RoleManager.ROLE_DIALER)) {
                val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER)
                startActivityForResult(call, intent, "defaultDialerRoleResult")
            } else {
                call.resolve()
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER)
            intent.putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, context.packageName)
            startActivityForResult(call, intent, "defaultDialerRoleResult")
        } else {
            call.resolve()
        }
    }

    @ActivityCallback
    private fun defaultDialerRoleResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode == Activity.RESULT_OK) {
            call.resolve()
        } else {
            call.reject("Role request denied")
        }
    }

    @PluginMethod
    fun setDefenseFeature(call: PluginCall) {
        val feature = call.getString("feature")
        if (feature.isNullOrBlank()) {
            call.reject("feature is required")
            return
        }
        val enabled = call.getBoolean("enabled", true) ?: true
        NativeGsmDefenseEngine.setFeature(context, feature, enabled)
        getProtectionState(call)
    }
}
