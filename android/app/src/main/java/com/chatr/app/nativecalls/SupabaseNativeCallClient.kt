package com.chatr.app.nativecalls

import android.content.Context
import android.util.Log
import com.chatr.app.R
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class SupabaseNativeCallClient(private val context: Context) {
    private val appContext = context.applicationContext

    fun lookupCaller(rawNumber: String, includeRawNumber: Boolean = true): NativeCallerProfile {
        val normalized = NativePhoneNormalizer.normalize(rawNumber)
        val hashed = NativePhoneNormalizer.hash(normalized.ifBlank { rawNumber })
        val fallback = NativeCallerProfile(
            normalizedNumber = normalized.ifBlank { rawNumber },
            hashedNumber = hashed,
            displayName = "Unknown Caller",
            trustScore = 50,
            spamReports = 0,
            spamPercentage = 0.0,
            totalReports = 0,
            riskLevel = "safe",
            communityLabel = null,
            mostCommonType = null,
            source = "native_fallback",
        )

        if (normalized.isBlank() || hashed.isBlank()) return fallback

        val url = supabaseUrl() ?: return fallback
        val key = supabaseAnonKey() ?: return fallback

        modernLookup(url, key, hashed, normalized, includeRawNumber)?.let { return it }
        if (includeRawNumber) {
            legacyLookup(url, key, normalized, hashed)?.let { return it }
        }
        tableLookup(url, key, hashed, normalized)?.let { return it }

        return fallback
    }

    fun syncEvent(event: NativeCallEvent): Boolean {
        if (isNativeCallEventsSyncBackedOff()) return false

        val url = supabaseUrl() ?: return false
        val key = supabaseAnonKey() ?: return false
        val userId = authPrefs().getString(KEY_USER_ID, null)?.takeIf { it.isNotBlank() } ?: return false
        val token = com.chatr.app.auth.NativeAuthManager.getValidTokenBlocking(appContext) ?: return false
        val antiTracker =
            NativeGsmDefenseEngine.isFeatureEnabled(appContext, NativeGsmDefenseEngine.FEATURE_ANTI_TRACKER)

        val body = JSONObject().apply {
            put("user_id", userId)
            put("device_event_id", event.deviceEventId)
            put("call_log_id", event.callLogId)
            put("phone_number", if (antiTracker) JSONObject.NULL else event.phoneNumber)
            put("normalized_number", if (antiTracker) JSONObject.NULL else event.normalizedNumber)
            put("hashed_number", event.hashedNumber)
            put("contact_name", event.contactName)
            put("caller_name", event.callerName)
            put("direction", event.direction)
            put("status", event.status)
            put("started_at", iso(event.startedAt))
            put("ended_at", event.endedAt?.let { iso(it) })
            put("duration_seconds", event.durationSeconds)
            put("trust_score", event.trustScore)
            put("spam_reports", event.spamReports)
            put("risk_level", event.riskLevel)
            put("source", event.source)
            put("raw_payload", event.rawPayload?.let { JSONObject(it) } ?: JSONObject())
        }

        val success = postJson(
            endpoint = "$url/rest/v1/native_call_events?on_conflict=user_id,device_event_id",
            key = key,
            bearer = token,
            body = body,
            prefer = "resolution=merge-duplicates,return=minimal",
        )

        if (success && !antiTracker && !event.contactName.isNullOrBlank()) {
            syncIdentityObservation(url, key, token, userId, event)
        }

        return success
    }

    fun syncAiSummary(summary: com.chatr.app.services.CallSummary): Boolean {
        val url = supabaseUrl() ?: return false
        val key = supabaseAnonKey() ?: return false
        val userId = authPrefs().getString(KEY_USER_ID, null)?.takeIf { it.isNotBlank() } ?: return false
        val token = com.chatr.app.auth.NativeAuthManager.getValidTokenBlocking(appContext) ?: return false

        val keyPointsJson = JSONArray(summary.keyPoints)
        val actionItemsJson = JSONArray(summary.actionItems)
        val calendarEventsJson = JSONArray().apply {
            summary.calendarEvents.forEach { ev ->
                put(JSONObject().apply {
                    put("title", ev.title)
                    put("date", ev.date)
                    put("time", ev.time)
                })
            }
        }

        val body = JSONObject().apply {
            put("user_id", userId)
            put("phone_number", summary.phoneNumber)
            put("contact_name", summary.contactName ?: JSONObject.NULL)
            put("duration_seconds", summary.durationSeconds)
            put("summary", summary.summary)
            put("sentiment", summary.sentiment)
            put("key_points", keyPointsJson)
            put("action_items", actionItemsJson)
            put("calendar_events", calendarEventsJson)
            put("generated_at", iso(summary.generatedAt))
        }

        return postJson(
            endpoint = "$url/rest/v1/ai_call_summaries",
            key = key,
            bearer = token,
            body = body,
            prefer = "return=minimal"
        )
    }

    fun isNativeCallEventsSyncBackedOff(): Boolean {
        val disabledUntil = authPrefs().getLong(KEY_NATIVE_CALL_EVENTS_BACKOFF_UNTIL, 0L)
        return disabledUntil > System.currentTimeMillis()
    }

    fun updateVoipCallStatus(callId: String, status: String): Boolean {
        if (callId.isBlank() || status.isBlank()) return false

        val url = supabaseUrl() ?: return false
        val key = supabaseAnonKey() ?: return false
        val token = com.chatr.app.auth.NativeAuthManager.getValidTokenBlocking(appContext) ?: return false
        val encodedCallId = URLEncoder.encode(callId, "UTF-8")
        val terminalStatus = status in setOf("ended", "missed", "rejected", "declined", "failed")

        val body = JSONObject().apply {
            put("status", status)
            if (status == "missed") {
                put("missed", true)
            } else if (terminalStatus) {
                put("missed", false)
            }
            if (terminalStatus) {
                put("ended_at", iso(System.currentTimeMillis()))
            }
        }

        return patchJson(
            endpoint = "$url/rest/v1/calls?id=eq.$encodedCallId",
            key = key,
            bearer = token,
            body = body,
            prefer = "return=minimal",
        )
    }

    private fun syncIdentityObservation(
        url: String,
        key: String,
        token: String,
        userId: String,
        event: NativeCallEvent,
    ) {
        val body = JSONObject().apply {
            put("reporter_id", userId)
            put("phone_number", event.normalizedNumber)
            put("hashed_number", event.hashedNumber)
            put("observed_name", event.contactName)
            put("source", "android_call_log")
            put("confidence", if (event.direction == "incoming") 80 else 70)
        }

        postJson(
            endpoint = "$url/rest/v1/caller_identity_observations?on_conflict=reporter_id,hashed_number,source",
            key = key,
            bearer = token,
            body = body,
            prefer = "resolution=merge-duplicates,return=minimal",
            logFailure = false,
        )
    }

    private fun modernLookup(
        url: String,
        key: String,
        hashed: String,
        normalized: String,
        includeRawNumber: Boolean,
    ): NativeCallerProfile? {
        return try {
            val response = postRpc(
                url = "$url/rest/v1/rpc/lookup_caller_id",
                key = key,
                body = JSONObject().apply {
                    put("p_hashed_number", hashed)
                    put("p_raw_number", if (includeRawNumber) normalized else JSONObject.NULL)
                },
            ) ?: return null

            val json = parseFirstObject(response) ?: return null
            profileFromModernJson(json, normalized, hashed, "supabase_rpc")
        } catch (error: Exception) {
            Log.w(TAG, "Modern lookup failed: ${error.message}")
            null
        }
    }

    private fun legacyLookup(url: String, key: String, normalized: String, hashed: String): NativeCallerProfile? {
        return try {
            val response = postRpc(
                url = "$url/rest/v1/rpc/lookup_caller_id",
                key = key,
                body = JSONObject().apply {
                    put("p_phone", normalized)
                },
            ) ?: return null

            val json = parseFirstObject(response) ?: return null
            val totalReports = json.optInt("total_reports", 0)
            val spamPercentage = json.optDouble("spam_percentage", 0.0)
            val spamReports = Math.round((spamPercentage / 100.0) * totalReports).toInt()
            val trustScore = (100 - spamPercentage).toInt().coerceIn(5, 99)
            val risk = when {
                spamPercentage >= 65 -> "spam"
                spamPercentage >= 25 -> "suspicious"
                else -> "safe"
            }

            NativeCallerProfile(
                normalizedNumber = normalized,
                hashedNumber = hashed,
                displayName = json.optString("community_name", "Unknown Caller").ifBlank { "Unknown Caller" },
                trustScore = trustScore,
                spamReports = spamReports,
                spamPercentage = spamPercentage,
                totalReports = totalReports,
                riskLevel = risk,
                communityLabel = json.optString("community_label").ifBlank { null },
                mostCommonType = json.optString("most_common_type").ifBlank { null },
                source = "caller_id_aggregate",
            )
        } catch (error: Exception) {
            Log.w(TAG, "Legacy lookup failed: ${error.message}")
            null
        }
    }

    private fun tableLookup(url: String, key: String, hashed: String, normalized: String): NativeCallerProfile? {
        return try {
            val encoded = URLEncoder.encode(hashed, "UTF-8")
            val endpoint = URL("$url/rest/v1/contacts_hash?hashed_number=eq.$encoded&select=name,trust_score&limit=1")
            val conn = (endpoint.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = TIMEOUT_MS
                readTimeout = TIMEOUT_MS
                setRequestProperty("apikey", key)
                setRequestProperty("Authorization", "Bearer $key")
            }

            if (conn.responseCode !in 200..299) return null
            val response = BufferedReader(InputStreamReader(conn.inputStream)).readText()
            val row = JSONArray(response).optJSONObject(0) ?: return null
            profileFromModernJson(row, normalized, hashed, "contacts_hash")
        } catch (error: Exception) {
            Log.w(TAG, "Table lookup failed: ${error.message}")
            null
        }
    }

    private fun profileFromModernJson(
        json: JSONObject,
        normalized: String,
        hashed: String,
        source: String,
    ): NativeCallerProfile {
        val spamReports = json.optInt("spam_reports", json.optInt("spamReports", 0))
        val trustScore = json.optInt("trust_score", json.optInt("trustScore", 50)).coerceIn(0, 100)
        val risk = when {
            spamReports >= 5 || trustScore < 30 -> "spam"
            spamReports >= 2 || trustScore < 60 -> "suspicious"
            else -> "safe"
        }

        return NativeCallerProfile(
            normalizedNumber = normalized,
            hashedNumber = hashed,
            displayName = json.optString("name", "Unknown Caller").ifBlank { "Unknown Caller" },
            trustScore = trustScore,
            spamReports = spamReports,
            spamPercentage = 0.0,
            totalReports = spamReports,
            riskLevel = risk,
            communityLabel = json.optString("community_label").ifBlank { null },
            mostCommonType = json.optString("most_common_type").ifBlank { null },
            source = source,
        )
    }

    private fun postRpc(url: String, key: String, body: JSONObject): String? {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = TIMEOUT_MS
            readTimeout = TIMEOUT_MS
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("apikey", key)
            setRequestProperty("Authorization", "Bearer $key")
        }

        conn.outputStream.use { it.write(body.toString().toByteArray()) }
        if (conn.responseCode !in 200..299) return null
        return BufferedReader(InputStreamReader(conn.inputStream)).readText()
    }

    private fun postJson(
        endpoint: String,
        key: String,
        bearer: String,
        body: JSONObject,
        prefer: String,
        logFailure: Boolean = true,
        isRetry: Boolean = false,
    ): Boolean {
        return try {
            val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = TIMEOUT_MS
                readTimeout = TIMEOUT_MS
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("apikey", key)
                setRequestProperty("Authorization", "Bearer $bearer")
                setRequestProperty("Prefer", prefer)
            }

            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            val ok = conn.responseCode in 200..299
            if (!ok) {
                if (conn.responseCode == 401 && !isRetry) {
                    if (refreshAccessTokenIfNeeded()) {
                        val newBearer = authPrefs().getString(KEY_AUTH_TOKEN, bearer) ?: bearer
                        return postJson(endpoint, key, newBearer, body, prefer, logFailure, true)
                    }
                }
                val errorBody = readError(conn)
                maybeBackoffNativeCallEvents(endpoint, conn.responseCode, errorBody)
                if (logFailure) {
                    Log.w(TAG, "Supabase sync failed ${conn.responseCode}: $errorBody")
                }
            }
            ok
        } catch (error: Exception) {
            if (logFailure) Log.w(TAG, "Supabase sync error: ${error.message}")
            false
        }
    }

    private fun patchJson(
        endpoint: String,
        key: String,
        bearer: String,
        body: JSONObject,
        prefer: String,
        isRetry: Boolean = false,
    ): Boolean {
        return try {
            val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "PATCH"
                connectTimeout = TIMEOUT_MS
                readTimeout = TIMEOUT_MS
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("apikey", key)
                setRequestProperty("Authorization", "Bearer $bearer")
                setRequestProperty("Prefer", prefer)
            }

            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            val ok = conn.responseCode in 200..299
            if (!ok) {
                if (conn.responseCode == 401 && !isRetry) {
                    if (refreshAccessTokenIfNeeded()) {
                        val newBearer = authPrefs().getString(KEY_AUTH_TOKEN, bearer) ?: bearer
                        return patchJson(endpoint, key, newBearer, body, prefer, true)
                    }
                }
                Log.w(TAG, "Supabase patch failed ${conn.responseCode}: ${readError(conn)}")
            }
            ok
        } catch (error: Exception) {
            Log.w(TAG, "Supabase patch error: ${error.message}")
            false
        }
    }

    private fun refreshAccessTokenIfNeeded(): Boolean {
        val url = supabaseUrl() ?: return false
        val key = supabaseAnonKey() ?: return false
        val prefs = authPrefs()
        val refreshToken = prefs.getString(KEY_REFRESH_TOKEN, null)?.takeIf { it.isNotBlank() } ?: return false

        try {
            val endpoint = "$url/auth/v1/token?grant_type=refresh_token"
            val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = TIMEOUT_MS
                readTimeout = TIMEOUT_MS
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("apikey", key)
            }
            
            val body = JSONObject().apply {
                put("refresh_token", refreshToken)
            }

            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            if (conn.responseCode in 200..299) {
                val response = BufferedReader(InputStreamReader(conn.inputStream)).readText()
                val json = JSONObject(response)
                val newAccessToken = json.optString("access_token")
                val newRefreshToken = json.optString("refresh_token")
                if (newAccessToken.isNotBlank()) {
                    val editor = prefs.edit()
                    editor.putString(KEY_AUTH_TOKEN, newAccessToken)
                    if (newRefreshToken.isNotBlank()) {
                        editor.putString(KEY_REFRESH_TOKEN, newRefreshToken)
                    }
                    editor.apply()
                    Log.i(TAG, "Successfully refreshed Supabase JWT in native client")
                    return true
                }
            } else {
                Log.w(TAG, "Failed to refresh Supabase JWT in native client: ${conn.responseCode}")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error refreshing Supabase JWT: ${e.message}")
        }
        return false
    }

    private fun maybeBackoffNativeCallEvents(endpoint: String, responseCode: Int, errorBody: String) {
        if (!endpoint.contains("/native_call_events")) return
        if (responseCode == 404 || errorBody.contains("PGRST205", ignoreCase = true)) {
            val disabledUntil = System.currentTimeMillis() + NATIVE_CALL_EVENTS_SCHEMA_BACKOFF_MS
            authPrefs().edit()
                .putLong(KEY_NATIVE_CALL_EVENTS_BACKOFF_UNTIL, disabledUntil)
                .putString(KEY_NATIVE_CALL_EVENTS_LAST_SCHEMA_ERROR, errorBody.take(500))
                .apply()
            Log.w(
                TAG,
                "native_call_events table unavailable; pausing native call event upload for ${NATIVE_CALL_EVENTS_SCHEMA_BACKOFF_MS / 60000} minutes",
            )
        }
    }

    private fun readError(conn: HttpURLConnection): String {
        return try {
            conn.errorStream?.bufferedReader()?.readText().orEmpty()
        } catch (_: Exception) {
            ""
        }
    }

    private fun parseFirstObject(response: String): JSONObject? {
        val trimmed = response.trim()
        if (trimmed.isBlank()) return null
        return if (trimmed.startsWith("[")) {
            JSONArray(trimmed).optJSONObject(0)
        } else {
            JSONObject(trimmed)
        }
    }

    private fun iso(epochMillis: Long): String {
        val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        formatter.timeZone = TimeZone.getTimeZone("UTC")
        return formatter.format(Date(epochMillis))
    }

    private fun supabaseUrl(): String? =
        try {
            appContext.getString(R.string.supabase_url).takeIf { it.isNotBlank() && !it.startsWith("YOUR_") }
        } catch (_: Exception) {
            null
        }

    private fun supabaseAnonKey(): String? =
        try {
            appContext.getString(R.string.supabase_anon_key).takeIf { it.isNotBlank() && !it.startsWith("YOUR_") }
        } catch (_: Exception) {
            null
        }

    private fun authPrefs() = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    companion object {
        private const val TAG = "SupabaseNativeCalls"
        private const val TIMEOUT_MS = 3500
        private const val PREFS_NAME = "chatr_prefs"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_NATIVE_CALL_EVENTS_BACKOFF_UNTIL = "native_call_events_backoff_until"
        private const val KEY_NATIVE_CALL_EVENTS_LAST_SCHEMA_ERROR = "native_call_events_last_schema_error"
        private const val NATIVE_CALL_EVENTS_SCHEMA_BACKOFF_MS = 6L * 60L * 60L * 1000L
    }
}
