package com.chatr.app.sms

import android.app.IntentService
import android.content.Intent
import android.util.Log

@Suppress("DEPRECATION")
class NativeSmsRespondService : IntentService("NativeSmsRespondService") {
    override fun onHandleIntent(intent: Intent?) {
        if (intent == null) return
        val address = intent.data?.schemeSpecificPart
            ?: intent.getStringExtra("address")
            ?: intent.getStringExtra("phone_number")
            ?: return
        val body = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
            ?: intent.getStringExtra("sms_body")
            ?: return
        val result = NativeSmsSender.send(this, address, body)
        Log.i(TAG, "Respond-via-message result=$result")
    }

    companion object {
        private const val TAG = "NativeSmsRespondService"
    }
}
