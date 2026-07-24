package com.chatr.app.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class NativeMmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null) return
        try {
            val stored = NativeSmsRepository.getInstance(context).storeIncoming(
                address = "mms",
                body = "New MMS received",
                timestamp = System.currentTimeMillis(),
            )
            NativeSmsNotifier.showIncoming(context, stored)
            Log.i(TAG, "Stored placeholder MMS event")
        } catch (error: Exception) {
            Log.e(TAG, "Failed to process MMS placeholder", error)
        }
    }

    companion object {
        private const val TAG = "NativeMmsReceiver"
    }
}
