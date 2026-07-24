package com.chatr.app.nativecalls

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CallLog
import android.util.Log
import androidx.core.content.ContextCompat
import org.json.JSONObject

object NativeCallLogSync {
    private const val TAG = "NativeCallLogSync"
    private const val PREFS_NAME = "chatr_prefs"
    private const val KEY_LAST_RUN_PREFIX = "native_call_sync_last_run_"
    private const val STARTUP_SYNC_MIN_INTERVAL_MS = 5L * 60L * 1000L
    private const val CALL_STATE_SYNC_MIN_INTERVAL_MS = 30L * 1000L
    private const val BACKGROUND_SYNC_MIN_INTERVAL_MS = 10L * 60L * 1000L
    private const val MAX_EVENTS_PER_SYNC = 60
    private const val MAX_REMOTE_LOOKUPS_PER_SYNC = 4
    private const val PROFILE_CACHE_TTL_MS = 7L * 24L * 60L * 60L * 1000L

    fun syncNow(context: Context, reason: String = "manual"): Int {
        val appContext = context.applicationContext
        if (shouldSkipRun(appContext, reason)) return 0

        if (ContextCompat.checkSelfPermission(appContext, Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "READ_CALL_LOG missing; native call-log sync skipped")
            return 0
        }

        val repo = NativeCallRepository.getInstance(appContext)
        val client = SupabaseNativeCallClient(appContext)
        val antiTracker =
            NativeGsmDefenseEngine.isFeatureEnabled(appContext, NativeGsmDefenseEngine.FEATURE_ANTI_TRACKER)
        var imported = 0
        var remoteLookups = 0

        val projection = arrayOf(
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.CACHED_NAME,
            CallLog.Calls.TYPE,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION,
            CallLog.Calls.GEOCODED_LOCATION,
        )

        try {
            appContext.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                null,
                null,
                "${CallLog.Calls.DATE} DESC",
            )?.use { cursor ->
                while (cursor.moveToNext() && imported < MAX_EVENTS_PER_SYNC) {
                    val id = cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls._ID))
                    val deviceEventId = "calllog:$id"
                    val alreadySynced = repo.eventSyncState(deviceEventId) == "synced"

                    val rawNumber = cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)).orEmpty()
                    val cachedName = cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.CACHED_NAME))
                    val type = cursor.getInt(cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE))
                    val startedAt = cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls.DATE))
                    val duration = cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION))
                    val location = cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.GEOCODED_LOCATION))

                    val normalized = NativePhoneNormalizer.normalize(rawNumber)
                    if (normalized.isBlank()) continue

                    val contactMatch = NativeContactResolver.lookup(appContext, normalized.ifBlank { rawNumber })
                    val localName = contactMatch?.displayName
                        ?: cachedName?.takeIf { it.isNotBlank() }
                    if (alreadySynced && !repo.eventNeedsIdentityHydration(deviceEventId)) {
                        continue
                    }

                    val cachedProfile = repo.findProfile(normalized)
                    val shouldAttemptRemoteLookup =
                        contactMatch == null &&
                        !isFreshCachedProfile(cachedProfile) &&
                            remoteLookups < MAX_REMOTE_LOOKUPS_PER_SYNC
                    val profile = resolveProfile(
                        repo = repo,
                        client = client,
                        normalized = normalized,
                        localName = localName,
                        contact = contactMatch,
                        cached = cachedProfile,
                        allowRemoteLookup = shouldAttemptRemoteLookup,
                        includeRawNumber = !antiTracker,
                    )
                    if (shouldAttemptRemoteLookup) {
                        remoteLookups++
                    }

                    val event = NativeCallEvent(
                        deviceEventId = deviceEventId,
                        callLogId = id.toString(),
                        phoneNumber = if (antiTracker) normalized else rawNumber.ifBlank { normalized },
                        normalizedNumber = normalized,
                        hashedNumber = NativePhoneNormalizer.hash(normalized),
                        contactName = localName?.takeIf { it.isNotBlank() },
                        callerName = profile.displayName.takeIf { it != "Unknown Caller" } ?: localName,
                        direction = directionFor(type),
                        status = statusFor(type, duration),
                        startedAt = startedAt,
                        endedAt = startedAt + duration * 1000,
                        durationSeconds = duration,
                        trustScore = profile.trustScore,
                        spamReports = profile.spamReports,
                        riskLevel = profile.riskLevel,
                        source = "android_call_log:$reason",
                        rawPayload = JSONObject().apply {
                            put("type", type)
                            put("geocoded_location", if (antiTracker) JSONObject.NULL else location)
                            put("anti_tracker", antiTracker)
                        }.toString(),
                    )

                    repo.upsertEvent(event)
                    imported++
                }
            }
        } catch (error: Exception) {
            Log.e(TAG, "Call-log import failed", error)
        }

        val pending = repo.pendingEvents()
        if (client.isNativeCallEventsSyncBackedOff()) {
            Log.i(TAG, "Native call event upload skipped; schema backoff active pending=${pending.size} reason=$reason")
        } else {
            for (event in pending) {
                if (client.isNativeCallEventsSyncBackedOff()) break
                if (client.syncEvent(event)) {
                    repo.markSynced(event.deviceEventId)
                }
            }
        }

        Log.i(TAG, "Native call sync finished. imported=$imported pending=${pending.size} remoteLookups=$remoteLookups reason=$reason")
        return imported
    }

    private fun shouldSkipRun(context: Context, reason: String): Boolean =
        synchronized(NativeCallLogSync::class.java) {
            val now = System.currentTimeMillis()
            val bucket = throttleBucket(reason)
            val intervalMs = throttleIntervalMs(bucket)
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val key = "$KEY_LAST_RUN_PREFIX$bucket"
            val lastRunAt = prefs.getLong(key, 0L)

            if (now - lastRunAt < intervalMs) {
                Log.i(TAG, "Native call sync skipped; throttle active reason=$reason bucket=$bucket")
                return@synchronized true
            }

            prefs.edit().putLong(key, now).apply()
            false
        }

    private fun resolveProfile(
        repo: NativeCallRepository,
        client: SupabaseNativeCallClient,
        normalized: String,
        localName: String?,
        contact: NativeContactMatch?,
        cached: NativeCallerProfile?,
        allowRemoteLookup: Boolean,
        includeRawNumber: Boolean,
    ): NativeCallerProfile {
        if (contact != null) {
            val profile = NativeContactResolver.profileFor(contact)
            repo.upsertProfile(profile)
            return profile
        }

        if (isFreshCachedProfile(cached)) {
            return cached!!
        }

        if (!allowRemoteLookup) {
            return cached ?: localProfile(normalized, localName)
        }

        val profile = client.lookupCaller(normalized, includeRawNumber = includeRawNumber)
        repo.upsertProfile(profile)
        return profile
    }

    private fun isFreshCachedProfile(profile: NativeCallerProfile?): Boolean {
        if (profile == null) return false
        return System.currentTimeMillis() - profile.lookedUpAt < PROFILE_CACHE_TTL_MS
    }

    private fun localProfile(normalized: String, cachedName: String?): NativeCallerProfile {
        val displayName = cachedName?.takeIf { it.isNotBlank() } ?: "Unknown Caller"
        return NativeCallerProfile(
            normalizedNumber = normalized,
            hashedNumber = NativePhoneNormalizer.hash(normalized),
            displayName = displayName,
            trustScore = 50,
            spamReports = 0,
            spamPercentage = 0.0,
            totalReports = 0,
            riskLevel = "safe",
            communityLabel = null,
            mostCommonType = null,
            source = if (displayName == "Unknown Caller") "native_local" else "android_call_log",
        )
    }

    private fun directionFor(type: Int): String {
        return when (type) {
            CallLog.Calls.OUTGOING_TYPE -> "outgoing"
            else -> "incoming"
        }
    }

    private fun statusFor(type: Int, duration: Long): String {
        return when (type) {
            CallLog.Calls.MISSED_TYPE -> "missed"
            CallLog.Calls.REJECTED_TYPE -> "rejected"
            CallLog.Calls.BLOCKED_TYPE -> "blocked"
            else -> if (duration > 0) "completed" else "ended"
        }
    }

    private fun throttleBucket(reason: String): String {
        return when (reason) {
            "phone_state_idle",
            "overlay_ringing"
            -> "call_state"
            "boot_completed",
            "network_recovered",
            "background_service"
            -> "background"
            else -> "startup"
        }
    }

    private fun throttleIntervalMs(bucket: String): Long {
        return when (bucket) {
            "call_state" -> CALL_STATE_SYNC_MIN_INTERVAL_MS
            "background" -> BACKGROUND_SYNC_MIN_INTERVAL_MS
            else -> STARTUP_SYNC_MIN_INTERVAL_MS
        }
    }
}
