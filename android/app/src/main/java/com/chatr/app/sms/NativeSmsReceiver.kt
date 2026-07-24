package com.chatr.app.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log

class NativeSmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        val action = intent.action.orEmpty()
        if (action != Telephony.Sms.Intents.SMS_DELIVER_ACTION &&
            action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION
        ) {
            return
        }

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return

        val sender = messages.firstOrNull()?.displayOriginatingAddress.orEmpty()
        val body = messages.joinToString(separator = "") { it.displayMessageBody.orEmpty() }
        val timestamp = messages.minOfOrNull { it.timestampMillis } ?: System.currentTimeMillis()
        if (sender.isBlank() || body.isBlank()) return

        try {
            val stored = NativeSmsRepository.getInstance(context).storeIncoming(sender, body, timestamp)
            NativeSmsNotifier.showIncoming(context, stored)
            Log.i(TAG, "Stored native SMS conversation=${stored.conversationId} risk=${stored.risk.riskLevel}")
        } catch (error: Exception) {
            Log.e(TAG, "Failed to process native SMS", error)
        }
    }

    companion object {
        private const val TAG = "NativeSmsReceiver"
    }
}
