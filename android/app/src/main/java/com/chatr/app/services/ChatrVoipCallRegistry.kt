package com.chatr.app.services

import android.content.Context
import com.chatr.app.nativecalls.NativeContactResolver
import org.json.JSONObject

object ChatrVoipCallRegistry {
    private const val PREFS_NAME = "chatr_voip_call_registry"
    private const val KEY_ACTIVE_CALL = "active_call"
    private const val KEY_ALERT_PREFIX = "incoming_alert_"
    private const val ACTIVE_TTL_MS = 2 * 60 * 1000L

    data class Identity(
        val callId: String,
        val callerId: String,
        val callerName: String,
        val callerAvatar: String?,
        val callerPhone: String,
        val callType: String,
        val conversationId: String,
        val updatedAt: Long = System.currentTimeMillis(),
    )

    fun markIncoming(
        context: Context,
        callId: String,
        callerId: String,
        callerName: String,
        callerAvatar: String?,
        callerPhone: String,
        callType: String,
        conversationId: String,
    ) {
        if (callId.isBlank()) return
        val resolvedPhone = callerPhone.ifBlank { extractPhoneCandidate(callerName).orEmpty() }
        val resolvedAvatar = callerAvatar?.trim()?.takeIf { it.isNotBlank() }
            ?: lookupContactAvatar(context, resolvedPhone)

        prefs(context).edit().putString(
            KEY_ACTIVE_CALL,
            JSONObject().apply {
                put("callId", callId)
                put("callerId", callerId)
                put("callerName", callerName)
                put("callerAvatar", resolvedAvatar ?: "")
                put("callerPhone", resolvedPhone)
                put("callType", callType)
                put("conversationId", conversationId)
                put("updatedAt", System.currentTimeMillis())
            }.toString(),
        ).apply()
    }

    fun clear(context: Context, callId: String?) {
        val active = activeIdentity(context)
        if (callId.isNullOrBlank() || active?.callId == callId) {
            prefs(context).edit().remove(KEY_ACTIVE_CALL).apply()
        }
    }

    fun hasRecentIncoming(context: Context): Boolean =
        activeIdentity(context) != null

    fun registerIncomingAlert(context: Context, callId: String, windowMs: Long): Boolean {
        if (callId.isBlank()) return false
        val now = System.currentTimeMillis()
        val key = KEY_ALERT_PREFIX + callId
        synchronized(this) {
            val sharedPrefs = prefs(context)
            val lastAlertAt = sharedPrefs.getLong(key, 0L)
            if (lastAlertAt > 0L && now - lastAlertAt < windowMs) {
                return false
            }

            sharedPrefs.edit()
                .putLong(key, now)
                .commit()
        }
        return true
    }

    fun activeIdentity(context: Context): Identity? {
        val raw = prefs(context).getString(KEY_ACTIVE_CALL, null) ?: return null
        val identity = try {
            val json = JSONObject(raw)
            Identity(
                callId = json.optString("callId"),
                callerId = json.optString("callerId"),
                callerName = json.optString("callerName"),
                callerAvatar = json.optString("callerAvatar").takeIf { it.isNotBlank() },
                callerPhone = json.optString("callerPhone"),
                callType = json.optString("callType", "audio"),
                conversationId = json.optString("conversationId"),
                updatedAt = json.optLong("updatedAt", 0L),
            )
        } catch (_: Exception) {
            null
        }

        if (identity == null || System.currentTimeMillis() - identity.updatedAt > ACTIVE_TTL_MS) {
            prefs(context).edit().remove(KEY_ACTIVE_CALL).apply()
            return null
        }

        return identity
    }

    fun resolveDisplayName(
        context: Context,
        callId: String,
        callerId: String,
        proposedName: String?,
        callerPhone: String?,
    ): String {
        val active = activeIdentity(context)
            ?.takeIf { it.callId == callId || it.callerId == callerId }
        val lookupPhone = listOf(
            callerPhone,
            active?.callerPhone,
            extractPhoneCandidate(proposedName),
            extractPhoneCandidate(active?.callerName),
        ).firstOrNull { !it.isNullOrBlank() }

        val candidates = listOf(
            proposedName,
            active?.callerName,
            lookupContactName(context, lookupPhone),
        )

        for (candidate in candidates) {
            val cleaned = candidate?.trim().orEmpty()
            if (isUsableName(cleaned)) return cleaned
        }

        return "Unknown caller"
    }

    fun resolveAvatar(
        context: Context,
        callId: String,
        callerId: String,
        proposedAvatar: String?,
        callerPhone: String?,
        proposedName: String?,
    ): String? {
        proposedAvatar?.trim()?.takeIf { it.isNotBlank() }?.let { return it }

        val active = activeIdentity(context)
            ?.takeIf { it.callId == callId || it.callerId == callerId }
        active?.callerAvatar?.trim()?.takeIf { it.isNotBlank() }?.let { return it }

        val lookupPhone = listOf(
            callerPhone,
            active?.callerPhone,
            extractPhoneCandidate(proposedName),
            extractPhoneCandidate(active?.callerName),
        ).firstOrNull { !it.isNullOrBlank() }

        return lookupContactAvatar(context, lookupPhone)
    }

    fun extractPhoneCandidate(value: String?): String? {
        val cleaned = value?.trim().orEmpty()
        if (!isPhoneLikeName(cleaned)) return null
        return cleaned.replace(Regex("[^+\\d]"), "").takeIf { candidate -> candidate.any { it.isDigit() } }
    }

    fun isUsableName(value: String?): Boolean {
        val cleaned = value?.trim().orEmpty()
        if (cleaned.isBlank()) return false
        if (cleaned.equals("unknown", ignoreCase = true)) return false
        if (cleaned.equals("unknown caller", ignoreCase = true)) return false
        if (cleaned.equals("incoming call", ignoreCase = true)) return false
        if (isPhoneLikeName(cleaned)) return false
        if (Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", RegexOption.IGNORE_CASE).matches(cleaned)) return false
        return true
    }

    private fun isPhoneLikeName(value: String): Boolean {
        val digits = value.count { it.isDigit() }
        val letters = value.count { it.isLetter() }
        return digits >= 7 && letters == 0
    }

    private fun lookupContactName(context: Context, phone: String?): String? {
        val cleanedPhone = phone?.trim().orEmpty()
        if (cleanedPhone.isBlank()) return null
        return NativeContactResolver.lookup(context, cleanedPhone)?.displayName
            ?.takeIf { isUsableName(it) }
    }

    private fun lookupContactAvatar(context: Context, phone: String?): String? {
        val cleanedPhone = phone?.trim().orEmpty()
        if (cleanedPhone.isBlank()) return null
        return NativeContactResolver.lookup(context, cleanedPhone)?.photoUri
            ?.takeIf { it.isNotBlank() }
    }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
