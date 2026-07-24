package com.chatr.app.sms

import android.Manifest
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import androidx.core.content.ContextCompat
import com.chatr.app.ChatrApplication
import com.chatr.app.MainActivity
import com.chatr.app.R
import com.chatr.app.services.NotificationBranding

object NativeSmsNotifier {
    fun showIncoming(context: Context, message: NativeSmsMessage) {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        val appContext = context.applicationContext
        val notificationManager = appContext.getSystemService(NotificationManager::class.java) ?: return
        val openIntent = Intent(appContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "/smart-inbox")
            putExtra("source", "native_sms_notification")
            putExtra("conversation_id", message.conversationId)
        }
        val openPendingIntent = PendingIntent.getActivity(
            appContext,
            stableRequestCode("open_${message.conversationId}"),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val replyIntent = Intent(appContext, NativeSmsActionReceiver::class.java).apply {
            action = NativeSmsActionReceiver.ACTION_REPLY
            putExtra(NativeSmsActionReceiver.EXTRA_ADDRESS, message.address)
            putExtra(NativeSmsActionReceiver.EXTRA_CONVERSATION_ID, message.conversationId)
        }
        val replyPendingIntent = PendingIntent.getBroadcast(
            appContext,
            stableRequestCode("reply_${message.conversationId}"),
            replyIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0,
        )

        val markReadIntent = Intent(appContext, NativeSmsActionReceiver::class.java).apply {
            action = NativeSmsActionReceiver.ACTION_MARK_READ
            putExtra(NativeSmsActionReceiver.EXTRA_CONVERSATION_ID, message.conversationId)
        }
        val markReadPendingIntent = PendingIntent.getBroadcast(
            appContext,
            stableRequestCode("read_${message.conversationId}"),
            markReadIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val remoteInput = RemoteInput.Builder(NativeSmsActionReceiver.KEY_TEXT_REPLY)
            .setLabel("Reply")
            .build()
        val sender = Person.Builder()
            .setName(message.displayName.ifBlank { message.address })
            .setKey(message.address)
            .setIcon(NotificationBranding.personIcon(appContext))
            .build()
        val riskPrefix = when {
            message.risk.spamScore >= 80 -> "Scam likely: "
            message.risk.spamScore >= 60 -> "High-risk SMS: "
            message.risk.spamScore >= 35 -> "CHATR Shield: "
            else -> ""
        }
        val content = if (message.risk.spamScore >= 35 && message.risk.summary.isNotBlank()) {
            message.risk.summary
        } else if (message.risk.isOtp && message.risk.otpCode != null) {
            "OTP detected: ${message.risk.otpCode}"
        } else {
            message.body
        }

        val publicNotification = NotificationCompat.Builder(appContext, ChatrApplication.CHANNEL_MESSAGES)
            .setSmallIcon(if (message.risk.spamScore >= 55) R.drawable.ic_warning else NotificationBranding.SMALL_ICON)
            .setLargeIcon(NotificationBranding.largeIcon(appContext))
            .setContentTitle(if (message.risk.spamScore >= 35) "CHATR Shield alert" else "New SMS")
            .setContentText("Open Chatr+ to view this message")
            .setPriority(if (message.risk.spamScore >= 55) NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openPendingIntent)
            .setAutoCancel(true)
            .build()

        val notification = NotificationCompat.Builder(appContext, ChatrApplication.CHANNEL_MESSAGES)
            .setSmallIcon(if (message.risk.spamScore >= 55) R.drawable.ic_warning else NotificationBranding.SMALL_ICON)
            .setLargeIcon(NotificationBranding.largeIcon(appContext))
            .setContentTitle("${riskPrefix}${message.displayName.ifBlank { message.address }}")
            .setContentText(content)
            .setStyle(
                NotificationCompat.MessagingStyle(sender)
                    .setConversationTitle(message.displayName.ifBlank { message.address })
                    .addMessage(content, message.timestamp, sender),
            )
            .setPriority(if (message.risk.spamScore >= 55) NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setSubText(if (message.risk.spamScore >= 35) "CHATR Shield" else null)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(publicNotification)
            .setContentIntent(openPendingIntent)
            .setAutoCancel(true)
            .addAction(
                NotificationCompat.Action.Builder(R.drawable.ic_reply, "Reply", replyPendingIntent)
                    .addRemoteInput(remoteInput)
                    .setAllowGeneratedReplies(true)
                    .build(),
            )
            .addAction(R.drawable.ic_done, "Mark read", markReadPendingIntent)
            .setGroup("native_sms")
            .build()

        notificationManager.notify(notificationId(message.conversationId), notification)
    }

    fun cancel(context: Context, conversationId: String?) {
        if (conversationId.isNullOrBlank()) return
        context.getSystemService(NotificationManager::class.java)?.cancel(notificationId(conversationId))
    }

    fun notificationId(conversationId: String): Int {
        return 1_900_000 + (stableRequestCode(conversationId) % 90_000)
    }

    private fun stableRequestCode(value: String): Int = value.hashCode() and 0x7fffffff
}
