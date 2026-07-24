package com.chatr.app.sms

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.RemoteInput

class NativeSmsActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        when (intent.action) {
            ACTION_REPLY -> handleReply(context, intent)
            ACTION_MARK_READ -> handleMarkRead(context, intent)
        }
    }

    private fun handleReply(context: Context, intent: Intent) {
        val address = intent.getStringExtra(EXTRA_ADDRESS) ?: return
        val conversationId = intent.getStringExtra(EXTRA_CONVERSATION_ID).orEmpty()
        val replyText = RemoteInput.getResultsFromIntent(intent)
            ?.getCharSequence(KEY_TEXT_REPLY)
            ?.toString()
            ?.trim()
            .orEmpty()
        if (replyText.isBlank()) return
        val result = NativeSmsSender.send(context, address, replyText)
        if (conversationId.isNotBlank()) {
            NativeSmsRepository.getInstance(context).markConversationRead(conversationId)
        }
        NativeSmsNotifier.cancel(context, conversationId)
        Log.i(TAG, "Inline SMS reply result=$result")
    }

    private fun handleMarkRead(context: Context, intent: Intent) {
        val conversationId = intent.getStringExtra(EXTRA_CONVERSATION_ID) ?: return
        NativeSmsRepository.getInstance(context).markConversationRead(conversationId)
        NativeSmsNotifier.cancel(context, conversationId)
        val notificationManager = context.getSystemService(NotificationManager::class.java)
        notificationManager?.cancel(NativeSmsNotifier.notificationId(conversationId))
    }

    companion object {
        const val ACTION_REPLY = "com.chatr.app.sms.ACTION_REPLY"
        const val ACTION_MARK_READ = "com.chatr.app.sms.ACTION_MARK_READ"
        const val EXTRA_ADDRESS = "address"
        const val EXTRA_CONVERSATION_ID = "conversation_id"
        const val KEY_TEXT_REPLY = "native_sms_reply"
        private const val TAG = "NativeSmsAction"
    }
}
