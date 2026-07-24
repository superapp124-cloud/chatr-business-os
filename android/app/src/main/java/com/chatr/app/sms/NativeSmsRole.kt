package com.chatr.app.sms

import android.Manifest
import android.app.Activity
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Telephony
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

object NativeSmsRole {
    const val REQUEST_SMS_PERMISSIONS = 12050
    const val REQUEST_DEFAULT_SMS_ROLE = 12051

    fun statusJson(context: Context): JSONObject {
        val appContext = context.applicationContext
        val roleManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appContext.getSystemService(RoleManager::class.java)
        } else {
            null
        }
        val defaultPackage = Telephony.Sms.getDefaultSmsPackage(appContext)
        val roleAvailable = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            roleManager?.isRoleAvailable(RoleManager.ROLE_SMS) == true
        } else {
            true
        }
        val roleHeld = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            roleAvailable && roleManager?.isRoleHeld(RoleManager.ROLE_SMS) == true
        } else {
            defaultPackage == appContext.packageName
        }
        val missing = runtimePermissions().filter { !hasPermission(appContext, it) }

        return JSONObject().apply {
            put("defaultSms", defaultPackage == appContext.packageName || roleHeld)
            put("defaultSmsPackage", defaultPackage ?: JSONObject.NULL)
            put("roleAvailable", roleAvailable)
            put("roleHeld", roleHeld)
            put("sendSms", hasPermission(appContext, Manifest.permission.SEND_SMS))
            put("receiveSms", hasPermission(appContext, Manifest.permission.RECEIVE_SMS))
            put("readSms", hasPermission(appContext, Manifest.permission.READ_SMS))
            put("postNotifications", Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || hasPermission(appContext, Manifest.permission.POST_NOTIFICATIONS))
            put("missingPermissions", JSONArray(missing))
            put("stats", NativeSmsRepository.getInstance(appContext).statsJson())
            put("eligibleManifestSurface", true)
        }
    }

    fun requestPermissions(activity: Activity) {
        val missing = runtimePermissions().filter { !hasPermission(activity, it) }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(
                activity,
                missing.toTypedArray(),
                REQUEST_SMS_PERMISSIONS,
            )
        }
    }

    fun requestDefaultSms(activity: Activity): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = activity.getSystemService(RoleManager::class.java)
            if (
                roleManager?.isRoleAvailable(RoleManager.ROLE_SMS) == true &&
                !roleManager.isRoleHeld(RoleManager.ROLE_SMS)
            ) {
                activity.startActivityForResult(
                    roleManager.createRequestRoleIntent(RoleManager.ROLE_SMS),
                    REQUEST_DEFAULT_SMS_ROLE,
                )
                return true
            }
            return false
        }

        val current = Telephony.Sms.getDefaultSmsPackage(activity)
        if (current == activity.packageName) return false
        @Suppress("DEPRECATION")
        activity.startActivityForResult(
            Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT).apply {
                putExtra(Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, activity.packageName)
            },
            REQUEST_DEFAULT_SMS_ROLE,
        )
        return true
    }

    private fun runtimePermissions(): List<String> {
        val permissions = mutableListOf(
            Manifest.permission.SEND_SMS,
            Manifest.permission.RECEIVE_SMS,
            Manifest.permission.READ_SMS,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        return permissions
    }

    private fun hasPermission(context: Context, permission: String): Boolean {
        return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
    }
}
