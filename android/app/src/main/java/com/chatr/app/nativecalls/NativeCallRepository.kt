package com.chatr.app.nativecalls

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject

class NativeCallRepository private constructor(context: Context) :
    SQLiteOpenHelper(context.applicationContext, DB_NAME, null, DB_VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        createTables(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        createTables(db)
    }

    private fun createTables(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS native_call_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_event_id TEXT NOT NULL UNIQUE,
                call_log_id TEXT,
                phone_number TEXT NOT NULL,
                normalized_number TEXT NOT NULL,
                hashed_number TEXT NOT NULL,
                contact_name TEXT,
                caller_name TEXT,
                direction TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at INTEGER NOT NULL,
                ended_at INTEGER,
                duration_seconds INTEGER NOT NULL DEFAULT 0,
                trust_score INTEGER NOT NULL DEFAULT 50,
                spam_reports INTEGER NOT NULL DEFAULT 0,
                risk_level TEXT NOT NULL DEFAULT 'safe',
                source TEXT NOT NULL,
                raw_payload TEXT,
                sync_state TEXT NOT NULL DEFAULT 'pending',
                synced_at INTEGER,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_native_call_events_started ON native_call_events(started_at DESC)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_native_call_events_sync ON native_call_events(sync_state)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_native_call_events_number ON native_call_events(normalized_number)")

        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS native_caller_profiles (
                normalized_number TEXT NOT NULL PRIMARY KEY,
                hashed_number TEXT NOT NULL,
                display_name TEXT,
                trust_score INTEGER NOT NULL DEFAULT 50,
                spam_reports INTEGER NOT NULL DEFAULT 0,
                spam_percentage REAL NOT NULL DEFAULT 0,
                total_reports INTEGER NOT NULL DEFAULT 0,
                risk_level TEXT NOT NULL DEFAULT 'safe',
                community_label TEXT,
                most_common_type TEXT,
                source TEXT NOT NULL,
                looked_up_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_native_caller_profiles_hash ON native_caller_profiles(hashed_number)")
    }

    fun upsertEvent(event: NativeCallEvent) {
        val now = System.currentTimeMillis()
        val values = ContentValues().apply {
            put("device_event_id", event.deviceEventId)
            put("call_log_id", event.callLogId)
            put("phone_number", event.phoneNumber)
            put("normalized_number", event.normalizedNumber)
            put("hashed_number", event.hashedNumber)
            put("contact_name", event.contactName)
            put("caller_name", event.callerName)
            put("direction", event.direction)
            put("status", event.status)
            put("started_at", event.startedAt)
            put("ended_at", event.endedAt)
            put("duration_seconds", event.durationSeconds)
            put("trust_score", event.trustScore)
            put("spam_reports", event.spamReports)
            put("risk_level", event.riskLevel)
            put("source", event.source)
            put("raw_payload", event.rawPayload)
            put("sync_state", "pending")
            put("updated_at", now)
        }

        val db = writableDatabase
        val existingCreatedAt = getCreatedAt(db, event.deviceEventId)
        values.put("created_at", existingCreatedAt ?: now)
        db.insertWithOnConflict("native_call_events", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun updateEventIntelligence(deviceEventId: String, profile: NativeCallerProfile) {
        val values = ContentValues().apply {
            put("caller_name", profile.displayName)
            put("trust_score", profile.trustScore)
            put("spam_reports", profile.spamReports)
            put("risk_level", profile.riskLevel)
            put("sync_state", "pending")
            put("updated_at", System.currentTimeMillis())
        }
        writableDatabase.update(
            "native_call_events",
            values,
            "device_event_id = ?",
            arrayOf(deviceEventId),
        )
    }

    fun upsertProfile(profile: NativeCallerProfile) {
        val values = ContentValues().apply {
            put("normalized_number", profile.normalizedNumber)
            put("hashed_number", profile.hashedNumber)
            put("display_name", profile.displayName)
            put("trust_score", profile.trustScore)
            put("spam_reports", profile.spamReports)
            put("spam_percentage", profile.spamPercentage)
            put("total_reports", profile.totalReports)
            put("risk_level", profile.riskLevel)
            put("community_label", profile.communityLabel)
            put("most_common_type", profile.mostCommonType)
            put("source", profile.source)
            put("looked_up_at", profile.lookedUpAt)
            put("updated_at", System.currentTimeMillis())
        }
        writableDatabase.insertWithOnConflict(
            "native_caller_profiles",
            null,
            values,
            SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    fun findProfile(normalizedNumber: String): NativeCallerProfile? {
        readableDatabase.query(
            "native_caller_profiles",
            null,
            "normalized_number = ?",
            arrayOf(normalizedNumber),
            null,
            null,
            null,
            "1",
        ).use { cursor ->
            if (!cursor.moveToFirst()) return null
            return NativeCallerProfile(
                normalizedNumber = cursor.getString(cursor.getColumnIndexOrThrow("normalized_number")),
                hashedNumber = cursor.getString(cursor.getColumnIndexOrThrow("hashed_number")),
                displayName = cursor.getString(cursor.getColumnIndexOrThrow("display_name")) ?: "Unknown Caller",
                trustScore = cursor.getInt(cursor.getColumnIndexOrThrow("trust_score")),
                spamReports = cursor.getInt(cursor.getColumnIndexOrThrow("spam_reports")),
                spamPercentage = cursor.getDouble(cursor.getColumnIndexOrThrow("spam_percentage")),
                totalReports = cursor.getInt(cursor.getColumnIndexOrThrow("total_reports")),
                riskLevel = cursor.getString(cursor.getColumnIndexOrThrow("risk_level")),
                communityLabel = cursor.getString(cursor.getColumnIndexOrThrow("community_label")),
                mostCommonType = cursor.getString(cursor.getColumnIndexOrThrow("most_common_type")),
                source = cursor.getString(cursor.getColumnIndexOrThrow("source")),
                lookedUpAt = cursor.getLong(cursor.getColumnIndexOrThrow("looked_up_at")),
            )
        }
    }

    fun pendingEvents(limit: Int = 50): List<NativeCallEvent> {
        val events = mutableListOf<NativeCallEvent>()
        readableDatabase.query(
            "native_call_events",
            null,
            "sync_state != ?",
            arrayOf("synced"),
            null,
            null,
            "started_at ASC",
            limit.toString(),
        ).use { cursor ->
            while (cursor.moveToNext()) {
                events.add(eventFromCursor(cursor))
            }
        }
        return events
    }

    fun markSynced(deviceEventId: String) {
        val values = ContentValues().apply {
            put("sync_state", "synced")
            put("synced_at", System.currentTimeMillis())
            put("updated_at", System.currentTimeMillis())
        }
        writableDatabase.update(
            "native_call_events",
            values,
            "device_event_id = ?",
            arrayOf(deviceEventId),
        )
    }

    fun eventSyncState(deviceEventId: String): String? {
        readableDatabase.query(
            "native_call_events",
            arrayOf("sync_state"),
            "device_event_id = ?",
            arrayOf(deviceEventId),
            null,
            null,
            null,
            "1",
        ).use { cursor ->
            return if (cursor.moveToFirst()) cursor.getString(0) else null
        }
    }

    fun eventNeedsIdentityHydration(deviceEventId: String): Boolean {
        readableDatabase.query(
            "native_call_events",
            arrayOf("caller_name", "contact_name", "normalized_number"),
            "device_event_id = ?",
            arrayOf(deviceEventId),
            null,
            null,
            null,
            "1",
        ).use { cursor ->
            if (!cursor.moveToFirst()) return true

            val callerName = cursor.getString(0)
            val contactName = cursor.getString(1)
            val normalizedNumber = cursor.getString(2)
            val displayName = callerName?.takeIf { it.isNotBlank() } ?: contactName.orEmpty()

            return displayName.isBlank() ||
                displayName.equals("Unknown", ignoreCase = true) ||
                displayName.equals("Unknown Caller", ignoreCase = true) ||
                isPhoneLike(displayName, normalizedNumber)
        }
    }

    fun recentEventsJson(limit: Int = 30): JSONArray {
        val array = JSONArray()
        readableDatabase.query(
            "native_call_events",
            null,
            null,
            null,
            null,
            null,
            "started_at DESC",
            limit.coerceIn(1, 100).toString(),
        ).use { cursor ->
            while (cursor.moveToNext()) {
                array.put(eventToJson(eventFromCursor(cursor)))
            }
        }
        return array
    }

    fun getRecentCalls(limit: Int = 100): List<NativeCallEvent> {
        val events = mutableListOf<NativeCallEvent>()
        readableDatabase.query(
            "native_call_events",
            null,
            null,
            null,
            null,
            null,
            "started_at DESC",
            limit.coerceIn(1, 100).toString(),
        ).use { cursor ->
            while (cursor.moveToNext()) {
                events.add(eventFromCursor(cursor))
            }
        }
        return events
    }

    fun statsJson(): JSONObject {
        val total = countWhere(null, null)
        val pending = countWhere("sync_state != ?", arrayOf("synced"))
        val profiles = readableDatabase.rawQuery("SELECT COUNT(*) FROM native_caller_profiles", null).use { cursor ->
            if (cursor.moveToFirst()) cursor.getInt(0) else 0
        }

        return JSONObject().apply {
            put("capturedCalls", total)
            put("pendingSync", pending)
            put("knownCallerProfiles", profiles)
        }
    }

    fun countEventsForNumber(normalizedNumber: String, sinceEpochMs: Long? = null): Int {
        if (normalizedNumber.isBlank()) return 0
        val selection = if (sinceEpochMs != null) {
            "normalized_number = ? AND started_at >= ?"
        } else {
            "normalized_number = ?"
        }
        val args = if (sinceEpochMs != null) {
            arrayOf(normalizedNumber, sinceEpochMs.toString())
        } else {
            arrayOf(normalizedNumber)
        }
        return countWhere(selection, args)
    }

    fun hasChatrVoipHistoryForNumber(normalizedNumber: String): Boolean {
        if (normalizedNumber.isBlank()) return false
        return countWhere(
            "normalized_number = ? AND source = ?",
            arrayOf(normalizedNumber, "chatr_voip"),
        ) > 0
    }

    fun countHighRiskEventsForNumber(normalizedNumber: String, sinceEpochMs: Long? = null): Int {
        if (normalizedNumber.isBlank()) return 0
        val selection = buildString {
            append("normalized_number = ? AND (risk_level IN ('spam', 'high_risk', 'suspicious') ")
            append("OR status IN ('warn', 'challenge', 'block', 'blocked', 'reject', 'cancel'))")
            if (sinceEpochMs != null) {
                append(" AND started_at >= ?")
            }
        }
        val args = if (sinceEpochMs != null) {
            arrayOf(normalizedNumber, sinceEpochMs.toString())
        } else {
            arrayOf(normalizedNumber)
        }
        return countWhere(selection, args)
    }

    private fun eventFromCursor(cursor: android.database.Cursor): NativeCallEvent {
        return NativeCallEvent(
            deviceEventId = cursor.getString(cursor.getColumnIndexOrThrow("device_event_id")),
            callLogId = cursor.getString(cursor.getColumnIndexOrThrow("call_log_id")),
            phoneNumber = cursor.getString(cursor.getColumnIndexOrThrow("phone_number")),
            normalizedNumber = cursor.getString(cursor.getColumnIndexOrThrow("normalized_number")),
            hashedNumber = cursor.getString(cursor.getColumnIndexOrThrow("hashed_number")),
            contactName = cursor.getString(cursor.getColumnIndexOrThrow("contact_name")),
            callerName = cursor.getString(cursor.getColumnIndexOrThrow("caller_name")),
            direction = cursor.getString(cursor.getColumnIndexOrThrow("direction")),
            status = cursor.getString(cursor.getColumnIndexOrThrow("status")),
            startedAt = cursor.getLong(cursor.getColumnIndexOrThrow("started_at")),
            endedAt = if (cursor.isNull(cursor.getColumnIndexOrThrow("ended_at"))) {
                null
            } else {
                cursor.getLong(cursor.getColumnIndexOrThrow("ended_at"))
            },
            durationSeconds = cursor.getLong(cursor.getColumnIndexOrThrow("duration_seconds")),
            trustScore = cursor.getInt(cursor.getColumnIndexOrThrow("trust_score")),
            spamReports = cursor.getInt(cursor.getColumnIndexOrThrow("spam_reports")),
            riskLevel = cursor.getString(cursor.getColumnIndexOrThrow("risk_level")),
            source = cursor.getString(cursor.getColumnIndexOrThrow("source")),
            rawPayload = cursor.getString(cursor.getColumnIndexOrThrow("raw_payload")),
            syncState = cursor.getString(cursor.getColumnIndexOrThrow("sync_state")),
        )
    }

    private fun eventToJson(event: NativeCallEvent): JSONObject {
        return JSONObject().apply {
            put("id", event.deviceEventId)
            put("device_event_id", event.deviceEventId)
            put("call_log_id", event.callLogId)
            put("caller_phone", if (event.direction == "incoming") event.normalizedNumber else "")
            put("receiver_phone", if (event.direction == "outgoing") event.normalizedNumber else "")
            put("caller_name", event.callerName ?: event.contactName ?: "Unknown")
            put("receiver_name", event.callerName ?: event.contactName ?: "Unknown")
            put("phone_number", event.normalizedNumber)
            put("normalized_number", event.normalizedNumber)
            put("contact_name", event.contactName ?: JSONObject.NULL)
            put("direction", event.direction)
            put("status", event.status)
            put("call_type", "carrier")
            put("duration_seconds", event.durationSeconds)
            put("trust_score", event.trustScore)
            put("spam_reports", event.spamReports)
            put("risk_level", event.riskLevel)
            put("source", event.source)
            put("started_at", event.startedAt)
            put("created_at", event.startedAt)
            put("sync_state", event.syncState)
        }
    }

    private fun getCreatedAt(db: SQLiteDatabase, deviceEventId: String): Long? {
        db.query(
            "native_call_events",
            arrayOf("created_at"),
            "device_event_id = ?",
            arrayOf(deviceEventId),
            null,
            null,
            null,
            "1",
        ).use { cursor ->
            return if (cursor.moveToFirst()) cursor.getLong(0) else null
        }
    }

    private fun countWhere(selection: String?, args: Array<String>?): Int {
        readableDatabase.query(
            "native_call_events",
            arrayOf("COUNT(*)"),
            selection,
            args,
            null,
            null,
            null,
        ).use { cursor ->
            return if (cursor.moveToFirst()) cursor.getInt(0) else 0
        }
    }

    private fun isPhoneLike(value: String?, phone: String?): Boolean {
        val valueDigits = value.orEmpty().filter { it.isDigit() }
        if (valueDigits.length < 5) return false

        val phoneDigits = phone.orEmpty().filter { it.isDigit() }
        if (phoneDigits.isBlank()) return true

        return phoneDigits.contains(valueDigits) ||
            valueDigits.contains(phoneDigits.takeLast(10))
    }

    companion object {
        private const val DB_NAME = "chatr_native_calls.db"
        private const val DB_VERSION = 1

        @Volatile
        private var instance: NativeCallRepository? = null

        fun getInstance(context: Context): NativeCallRepository {
            return instance ?: synchronized(this) {
                instance ?: NativeCallRepository(context).also { instance = it }
            }
        }
    }
}
