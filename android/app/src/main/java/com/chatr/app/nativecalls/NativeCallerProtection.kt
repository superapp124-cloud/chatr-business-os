package com.chatr.app.nativecalls

import android.Manifest
import android.app.Activity
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.telecom.TelecomManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject

object NativeCallerProtection {
    private const val REQUEST_NATIVE_CALL_PERMISSIONS = 12040
    private const val REQUEST_CALL_SCREENING_ROLE = 12041
    private const val REQUEST_DEFAULT_DIALER_ROLE = 12042
    private const val REQUEST_CALL_REDIRECTION_ROLE = 12043

    fun statusJson(context: Context): JSONObject {
        val appContext = context.applicationContext
        val roleManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appContext.getSystemService(RoleManager::class.java)
        } else {
            null
        }
        val callScreeningHeld = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            roleManager?.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) == true &&
                roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)
        } else {
            true
        }
        val callRedirectionHeld = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            roleManager?.isRoleAvailable(RoleManager.ROLE_CALL_REDIRECTION) == true &&
                roleManager.isRoleHeld(RoleManager.ROLE_CALL_REDIRECTION)
        } else {
            false
        }

        val telecom = appContext.getSystemService(TelecomManager::class.java)
        val isDefaultDialer = telecom?.defaultDialerPackage == appContext.packageName
        val overlayGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(appContext)
        val stats = NativeCallRepository.getInstance(appContext).statsJson()
        val nativeCaptureReady =
            hasPermission(appContext, Manifest.permission.READ_PHONE_STATE) &&
                hasPermission(appContext, Manifest.permission.READ_CALL_LOG)
        val callerIdReady = overlayGranted && callScreeningHeld
        val incomingGsmReady = nativeCaptureReady && callerIdReady
        val outgoingGsmReady = nativeCaptureReady && (callRedirectionHeld || isDefaultDialer)

        return JSONObject().apply {
            put("readPhoneState", hasPermission(appContext, Manifest.permission.READ_PHONE_STATE))
            put("readCallLog", hasPermission(appContext, Manifest.permission.READ_CALL_LOG))
            put("readContacts", hasPermission(appContext, Manifest.permission.READ_CONTACTS))
            put("postNotifications", Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || hasPermission(appContext, Manifest.permission.POST_NOTIFICATIONS))
            put("overlay", overlayGranted)
            put("callScreeningRole", callScreeningHeld)
            put("callRedirectionRole", callRedirectionHeld)
            put("defaultDialer", isDefaultDialer)
            put("nativeCaptureReady", nativeCaptureReady)
            put("callerIdReady", callerIdReady)
            put("incomingGsmReady", incomingGsmReady)
            put("outgoingGsmReady", outgoingGsmReady)
            put("fullGsmCoverageReady", incomingGsmReady && outgoingGsmReady)
            put("gsmDefenseReady", nativeCaptureReady && overlayGranted)
            put("gsmDefenses", NativeGsmDefenseEngine.stateJson(appContext))
            put("stats", stats)
        }
    }

    fun requestSetup(activity: Activity) {
        val missingPermissions = runtimePermissions().filter {
            ContextCompat.checkSelfPermission(activity, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missingPermissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(
                activity,
                missingPermissions.toTypedArray(),
                REQUEST_NATIVE_CALL_PERMISSIONS,
            )
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = activity.getSystemService(RoleManager::class.java)
            if (
                roleManager?.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) == true &&
                !roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)
            ) {
                activity.startActivityForResult(
                    roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING),
                    REQUEST_CALL_SCREENING_ROLE,
                )
                return
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(activity)) {
            activity.startActivity(
                Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${activity.packageName}"),
                )
            )
            return
        }

        if (requestCallRedirection(activity)) {
            return
        }

        if (statusJson(activity).optBoolean("outgoingGsmReady")) {
            return
        }

        requestDefaultDialer(activity)
    }

    fun requestCallRedirection(activity: Activity): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false

        val roleManager = activity.getSystemService(RoleManager::class.java)
        if (
            roleManager?.isRoleAvailable(RoleManager.ROLE_CALL_REDIRECTION) == true &&
            !roleManager.isRoleHeld(RoleManager.ROLE_CALL_REDIRECTION)
        ) {
            activity.startActivityForResult(
                roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_REDIRECTION),
                REQUEST_CALL_REDIRECTION_ROLE,
            )
            return true
        }

        return false
    }

    fun requestDefaultDialer(activity: Activity) {
        val telecom = activity.getSystemService(TelecomManager::class.java)
        if (telecom?.defaultDialerPackage == activity.packageName) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = activity.getSystemService(RoleManager::class.java)
            if (
                roleManager?.isRoleAvailable(RoleManager.ROLE_DIALER) == true &&
                !roleManager.isRoleHeld(RoleManager.ROLE_DIALER)
            ) {
                activity.startActivityForResult(
                    roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER),
                    REQUEST_DEFAULT_DIALER_ROLE,
                )
            }
            return
        }

        @Suppress("DEPRECATION")
        activity.startActivity(
            Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER).apply {
                putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, activity.packageName)
            },
        )
    }

    fun openDefaultAppsSettings(activity: Activity) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                activity.startActivity(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS))
            } else {
                activity.startActivity(Intent(Settings.ACTION_SETTINGS))
            }
        } catch (_: Exception) {
            activity.startActivity(Intent(Settings.ACTION_SETTINGS))
        }
    }

    private fun runtimePermissions(): List<String> {
        val permissions = mutableListOf(
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.CALL_PHONE,
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            permissions.add(Manifest.permission.ANSWER_PHONE_CALLS)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        return permissions
    }

    private fun hasPermission(context: Context, permission: String): Boolean {
        return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
    }
}
