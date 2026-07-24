package com.chatr.app.sms

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.Telephony
import androidx.core.content.ContextCompat
import org.json.JSONObject

object NativeSmsSystemSync {
    private val projection = arrayOf(
        Telephony.Sms._ID,
        Telephony.Sms.ADDRESS,
        Telephony.Sms.BODY,
        Telephony.Sms.DATE,
        Telephony.Sms.TYPE,
        Telephony.Sms.READ,
    )

    fun sync(context: Context, limit: Int = 500): JSONObject {
        val appContext = context.applicationContext
        if (
            ContextCompat.checkSelfPermission(appContext, Manifest.permission.READ_SMS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return JSONObject().apply {
                put("ok", false)
                put("error", "read_sms_permission_missing")
                put("scanned", 0)
                put("inserted", 0)
                put("updated", 0)
                put("skipped", 0)
                put("state", NativeSmsRole.statusJson(appContext))
            }
        }

        var scanned = 0
        var inserted = 0
        var skipped = 0
        val boundedLimit = limit.coerceIn(1, 5000)
        val repository = NativeSmsRepository.getInstance(appContext)

        try {
            appContext.contentResolver.query(
                Telephony.Sms.CONTENT_URI,
                projection,
                null,
                null,
                "${Telephony.Sms.DATE} DESC",
            )?.use { cursor ->
                val idIndex = cursor.getColumnIndexOrThrow(Telephony.Sms._ID)
                val addressIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
                val bodyIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)
                val dateIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)
                val typeIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.TYPE)
                val readIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.READ)

                while (cursor.moveToNext() && scanned < boundedLimit) {
                    scanned += 1
                    val systemId = cursor.getLong(idIndex)
                    val address = cursor.getString(addressIndex).orEmpty()
                    val body = cursor.getString(bodyIndex).orEmpty()
                    val timestamp = cursor.getLong(dateIndex).takeIf { it > 0L } ?: System.currentTimeMillis()
                    val type = cursor.getInt(typeIndex)
                    val read = cursor.getInt(readIndex) == 1
                    if (systemId <= 0L || address.isBlank() || body.isBlank()) {
                        skipped += 1
                        continue
                    }
                    if (repository.upsertSystemMessage(systemId, address, body, timestamp, type, read)) {
                        inserted += 1
                    }
                }
            }
        } catch (error: SecurityException) {
            return JSONObject().apply {
                put("ok", false)
                put("error", "read_sms_security_exception")
                put("message", error.message ?: "")
                put("scanned", scanned)
                put("inserted", inserted)
                put("updated", (scanned - inserted - skipped).coerceAtLeast(0))
                put("skipped", skipped)
                put("state", NativeSmsRole.statusJson(appContext))
            }
        } catch (error: Exception) {
            return JSONObject().apply {
                put("ok", false)
                put("error", "system_sms_sync_failed")
                put("message", error.message ?: "")
                put("scanned", scanned)
                put("inserted", inserted)
                put("updated", (scanned - inserted - skipped).coerceAtLeast(0))
                put("skipped", skipped)
                put("state", NativeSmsRole.statusJson(appContext))
            }
        }

        return JSONObject().apply {
            put("ok", true)
            put("scanned", scanned)
            put("inserted", inserted)
            put("updated", (scanned - inserted - skipped).coerceAtLeast(0))
            put("skipped", skipped)
            put("limit", boundedLimit)
            put("state", NativeSmsRole.statusJson(appContext))
        }
    }
}
