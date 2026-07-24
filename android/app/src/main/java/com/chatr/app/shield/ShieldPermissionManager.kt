package com.chatr.app.shield

import android.Manifest
import android.app.Activity
import android.app.AppOpsManager
import android.app.role.RoleManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.VpnService
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.telecom.TelecomManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale
import java.util.UUID
import java.util.concurrent.Executors

object ShieldPermissionManager {
    private const val PREFS_NAME = "chatr_shield_permissions"
    private const val KEY_REQUESTED_PREFIX = "requested_"

    private val persistExecutor = Executors.newSingleThreadExecutor()

    fun snapshot(context: Context): JSONObject {
        val cards = permissionCards(context)
        val granted = (0 until cards.length()).count {
            cards.getJSONObject(it).optString("state") == "granted"
        }
        val required = (0 until cards.length()).count {
            cards.getJSONObject(it).optBoolean("required", true)
        }
        val blocked = (0 until cards.length()).any {
            cards.getJSONObject(it).optString("state") in setOf("permanently_denied", "manufacturer_restricted")
        }
        val unavailable = (0 until cards.length()).any {
            cards.getJSONObject(it).optString("state") == "unavailable"
        }

        return JSONObject().apply {
            put("cards", cards)
            put("grantedCount", granted)
            put("requiredCount", required)
            put("setupProgress", if (required == 0) 1.0 else granted.toDouble() / required.toDouble())
            put("hasBlockedPermission", blocked)
            put("hasUnavailablePermission", unavailable)
            put("manufacturer", Build.MANUFACTURER ?: "unknown")
            put("batteryOptimizationIgnored", isBatteryOptimizationIgnored(context))
        }
    }

    fun markRuntimePermissionsRequested(context: Context, permissions: Collection<String>) {
        val editor = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
        permissions.forEach { editor.putBoolean(KEY_REQUESTED_PREFIX + it, true) }
        editor.apply()
    }

    fun permissionCards(context: Context): JSONArray {
        val array = JSONArray()
        val appContext = context.applicationContext

        array.put(runtimePermission(appContext, context, "read_contacts", Manifest.permission.READ_CONTACTS, "Contacts", "Allow contact trust graph checks.", "request_contacts"))
        array.put(runtimePermission(appContext, context, "read_phone_state", Manifest.permission.READ_PHONE_STATE, "Phone State", "Detect live carrier call state.", "request_call_permissions"))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            array.put(runtimePermission(appContext, context, "answer_phone_calls", Manifest.permission.ANSWER_PHONE_CALLS, "Answer Calls", "Let CHATR reject or silence risky calls.", "request_call_permissions"))
        } else {
            array.put(unavailable("answer_phone_calls", "Answer Calls", "Android 8.0 or newer is required.", "unavailable"))
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            array.put(runtimePermission(appContext, context, "post_notifications", Manifest.permission.POST_NOTIFICATIONS, "Notifications", "Show caller warnings and remediation alerts.", "request_notifications"))
        } else {
            array.put(granted("post_notifications", "Notifications", "Notification runtime permission is not required on this Android version.", "none"))
        }

        array.put(settingPermission("system_alert_window", "Overlay", overlayGranted(appContext), "Show caller ID and warning overlays.", "request_overlay"))
        array.put(callScreeningRole(appContext))
        array.put(callRedirectionRole(appContext))
        array.put(accessibilityPermission(appContext))
        array.put(vpnPermission(appContext))
        array.put(usageStatsPermission(appContext))

        persistSnapshot(appContext, array)
        return array
    }

    fun openAction(activity: Activity, actionKey: String?): Boolean {
        return when (actionKey) {
            "request_overlay" -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    activity.startActivity(
                        Intent(
                            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            android.net.Uri.parse("package:${activity.packageName}"),
                        ),
                    )
                    true
                } else {
                    false
                }
            }
            "request_accessibility" -> {
                activity.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                true
            }
            "request_usage_stats" -> {
                activity.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
                true
            }
            "request_battery" -> {
                activity.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
                true
            }
            "request_vpn" -> {
                val intent = VpnService.prepare(activity)
                if (intent != null) {
                    activity.startActivity(intent)
                } else {
                    activity.startService(Intent(activity, TrackerProtectionService::class.java))
                }
                true
            }
            else -> false
        }
    }

    private fun runtimePermission(
        appContext: Context,
        originalContext: Context,
        key: String,
        permission: String,
        title: String,
        detail: String,
        actionKey: String,
    ): JSONObject {
        val granted = ContextCompat.checkSelfPermission(appContext, permission) == PackageManager.PERMISSION_GRANTED
        val requested = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_REQUESTED_PREFIX + permission, false)
        val permanentlyDenied =
            !granted &&
                requested &&
                originalContext is Activity &&
                !ActivityCompat.shouldShowRequestPermissionRationale(originalContext, permission)

        return card(
            key = key,
            title = title,
            state = when {
                granted -> "granted"
                permanentlyDenied -> "permanently_denied"
                else -> "denied"
            },
            detail = detail,
            actionKey = actionKey,
            fix = when {
                granted -> "Verified"
                permanentlyDenied -> "Open Android app settings and allow $title."
                else -> "Grant $title permission."
            },
            required = true,
        )
    }

    private fun callScreeningRole(context: Context): JSONObject {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            return unavailable("call_screening_role", "Call Screening", "Android 7.0 or newer is required.", "unavailable")
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return card(
                key = "call_screening_role",
                title = "Call Screening",
                state = "denied",
                detail = "Select CHATR as the call screening app in Android default app settings.",
                actionKey = "request_default_apps",
                fix = "Open Default Apps and choose CHATR for call screening.",
                required = true,
            )
        }

        val roleManager = context.getSystemService(RoleManager::class.java)
        val available = roleManager?.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) == true
        val held = available && roleManager?.isRoleHeld(RoleManager.ROLE_CALL_SCREENING) == true
        return roleCard("call_screening_role", "Call Screening", available, held, "request_call_screening_role")
    }

    private fun callRedirectionRole(context: Context): JSONObject {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return unavailable("call_redirection_role", "Outgoing Shield", "Android 10 or newer is required for call redirection.", "unavailable")
        }
        val roleManager = context.getSystemService(RoleManager::class.java)
        val available = roleManager?.isRoleAvailable(RoleManager.ROLE_CALL_REDIRECTION) == true
        val held = available && roleManager?.isRoleHeld(RoleManager.ROLE_CALL_REDIRECTION) == true
        val defaultDialer = context.getSystemService(TelecomManager::class.java)?.defaultDialerPackage == context.packageName
        return roleCard(
            key = "call_redirection_role",
            title = "Outgoing Shield",
            available = available || defaultDialer,
            held = held || defaultDialer,
            actionKey = "request_call_redirection_role",
        )
    }

    private fun roleCard(key: String, title: String, available: Boolean, held: Boolean, actionKey: String): JSONObject {
        return when {
            !available -> unavailable(key, title, "$title is not available on this device build.", "unavailable")
            held -> granted(key, title, "$title role is held by CHATR.", actionKey)
            else -> card(
                key = key,
                title = title,
                state = "denied",
                detail = "$title is required before CHATR can protect calls through Android Telecom.",
                actionKey = actionKey,
                fix = "Grant the Android $title role.",
                required = true,
            )
        }
    }

    private fun accessibilityPermission(context: Context): JSONObject {
        val component = ComponentName(context, ChatrShieldAccessibilityService::class.java).flattenToString()
        val enabledServices = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
        ).orEmpty()
        val enabled = enabledServices.split(':').any {
            it.equals(component, ignoreCase = true) || it.contains(context.packageName, ignoreCase = true)
        }
        return settingPermission(
            key = "accessibility",
            title = "Accessibility",
            granted = enabled,
            detail = "Required only for optional on-screen scam prompts outside the dialer.",
            actionKey = "request_accessibility",
            required = false,
        )
    }

    private fun vpnPermission(context: Context): JSONObject {
        val prepared = VpnService.prepare(context) == null
        return settingPermission(
            key = "vpn",
            title = "VPN Tracker Filter",
            granted = prepared,
            detail = "Required before CHATR can run local DNS tracker filtering.",
            actionKey = "request_vpn",
            required = false,
        )
    }

    private fun usageStatsPermission(context: Context): JSONObject {
        val appOps = context.getSystemService(AppOpsManager::class.java)
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps?.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                context.packageName,
            )
        } else {
            @Suppress("DEPRECATION")
            appOps?.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                context.packageName,
            )
        }
        return settingPermission(
            key = "usage_stats",
            title = "Usage Stats",
            granted = mode == AppOpsManager.MODE_ALLOWED,
            detail = "Lets CHATR attribute tracker events to apps when Android exposes usage data.",
            actionKey = "request_usage_stats",
            required = false,
        )
    }

    private fun settingPermission(
        key: String,
        title: String,
        granted: Boolean,
        detail: String,
        actionKey: String,
        required: Boolean = true,
    ): JSONObject {
        val manufacturerRestricted = !granted && isManufacturerRestricted()
        return card(
            key = key,
            title = title,
            state = when {
                granted -> "granted"
                manufacturerRestricted -> "manufacturer_restricted"
                else -> "denied"
            },
            detail = detail,
            actionKey = actionKey,
            fix = when {
                granted -> "Verified"
                manufacturerRestricted -> "Enable autostart/background permission in your device security app, then return here."
                else -> "Open Android settings and allow $title."
            },
            required = required,
        )
    }

    private fun granted(key: String, title: String, detail: String, actionKey: String): JSONObject =
        card(key, title, "granted", detail, actionKey, "Verified", true)

    private fun unavailable(key: String, title: String, detail: String, actionKey: String): JSONObject =
        card(key, title, "unavailable", detail, actionKey, detail, false)

    private fun card(
        key: String,
        title: String,
        state: String,
        detail: String,
        actionKey: String?,
        fix: String,
        required: Boolean,
    ): JSONObject {
        return JSONObject().apply {
            put("key", key)
            put("title", title)
            put("state", state)
            put("detail", detail)
            put("actionKey", actionKey ?: JSONObject.NULL)
            put("fix", fix)
            put("required", required)
            put("enabled", state == "granted")
            put("verified", state == "granted")
        }
    }

    private fun overlayGranted(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)

    private fun isManufacturerRestricted(): Boolean {
        val manufacturer = (Build.MANUFACTURER ?: "").lowercase(Locale.US)
        return manufacturer in setOf("xiaomi", "redmi", "poco", "oppo", "vivo", "huawei", "honor", "realme")
    }

    private fun isBatteryOptimizationIgnored(context: Context): Boolean {
        val powerManager = context.getSystemService(PowerManager::class.java) ?: return true
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            powerManager.isIgnoringBatteryOptimizations(context.packageName)
        } else {
            true
        }
    }

    private fun persistSnapshot(context: Context, cards: JSONArray) {
        persistExecutor.execute {
            val dao = ShieldDatabase.get(context).dao()
            val now = System.currentTimeMillis()
            for (index in 0 until cards.length()) {
                val card = cards.optJSONObject(index) ?: continue
                dao.upsertPermissionState(
                    PermissionStateEntity(
                        id = card.optString("key").ifBlank { UUID.randomUUID().toString() },
                        permissionKey = card.optString("key"),
                        state = card.optString("state"),
                        actionKey = card.optString("actionKey").ifBlank { null },
                        manufacturerRestricted = card.optString("state") == "manufacturer_restricted",
                        updatedAt = now,
                    ),
                )
            }
        }
    }
}
