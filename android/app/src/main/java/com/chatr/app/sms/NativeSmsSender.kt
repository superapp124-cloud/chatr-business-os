package com.chatr.app.sms

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.util.ArrayList

object NativeSmsSender {
    const val ACTION_SMS_SENT = "com.chatr.app.sms.SMS_SENT"
    const val ACTION_SMS_DELIVERED = "com.chatr.app.sms.SMS_DELIVERED"

    fun send(context: Context, address: String, body: String): JSONObject {
        val appContext = context.applicationContext
        if (address.isBlank() || body.isBlank()) {
            return error("missing_address_or_body")
        }
        if (ContextCompat.checkSelfPermission(appContext, Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            return error("send_sms_permission_missing")
        }

        val stored = NativeSmsRepository.getInstance(appContext).storeOutgoing(address, body, "queued")
        return try {
            val smsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                appContext.getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }
            val parts = smsManager.divideMessage(body)
            val sentIntents = ArrayList<PendingIntent>()
            val deliveredIntents = ArrayList<PendingIntent>()
            parts.forEachIndexed { index, _ ->
                sentIntents.add(statusIntent(appContext, ACTION_SMS_SENT, stored.id, index))
                deliveredIntents.add(statusIntent(appContext, ACTION_SMS_DELIVERED, stored.id, index))
            }
            smsManager.sendMultipartTextMessage(
                NativeSmsRepository.normalizeAddress(address),
                null,
                parts,
                sentIntents,
                deliveredIntents,
            )
            NativeSmsRepository.getInstance(appContext).updateStatus(stored.id, "sent_to_radio")
            JSONObject().apply {
                put("ok", true)
                put("message", stored.toJson())
                put("partCount", parts.size)
            }
        } catch (error: Exception) {
            NativeSmsRepository.getInstance(appContext).updateStatus(stored.id, "failed")
            JSONObject().apply {
                put("ok", false)
                put("error", error.message ?: "send_failed")
                put("message", stored.toJson())
            }
        }
    }

    private fun statusIntent(context: Context, action: String, messageId: String, partIndex: Int): PendingIntent {
        val intent = Intent(context, NativeSmsStatusReceiver::class.java).apply {
            this.action = action
            putExtra("message_id", messageId)
            putExtra("part_index", partIndex)
        }
        return PendingIntent.getBroadcast(
            context,
            (messageId + action + partIndex).hashCode() and 0x7fffffff,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun error(reason: String): JSONObject = JSONObject().apply {
        put("ok", false)
        put("error", reason)
    }
}
