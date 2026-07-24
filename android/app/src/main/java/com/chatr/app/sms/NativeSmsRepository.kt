package com.chatr.app.sms

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.provider.ContactsContract
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.util.Locale
import java.util.UUID

class NativeSmsRepository private constructor(context: Context) :
    SQLiteOpenHelper(context.applicationContext, DB_NAME, null, DB_VERSION) {

    private val appContext = context.applicationContext

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS sms_conversations (
                conversation_id TEXT PRIMARY KEY,
                address TEXT NOT NULL,
                display_name TEXT NOT NULL,
                last_body TEXT NOT NULL,
                last_timestamp INTEGER NOT NULL,
                unread_count INTEGER NOT NULL DEFAULT 0,
                spam_score INTEGER NOT NULL DEFAULT 0,
                risk_level TEXT NOT NULL DEFAULT 'low',
                is_otp INTEGER NOT NULL DEFAULT 0,
                otp_code TEXT,
                risk_reasons TEXT NOT NULL DEFAULT '',
                risk_categories TEXT NOT NULL DEFAULT '[]',
                matched_phrases TEXT NOT NULL DEFAULT '[]',
                risk_summary TEXT NOT NULL DEFAULT '',
                recommended_action TEXT NOT NULL DEFAULT 'allow',
                updated_at INTEGER NOT NULL
            )
            """.trimIndent(),
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS sms_messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                address TEXT NOT NULL,
                display_name TEXT NOT NULL,
                direction TEXT NOT NULL,
                body TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                status TEXT NOT NULL,
                read INTEGER NOT NULL DEFAULT 0,
                spam_score INTEGER NOT NULL DEFAULT 0,
                risk_level TEXT NOT NULL DEFAULT 'low',
                is_otp INTEGER NOT NULL DEFAULT 0,
                otp_code TEXT,
                risk_reasons TEXT NOT NULL DEFAULT '',
                risk_categories TEXT NOT NULL DEFAULT '[]',
                matched_phrases TEXT NOT NULL DEFAULT '[]',
                risk_summary TEXT NOT NULL DEFAULT '',
                recommended_action TEXT NOT NULL DEFAULT 'allow',
                created_at INTEGER NOT NULL
            )
            """.trimIndent(),
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sms_messages_conversation_time ON sms_messages(conversation_id, timestamp DESC)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sms_conversations_time ON sms_conversations(last_timestamp DESC)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        onCreate(db)
        if (oldVersion < 2) {
            addRiskColumnsIfMissing(db, "sms_conversations")
            addRiskColumnsIfMissing(db, "sms_messages")
        }
    }

    @Synchronized
    fun storeIncoming(address: String, body: String, timestamp: Long = System.currentTimeMillis()): NativeSmsMessage {
        val cleanAddress = normalizeAddress(address)
        val displayName = resolveDisplayName(cleanAddress)
        val risk = NativeSmsDetector.analyze(body)
        val message = NativeSmsMessage(
            id = "sms_in_${timestamp}_${UUID.randomUUID()}",
            conversationId = conversationIdFor(cleanAddress),
            address = cleanAddress,
            displayName = displayName,
            direction = "incoming",
            body = body,
            timestamp = timestamp,
            status = "received",
            read = false,
            risk = risk,
        )
        writableDatabase.use { db ->
            db.beginTransaction()
            try {
                insertMessage(db, message)
                upsertConversation(db, message, incrementUnread = true)
                db.setTransactionSuccessful()
            } finally {
                db.endTransaction()
            }
        }
        return message
    }

    @Synchronized
    fun storeOutgoing(address: String, body: String, status: String = "queued"): NativeSmsMessage {
        val cleanAddress = normalizeAddress(address)
        val displayName = resolveDisplayName(cleanAddress)
        val risk = NativeSmsDetector.analyze(body)
        val timestamp = System.currentTimeMillis()
        val message = NativeSmsMessage(
            id = "sms_out_${timestamp}_${UUID.randomUUID()}",
            conversationId = conversationIdFor(cleanAddress),
            address = cleanAddress,
            displayName = displayName,
            direction = "outgoing",
            body = body,
            timestamp = timestamp,
            status = status,
            read = true,
            risk = risk,
        )
        writableDatabase.use { db ->
            db.beginTransaction()
            try {
                insertMessage(db, message)
                upsertConversation(db, message, incrementUnread = false)
                db.setTransactionSuccessful()
            } finally {
                db.endTransaction()
            }
        }
        return message
    }

    @Synchronized
    fun updateStatus(messageId: String?, status: String) {
        if (messageId.isNullOrBlank()) return
        val values = ContentValues().apply {
            put("status", status)
        }
        writableDatabase.update("sms_messages", values, "id = ?", arrayOf(messageId))
    }

    @Synchronized
    fun upsertSystemMessage(
        systemId: Long,
        address: String,
        body: String,
        timestamp: Long,
        type: Int,
        read: Boolean,
    ): Boolean {
        if (systemId <= 0L || body.isBlank()) return false
        val cleanAddress = normalizeAddress(address)
        val displayName = resolveDisplayName(cleanAddress)
        val risk = NativeSmsDetector.analyze(body)
        val message = NativeSmsMessage(
            id = "sms_sys_$systemId",
            conversationId = conversationIdFor(cleanAddress),
            address = cleanAddress,
            displayName = displayName,
            direction = directionForSystemType(type),
            body = body,
            timestamp = timestamp,
            status = statusForSystemType(type),
            read = read || directionForSystemType(type) == "outgoing",
            risk = risk,
        )
        var inserted = false
        writableDatabase.use { db ->
            db.beginTransaction()
            try {
                inserted = !messageExists(db, message.id)
                insertMessage(db, message)
                rebuildConversation(db, message.conversationId)
                db.setTransactionSuccessful()
            } finally {
                db.endTransaction()
            }
        }
        return inserted
    }

    @Synchronized
    fun markConversationRead(conversationId: String) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            db.update(
                "sms_messages",
                ContentValues().apply { put("read", 1) },
                "conversation_id = ?",
                arrayOf(conversationId),
            )
            db.update(
                "sms_conversations",
                ContentValues().apply { put("unread_count", 0) },
                "conversation_id = ?",
                arrayOf(conversationId),
            )
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun conversationsJson(limit: Int = 100): JSONArray {
        val result = JSONArray()
        readableDatabase.query(
            "sms_conversations",
            null,
            null,
            null,
            null,
            null,
            "last_timestamp DESC",
            limit.coerceIn(1, 500).toString(),
        ).use { cursor ->
            while (cursor.moveToNext()) {
                result.put(conversationFromCursor(cursor).toJson())
            }
        }
        return result
    }

    fun messagesJson(conversationId: String, limit: Int = 200): JSONArray {
        val result = JSONArray()
        readableDatabase.query(
            "sms_messages",
            null,
            "conversation_id = ?",
            arrayOf(conversationId),
            null,
            null,
            "timestamp DESC",
            limit.coerceIn(1, 1000).toString(),
        ).use { cursor ->
            while (cursor.moveToNext()) {
                result.put(messageFromCursor(cursor).toJson())
            }
        }
        return result
    }

    fun statsJson(): JSONObject {
        val db = readableDatabase
        return JSONObject().apply {
            put("conversationCount", count(db, "sms_conversations"))
            put("messageCount", count(db, "sms_messages"))
            put("unreadCount", db.rawQuery("SELECT COALESCE(SUM(unread_count), 0) FROM sms_conversations", null).use { c ->
                if (c.moveToFirst()) c.getInt(0) else 0
            })
            put("highRiskCount", db.rawQuery("SELECT COUNT(*) FROM sms_messages WHERE spam_score >= 60", null).use { c ->
                if (c.moveToFirst()) c.getInt(0) else 0
            })
            put("otpCount", db.rawQuery("SELECT COUNT(*) FROM sms_messages WHERE is_otp = 1", null).use { c ->
                if (c.moveToFirst()) c.getInt(0) else 0
            })
        }
    }

    private fun insertMessage(db: SQLiteDatabase, message: NativeSmsMessage) {
        db.insertWithOnConflict(
            "sms_messages",
            null,
            ContentValues().apply {
                put("id", message.id)
                put("conversation_id", message.conversationId)
                put("address", message.address)
                put("display_name", message.displayName)
                put("direction", message.direction)
                put("body", message.body)
                put("timestamp", message.timestamp)
                put("status", message.status)
                put("read", if (message.read) 1 else 0)
                put("spam_score", message.risk.spamScore)
                put("risk_level", message.risk.riskLevel)
                put("is_otp", if (message.risk.isOtp) 1 else 0)
                put("otp_code", message.risk.otpCode)
                put("risk_reasons", message.risk.reasons.joinToString(","))
                put("risk_categories", jsonArrayText(message.risk.categories))
                put("matched_phrases", jsonArrayText(message.risk.matchedPhrases))
                put("risk_summary", message.risk.summary)
                put("recommended_action", message.risk.recommendedAction)
                put("created_at", System.currentTimeMillis())
            },
            SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    private fun rebuildConversation(db: SQLiteDatabase, conversationId: String) {
        val latest = db.query(
            "sms_messages",
            null,
            "conversation_id = ?",
            arrayOf(conversationId),
            null,
            null,
            "timestamp DESC, created_at DESC",
            "1",
        ).use { cursor ->
            if (cursor.moveToFirst()) messageFromCursor(cursor) else null
        }

        if (latest == null) {
            db.delete("sms_conversations", "conversation_id = ?", arrayOf(conversationId))
            return
        }

        val unread = db.rawQuery(
            "SELECT COUNT(*) FROM sms_messages WHERE conversation_id = ? AND direction = 'incoming' AND read = 0",
            arrayOf(conversationId),
        ).use { cursor ->
            if (cursor.moveToFirst()) cursor.getInt(0) else 0
        }

        db.insertWithOnConflict(
            "sms_conversations",
            null,
            ContentValues().apply {
                put("conversation_id", latest.conversationId)
                put("address", latest.address)
                put("display_name", latest.displayName)
                put("last_body", latest.body)
                put("last_timestamp", latest.timestamp)
                put("unread_count", unread)
                put("spam_score", latest.risk.spamScore)
                put("risk_level", latest.risk.riskLevel)
                put("is_otp", if (latest.risk.isOtp) 1 else 0)
                put("otp_code", latest.risk.otpCode)
                put("risk_reasons", latest.risk.reasons.joinToString(","))
                put("risk_categories", jsonArrayText(latest.risk.categories))
                put("matched_phrases", jsonArrayText(latest.risk.matchedPhrases))
                put("risk_summary", latest.risk.summary)
                put("recommended_action", latest.risk.recommendedAction)
                put("updated_at", System.currentTimeMillis())
            },
            SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    private fun upsertConversation(db: SQLiteDatabase, message: NativeSmsMessage, incrementUnread: Boolean) {
        val existingUnread = db.rawQuery(
            "SELECT unread_count FROM sms_conversations WHERE conversation_id = ?",
            arrayOf(message.conversationId),
        ).use { cursor ->
            if (cursor.moveToFirst()) cursor.getInt(0) else 0
        }
        val unread = if (incrementUnread) existingUnread + 1 else existingUnread
        db.insertWithOnConflict(
            "sms_conversations",
            null,
            ContentValues().apply {
                put("conversation_id", message.conversationId)
                put("address", message.address)
                put("display_name", message.displayName)
                put("last_body", message.body)
                put("last_timestamp", message.timestamp)
                put("unread_count", unread)
                put("spam_score", message.risk.spamScore)
                put("risk_level", message.risk.riskLevel)
                put("is_otp", if (message.risk.isOtp) 1 else 0)
                put("otp_code", message.risk.otpCode)
                put("risk_reasons", message.risk.reasons.joinToString(","))
                put("risk_categories", jsonArrayText(message.risk.categories))
                put("matched_phrases", jsonArrayText(message.risk.matchedPhrases))
                put("risk_summary", message.risk.summary)
                put("recommended_action", message.risk.recommendedAction)
                put("updated_at", System.currentTimeMillis())
            },
            SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    private fun conversationFromCursor(cursor: Cursor): NativeSmsConversation {
        val risk = riskFromCursor(cursor)
        return NativeSmsConversation(
            conversationId = cursor.string("conversation_id"),
            address = cursor.string("address"),
            displayName = cursor.string("display_name"),
            lastBody = cursor.string("last_body"),
            lastTimestamp = cursor.long("last_timestamp"),
            unreadCount = cursor.int("unread_count"),
            lastRisk = risk,
        )
    }

    private fun messageFromCursor(cursor: Cursor): NativeSmsMessage {
        val risk = riskFromCursor(cursor)
        return NativeSmsMessage(
            id = cursor.string("id"),
            conversationId = cursor.string("conversation_id"),
            address = cursor.string("address"),
            displayName = cursor.string("display_name"),
            direction = cursor.string("direction"),
            body = cursor.string("body"),
            timestamp = cursor.long("timestamp"),
            status = cursor.string("status"),
            read = cursor.int("read") == 1,
            risk = risk,
        )
    }

    private fun riskFromCursor(cursor: Cursor): SmsRisk {
        val reasons = cursor.string("risk_reasons").split(',').filter { it.isNotBlank() }
        val categories = parseJsonArray(cursor.stringOrEmpty("risk_categories"))
        val summary = cursor.stringOrEmpty("risk_summary").ifBlank {
            fallbackRiskSummary(
                score = cursor.int("spam_score"),
                reasons = reasons,
                isOtp = cursor.int("is_otp") == 1,
            )
        }
        return SmsRisk(
            isOtp = cursor.int("is_otp") == 1,
            otpCode = cursor.stringOrNull("otp_code"),
            spamScore = cursor.int("spam_score"),
            riskLevel = cursor.string("risk_level"),
            reasons = reasons,
            categories = categories,
            matchedPhrases = parseJsonArray(cursor.stringOrEmpty("matched_phrases")),
            summary = summary,
            recommendedAction = cursor.stringOrEmpty("recommended_action").ifBlank { "allow" },
        )
    }

    private fun resolveDisplayName(address: String): String {
        if (address.isBlank()) return "Unknown sender"
        return try {
            val uri = ContactsContract.PhoneLookup.CONTENT_FILTER_URI.buildUpon()
                .appendPath(address)
                .build()
            appContext.contentResolver.query(
                uri,
                arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
                null,
                null,
                null,
            )?.use { cursor ->
                if (cursor.moveToFirst()) {
                    cursor.getString(0)?.takeIf { it.isNotBlank() }
                } else {
                    null
                }
            } ?: address
        } catch (_: Exception) {
            address
        }
    }

    private fun count(db: SQLiteDatabase, table: String): Int {
        return db.rawQuery("SELECT COUNT(*) FROM $table", null).use { cursor ->
            if (cursor.moveToFirst()) cursor.getInt(0) else 0
        }
    }

    private fun messageExists(db: SQLiteDatabase, messageId: String): Boolean {
        return db.rawQuery("SELECT 1 FROM sms_messages WHERE id = ? LIMIT 1", arrayOf(messageId)).use { cursor ->
            cursor.moveToFirst()
        }
    }

    private fun directionForSystemType(type: Int): String =
        if (type == android.provider.Telephony.Sms.MESSAGE_TYPE_INBOX) "incoming" else "outgoing"

    private fun statusForSystemType(type: Int): String =
        when (type) {
            android.provider.Telephony.Sms.MESSAGE_TYPE_INBOX -> "received"
            android.provider.Telephony.Sms.MESSAGE_TYPE_SENT -> "sent"
            android.provider.Telephony.Sms.MESSAGE_TYPE_DRAFT -> "draft"
            android.provider.Telephony.Sms.MESSAGE_TYPE_OUTBOX -> "outbox"
            android.provider.Telephony.Sms.MESSAGE_TYPE_FAILED -> "failed"
            android.provider.Telephony.Sms.MESSAGE_TYPE_QUEUED -> "queued"
            else -> "system_$type"
        }

    private fun addRiskColumnsIfMissing(db: SQLiteDatabase, table: String) {
        addColumnIfMissing(db, table, "risk_categories", "TEXT NOT NULL DEFAULT '[]'")
        addColumnIfMissing(db, table, "matched_phrases", "TEXT NOT NULL DEFAULT '[]'")
        addColumnIfMissing(db, table, "risk_summary", "TEXT NOT NULL DEFAULT ''")
        addColumnIfMissing(db, table, "recommended_action", "TEXT NOT NULL DEFAULT 'allow'")
    }

    private fun addColumnIfMissing(db: SQLiteDatabase, table: String, column: String, definition: String) {
        if (hasColumn(db, table, column)) return
        db.execSQL("ALTER TABLE $table ADD COLUMN $column $definition")
    }

    private fun hasColumn(db: SQLiteDatabase, table: String, column: String): Boolean {
        return db.rawQuery("PRAGMA table_info($table)", null).use { cursor ->
            while (cursor.moveToNext()) {
                if (cursor.getString(cursor.getColumnIndexOrThrow("name")) == column) return@use true
            }
            false
        }
    }

    private fun jsonArrayText(values: List<String>): String = JSONArray(values).toString()

    private fun parseJsonArray(raw: String): List<String> {
        if (raw.isBlank()) return emptyList()
        return try {
            val array = JSONArray(raw)
            List(array.length()) { index -> array.optString(index) }.filter { it.isNotBlank() }
        } catch (_: Exception) {
            raw.split(',').filter { it.isNotBlank() }
        }
    }

    private fun fallbackRiskSummary(score: Int, reasons: List<String>, isOtp: Boolean): String {
        if (score <= 0) return "No CHATR Shield SMS risk signals detected."
        if (isOtp && score < 35) return "OTP detected. Keep it private, especially during calls or screen-sharing."
        val signalText = reasons.take(3).joinToString(", ") { it.replace('_', ' ') }.ifBlank { "message context" }
        return "CHATR Shield flagged SMS risk signals: $signalText."
    }

    private fun Cursor.string(column: String): String = getString(getColumnIndexOrThrow(column)).orEmpty()
    private fun Cursor.stringOrNull(column: String): String? = getString(getColumnIndexOrThrow(column))
    private fun Cursor.stringOrEmpty(column: String): String {
        val index = getColumnIndex(column)
        return if (index >= 0) getString(index).orEmpty() else ""
    }
    private fun Cursor.int(column: String): Int = getInt(getColumnIndexOrThrow(column))
    private fun Cursor.long(column: String): Long = getLong(getColumnIndexOrThrow(column))

    companion object {
        private const val DB_NAME = "chatr_native_sms.db"
        private const val DB_VERSION = 2

        @Volatile
        private var instance: NativeSmsRepository? = null

        fun getInstance(context: Context): NativeSmsRepository {
            return instance ?: synchronized(this) {
                instance ?: NativeSmsRepository(context.applicationContext).also { instance = it }
            }
        }

        fun normalizeAddress(address: String?): String {
            return address
                ?.trim()
                ?.replace(Regex("[^+\\dA-Za-z]"), "")
                ?.takeIf { it.isNotBlank() }
                ?: "unknown"
        }

        fun conversationIdFor(address: String): String {
            val digest = MessageDigest.getInstance("SHA-256")
                .digest(address.lowercase(Locale.US).toByteArray())
                .joinToString("") { "%02x".format(it) }
                .take(24)
            return "sms_$digest"
        }
    }
}
