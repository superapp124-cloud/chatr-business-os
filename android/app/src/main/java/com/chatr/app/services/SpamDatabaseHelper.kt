package com.chatr.app.services

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.util.Log

class SpamDatabaseHelper(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        private const val TAG = "SpamDatabaseHelper"
        private const val DATABASE_NAME = "chatr_security.db"
        private const val DATABASE_VERSION = 3

        const val TABLE_SPAM = "spam_numbers"
        const val TABLE_FRAUD = "fraud_numbers"
        const val TABLE_VERIFIED_BANKS = "verified_bank_numbers"
        
        const val COLUMN_NUMBER = "phone_number"
        const val COLUMN_REASON = "reason"
        const val COLUMN_ENTITY_NAME = "entity_name"
    }

    override fun onCreate(db: SQLiteDatabase) {
        val createSpamTable = """
            CREATE TABLE $TABLE_SPAM (
                $COLUMN_NUMBER TEXT PRIMARY KEY,
                $COLUMN_REASON TEXT
            )
        """.trimIndent()
        
        val createFraudTable = """
            CREATE TABLE $TABLE_FRAUD (
                $COLUMN_NUMBER TEXT PRIMARY KEY,
                $COLUMN_REASON TEXT
            )
        """.trimIndent()

        val createVerifiedTable = """
            CREATE TABLE $TABLE_VERIFIED_BANKS (
                $COLUMN_NUMBER TEXT PRIMARY KEY,
                $COLUMN_ENTITY_NAME TEXT
            )
        """.trimIndent()

        db.execSQL(createSpamTable)
        db.execSQL(createFraudTable)
        db.execSQL(createVerifiedTable)
        
        Log.i(TAG, "Created Security Database tables")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS $TABLE_SPAM")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_FRAUD")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_VERIFIED_BANKS")
        onCreate(db)
    }

    fun syncSpamNumbers(numbers: List<String>) {
        val db = this.writableDatabase
        db.beginTransaction()
        try {
            db.execSQL("DELETE FROM $TABLE_SPAM")
            val stmt = db.compileStatement("INSERT INTO $TABLE_SPAM ($COLUMN_NUMBER, $COLUMN_REASON) VALUES (?, ?)")
            for (number in numbers) {
                val normalized = number.replace(Regex("[^0-9+]"), "")
                stmt.bindString(1, normalized)
                stmt.bindString(2, "community_spam")
                stmt.executeInsert()
                stmt.clearBindings()
            }
            db.setTransactionSuccessful()
        } catch (e: Exception) {
            Log.e(TAG, "Error syncing spam numbers", e)
        } finally {
            db.endTransaction()
            db.close()
        }
    }

    fun isSpam(number: String): Boolean {
        return checkNumberInTable(number, TABLE_SPAM)
    }
    
    fun isUpiFraud(number: String): Boolean {
        return checkNumberInTable(number, TABLE_FRAUD)
    }
    
    fun getFraudReason(number: String): String? {
        val normalized = number.replace(Regex("[^0-9+]"), "")
        val db = this.readableDatabase
        val cursor = db.query(TABLE_FRAUD, arrayOf(COLUMN_REASON), "$COLUMN_NUMBER = ?", arrayOf(normalized), null, null, null)
        var reason: String? = null
        if (cursor.moveToFirst()) {
            reason = cursor.getString(0)
        }
        cursor.close()
        db.close()
        return reason
    }

    fun isVerifiedBank(number: String): Boolean {
        return checkNumberInTable(number, TABLE_VERIFIED_BANKS)
    }
    
    private fun checkNumberInTable(number: String, table: String): Boolean {
        val normalized = number.replace(Regex("[^0-9+]"), "")
        val db = this.readableDatabase
        val cursor = db.query(
            table,
            arrayOf(COLUMN_NUMBER),
            "$COLUMN_NUMBER = ?",
            arrayOf(normalized),
            null, null, null
        )
        val exists = cursor.count > 0
        cursor.close()
        db.close()
        return exists
    }
}
