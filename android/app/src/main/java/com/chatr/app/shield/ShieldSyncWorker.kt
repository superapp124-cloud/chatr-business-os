package com.chatr.app.shield

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
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
import java.util.concurrent.TimeUnit

class ShieldSyncWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val url = supabaseUrl() ?: return Result.success()
        val anonKey = supabaseAnonKey() ?: return Result.success()
        val prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val userId = prefs.getString(KEY_USER_ID, null)?.takeIf { it.isNotBlank() } ?: return Result.success()
        val token = prefs.getString(KEY_AUTH_TOKEN, null)?.takeIf { it.isNotBlank() } ?: return Result.success()
        val shieldState = ShieldAnalyticsEngine.statusJson(applicationContext)
        val dao = ShieldDatabase.get(applicationContext).dao()

        return try {
            pushUserSecurityState(url, anonKey, token, userId, shieldState)
            pushMetricSnapshot(url, anonKey, token, userId, shieldState.optJSONObject("metrics") ?: JSONObject())
            pushProtectionEvents(url, anonKey, token, userId, dao.pendingProtectionEvents())
            pushScamReports(url, anonKey, token, userId, dao.pendingScamReports())
            pullThreatEvents(url, anonKey, token, userId)
            Result.success()
        } catch (error: Exception) {
            Log.w(TAG, "Shield sync failed: ${error.message}")
            Result.retry()
        }
    }

    private fun pushUserSecurityState(url: String, anonKey: String, token: String, userId: String, shieldState: JSONObject) {
        val body = JSONObject().apply {
            put("user_id", userId)
            put("permission_state", shieldState.optJSONObject("permissions") ?: JSONObject())
            put("defense_state", shieldState.optJSONArray("defenses") ?: JSONArray())
            put("metric_snapshot", shieldState.optJSONObject("metrics") ?: JSONObject())
            put("updated_at", iso(System.currentTimeMillis()))
        }
        postJson(
            endpoint = "$url/rest/v1/user_security_state?on_conflict=user_id",
            anonKey = anonKey,
            bearer = token,
            body = body,
            prefer = "resolution=merge-duplicates,return=minimal",
        )
    }

    private fun pushMetricSnapshot(url: String, anonKey: String, token: String, userId: String, metrics: JSONObject) {
        val body = JSONObject().apply {
            put("user_id", userId)
            put("calls_screened_today", metrics.optInt("callsScreenedToday"))
            put("scams_blocked", metrics.optInt("scamsBlocked"))
            put("trackers_blocked", metrics.optInt("trackersBlocked"))
            put("risky_calls_detected", metrics.optInt("riskyCallsDetected"))
            put("privacy_score", metrics.optInt("privacyScore"))
            put("active_defenses", metrics.optInt("activeDefenses"))
            put("observed_at", iso(System.currentTimeMillis()))
        }
        postJson(
            endpoint = "$url/rest/v1/synced_metrics",
            anonKey = anonKey,
            bearer = token,
            body = body,
            prefer = "return=minimal",
        )
    }

    private fun pushProtectionEvents(
        url: String,
        anonKey: String,
        token: String,
        userId: String,
        events: List<ProtectionEventEntity>,
    ) {
        if (events.isEmpty()) return
        val payload = JSONArray().apply {
            events.forEach { event ->
                put(
                    JSONObject().apply {
                        put("id", event.id)
                        put("user_id", userId)
                        put("event_type", event.eventType)
                        put("severity", event.severity)
                        put("title", event.message)
                        put("payload", event.payload?.let(::JSONObject) ?: JSONObject())
                        put("occurred_at", iso(event.createdAt))
                    },
                )
            }
        }
        postJsonArray(
            endpoint = "$url/rest/v1/threat_events?on_conflict=id",
            anonKey = anonKey,
            bearer = token,
            body = payload,
            prefer = "resolution=merge-duplicates,return=minimal",
        )
        val syncedAt = System.currentTimeMillis()
        ShieldDatabase.get(applicationContext).dao().markProtectionEventsSynced(events.map { it.id }, syncedAt)
    }

    private fun pushScamReports(
        url: String,
        anonKey: String,
        token: String,
        userId: String,
        reports: List<ScamReportEntity>,
    ) {
        if (reports.isEmpty()) return
        val payload = JSONArray().apply {
            reports.forEach { report ->
                put(
                    JSONObject().apply {
                        put("id", report.id)
                        put("user_id", userId)
                        put("normalized_number", report.normalizedNumber ?: JSONObject.NULL)
                        put("hashed_number", report.hashedNumber)
                        put("category", report.category)
                        put("confidence", report.confidence)
                        put("reporter_type", report.reporterType)
                        put("notes", report.notes ?: JSONObject.NULL)
                        put("created_at", iso(report.createdAt))
                    },
                )
            }
        }
        postJsonArray(
            endpoint = "$url/rest/v1/scam_reports?on_conflict=id",
            anonKey = anonKey,
            bearer = token,
            body = payload,
            prefer = "resolution=merge-duplicates,return=minimal",
        )
        val syncedAt = System.currentTimeMillis()
        ShieldDatabase.get(applicationContext).dao().markScamReportsSynced(reports.map { it.id }, syncedAt)
    }

    private fun pullThreatEvents(url: String, anonKey: String, token: String, userId: String) {
        val encodedUserId = URLEncoder.encode(userId, "UTF-8")
        val endpoint = "$url/rest/v1/threat_events?user_id=eq.$encodedUserId&event_type=eq.leak&order=occurred_at.desc&limit=25"
        val raw = getJson(endpoint, anonKey, token) ?: return
        val rows = JSONArray(raw)
        for (index in 0 until rows.length()) {
            val item = rows.optJSONObject(index) ?: continue
            val payload = item.optJSONObject("payload") ?: JSONObject()
            val emailHash = payload.optString("email_hash")
            if (emailHash.isBlank()) continue
            ShieldAnalyticsEngine.recordLeakResult(
                context = applicationContext,
                emailHash = emailHash,
                provider = payload.optString("provider").ifBlank { "supabase" },
                breachName = payload.optString("breach_name").ifBlank { null },
                severity = item.optString("severity").ifBlank { "medium" },
                exposedDataClasses = jsonArrayToCsv(payload.optJSONArray("exposed_data")),
                remediation = payload.optString("remediation").ifBlank { null },
                foundAt = parseIso(item.optString("occurred_at")),
            )
        }
    }

    private fun getJson(endpoint: String, anonKey: String, token: String): String? {
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = TIMEOUT_MS
            readTimeout = TIMEOUT_MS
            setRequestProperty("apikey", anonKey)
            setRequestProperty("Authorization", "Bearer $token")
        }
        if (connection.responseCode !in 200..299) return null
        return BufferedReader(InputStreamReader(connection.inputStream)).use { it.readText() }
    }

    private fun postJson(endpoint: String, anonKey: String, bearer: String, body: JSONObject, prefer: String) {
        post(endpoint, anonKey, bearer, body.toString(), prefer)
    }

    private fun postJsonArray(endpoint: String, anonKey: String, bearer: String, body: JSONArray, prefer: String) {
        post(endpoint, anonKey, bearer, body.toString(), prefer)
    }

    private fun post(endpoint: String, anonKey: String, bearer: String, body: String, prefer: String) {
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = TIMEOUT_MS
            readTimeout = TIMEOUT_MS
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("apikey", anonKey)
            setRequestProperty("Authorization", "Bearer $bearer")
            setRequestProperty("Prefer", prefer)
        }
        connection.outputStream.use { it.write(body.toByteArray()) }
        if (connection.responseCode !in 200..299) {
            throw IllegalStateException("Shield sync endpoint failed ${connection.responseCode}")
        }
    }

    private fun supabaseUrl(): String? =
        runCatching { applicationContext.getString(R.string.supabase_url) }
            .getOrNull()
            ?.takeIf { it.isNotBlank() && !it.startsWith("YOUR_") }

    private fun supabaseAnonKey(): String? =
        runCatching { applicationContext.getString(R.string.supabase_anon_key) }
            .getOrNull()
            ?.takeIf { it.isNotBlank() && !it.startsWith("YOUR_") }

    private fun iso(epochMillis: Long): String {
        val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        formatter.timeZone = TimeZone.getTimeZone("UTC")
        return formatter.format(Date(epochMillis))
    }

    private fun parseIso(value: String?): Long {
        if (value.isNullOrBlank()) return System.currentTimeMillis()
        return runCatching {
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSX", Locale.US).parse(value)?.time
        }.getOrNull() ?: System.currentTimeMillis()
    }

    private fun jsonArrayToCsv(array: JSONArray?): String {
        if (array == null || array.length() == 0) return ""
        val values = mutableListOf<String>()
        for (index in 0 until array.length()) {
            val value = array.optString(index)
            if (value.isNotBlank()) {
                values += value
            }
        }
        return values.joinToString(",")
    }

    companion object {
        private const val TAG = "ShieldSyncWorker"
        private const val UNIQUE_WORK = "chatr_shield_sync"
        private const val TIMEOUT_MS = 8_000
        private const val PREFS_NAME = "chatr_prefs"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_AUTH_TOKEN = "auth_token"

        fun enqueue(context: Context) {
            val request = PeriodicWorkRequestBuilder<ShieldSyncWorker>(6, TimeUnit.HOURS)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build(),
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.MINUTES)
                .build()

            WorkManager.getInstance(context.applicationContext).enqueueUniquePeriodicWork(
                UNIQUE_WORK,
                ExistingPeriodicWorkPolicy.UPDATE,
                request,
            )
        }
    }
}
