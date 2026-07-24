package com.chatr.app.sms

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class NativeSmsStatusReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        val messageId = intent.getStringExtra("message_id") ?: return
        val status = when (intent.action) {
            NativeSmsSender.ACTION_SMS_SENT -> if (resultCode == Activity.RESULT_OK) "sent" else "send_failed_$resultCode"
            NativeSmsSender.ACTION_SMS_DELIVERED -> if (resultCode == Activity.RESULT_OK) "delivered" else "delivery_failed_$resultCode"
            else -> return
        }
        NativeSmsRepository.getInstance(context).updateStatus(messageId, status)
        Log.i(TAG, "SMS status messageId=$messageId status=$status")
    }

    companion object {
        private const val TAG = "NativeSmsStatus"
    }
}
