package com.chatr.app.postcall

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/**
 * CallRecordStore
 *
 * SQLite-backed store for completed call records.
 * Written by PostCallSummaryActivity after every call ends.
 * Read by the web layer via a Capacitor bridge (or directly by ViralSmsDispatcher).
 *
 * Schema: call_records(id, call_id, caller_number, caller_name, duration_sec,
 *                       direction, summary_text, ai_score, created_at)
 */
class CallRecordStore private constructor(context: Context) :
    SQLiteOpenHelper(context, DB_NAME, null, DB_VERSION) {

    companion object {
        private const val TAG = "CallRecordStore"
        private const val DB_NAME    = "chatr_call_records.db"
        private const val DB_VERSION = 1
        private const val TABLE      = "call_records"

        @Volatile private var instance: CallRecordStore? = null

        fun getInstance(context: Context): CallRecordStore =
            instance ?: synchronized(this) {
                instance ?: CallRecordStore(context.applicationContext).also { instance = it }
            }
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS $TABLE (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                call_id       TEXT NOT NULL UNIQUE,
                caller_number TEXT NOT NULL,
                caller_name   TEXT,
                duration_sec  INTEGER DEFAULT 0,
                direction     TEXT DEFAULT 'inbound',
                summary_text  TEXT,
                ai_score      REAL DEFAULT 0.0,
                viral_sent    INTEGER DEFAULT 0,
                created_at    INTEGER NOT NULL
            )
        """.trimIndent())
        Log.i(TAG, "✅ call_records table created")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // Future migrations here
    }

    /** Insert or replace a call record. Returns the row ID, or -1 on error. */
    fun upsert(
        callId: String,
        callerNumber: String,
        callerName: String? = null,
        durationSec: Int = 0,
        direction: String = "inbound",
        summaryText: String? = null,
        aiScore: Double = 0.0
    ): Long {
        return try {
            val cv = ContentValues().apply {
                put("call_id", callId)
                put("caller_number", callerNumber)
                put("caller_name", callerName ?: "")
                put("duration_sec", durationSec)
                put("direction", direction)
                put("summary_text", summaryText ?: "")
                put("ai_score", aiScore)
                put("viral_sent", 0)
                put("created_at", System.currentTimeMillis())
            }
            val rowId = writableDatabase.insertWithOnConflict(
                TABLE, null, cv, SQLiteDatabase.CONFLICT_REPLACE
            )
            Log.d(TAG, "Upserted call record: callId=$callId rowId=$rowId")
            rowId
        } catch (e: Exception) {
            Log.e(TAG, "Failed to upsert call record", e)
            -1L
        }
    }

    /** Mark a call record as having had viral SMS sent. */
    fun markViralSent(callId: String) {
        try {
            val cv = ContentValues().apply { put("viral_sent", 1) }
            writableDatabase.update(TABLE, cv, "call_id = ?", arrayOf(callId))
        } catch (e: Exception) {
            Log.e(TAG, "Failed to mark viral sent", e)
        }
    }

    /** Returns recent calls as a JSON array string (for web layer). */
    fun recentJson(limit: Int = 50): JSONArray {
        val arr = JSONArray()
        try {
            val cursor = readableDatabase.query(
                TABLE, null, null, null, null, null,
                "created_at DESC", limit.toString()
            )
            cursor.use {
                while (it.moveToNext()) {
                    arr.put(JSONObject().apply {
                        put("id",           it.getLong(it.getColumnIndexOrThrow("id")))
                        put("callId",       it.getString(it.getColumnIndexOrThrow("call_id")))
                        put("callerNumber", it.getString(it.getColumnIndexOrThrow("caller_number")))
                        put("callerName",   it.getString(it.getColumnIndexOrThrow("caller_name")))
                        put("durationSec",  it.getInt(it.getColumnIndexOrThrow("duration_sec")))
                        put("direction",    it.getString(it.getColumnIndexOrThrow("direction")))
                        put("summaryText",  it.getString(it.getColumnIndexOrThrow("summary_text")))
                        put("aiScore",      it.getDouble(it.getColumnIndexOrThrow("ai_score")))
                        put("viralSent",    it.getInt(it.getColumnIndexOrThrow("viral_sent")) == 1)
                        put("createdAt",    it.getLong(it.getColumnIndexOrThrow("created_at")))
                    })
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to query call records", e)
        }
        return arr
    }

    /** Returns unsent viral-eligible calls (AI score >= threshold, viral not sent). */
    fun getPendingViralRecords(minScore: Double = 0.7): List<Map<String, Any>> {
        val results = mutableListOf<Map<String, Any>>()
        try {
            val cursor = readableDatabase.query(
                TABLE, null,
                "ai_score >= ? AND viral_sent = 0",
                arrayOf(minScore.toString()),
                null, null, "created_at DESC", "20"
            )
            cursor.use {
                while (it.moveToNext()) {
                    results.add(mapOf(
                        "callId"       to it.getString(it.getColumnIndexOrThrow("call_id")),
                        "callerNumber" to it.getString(it.getColumnIndexOrThrow("caller_number")),
                        "callerName"   to it.getString(it.getColumnIndexOrThrow("caller_name")),
                        "summaryText"  to it.getString(it.getColumnIndexOrThrow("summary_text")),
                        "aiScore"      to it.getDouble(it.getColumnIndexOrThrow("ai_score"))
                    ))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to query viral records", e)
        }
        return results
    }

    fun deleteOlderThan(days: Int = 30) {
        val cutoff = System.currentTimeMillis() - (days * 24 * 3600 * 1000L)
        try {
            val deleted = writableDatabase.delete(TABLE, "created_at < ?", arrayOf(cutoff.toString()))
            Log.i(TAG, "🗑️ Deleted $deleted call records older than $days days")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to purge old records", e)
        }
    }
}
