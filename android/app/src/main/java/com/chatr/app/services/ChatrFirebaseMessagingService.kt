package com.chatr.app.services

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.chatr.app.ChatrApplication
import com.chatr.app.MainActivity
import com.chatr.app.R
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.chatr.app.auth.NativeAuthManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Handles data-first FCM delivery for calls, messages, and urgent alerts.
 */
class ChatrFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "ChatrFCM"
        const val KEY_TEXT_REPLY = "key_text_reply"

        private val processedIds =
            java.util.Collections.synchronizedMap(
                object : java.util.LinkedHashMap<String, Long>(101, 0.75f, true) {
                    override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Long>): Boolean {
                        return size > 100
                    }
                },
            )

        private fun isDuplicate(id: String?): Boolean {
            if (id.isNullOrBlank()) return false
            val now = System.currentTimeMillis()
            val lastTime = processedIds[id]
            if (lastTime != null && now - lastTime < 10_000) {
                return true
            }
            processedIds[id] = now
            return false
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.i(TAG, "New FCM token received")
        getSharedPreferences("chatr_prefs", MODE_PRIVATE)
            .edit()
            .putString("pending_fcm_token", token)
            .apply()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val messageId = message.messageId
        if (isDuplicate(messageId)) {
            Log.i(TAG, "Ignoring duplicate FCM messageId: $messageId")
            return
        }

        val data = message.data
        val callId = data["call_id"] ?: data["callId"]
        if (callId != null && isDuplicate("call_$callId")) {
            Log.i(TAG, "Ignoring duplicate FCM for call_id: $callId")
            return
        }

        val resolvedType = resolveNotificationType(data, message)
        val resolvedCallId = data["call_id"] ?: data["callId"] ?: "missing"
        Log.i(TAG, "FCM message received with keys: ${data.keys}")
        Log.i(TAG, "FCM resolvedType=$resolvedType callId=$resolvedCallId payload=$data")

        when (resolvedType) {
            "call" -> handleCallNotification(data)
            "missed_call" -> handleMissedCallNotification(data)
            "message", "chat", "chat_message" -> handleMessageNotification(data, message)
            "urgent", "alert" -> handleUrgentNotification(data, message)
            else -> handleGenericNotification(data, message)
        }
    }

    private fun resolveNotificationType(
        data: Map<String, String>,
        message: RemoteMessage,
    ): String {
        val explicitType = data["type"]
            ?: data["notificationType"]
            ?: data["notification_type"]

        if (!explicitType.isNullOrBlank()) {
            val normalizedType = explicitType.lowercase()
            return when {
                normalizedType == "incoming_call" -> "call"
                normalizedType == "missed_call" -> "missed_call"
                normalizedType.contains("message") || normalizedType.contains("chat") -> "message"
                normalizedType.contains("call") && !normalizedType.contains("ended") -> "call"
                else -> normalizedType
            }
        }

        return when {
            data.containsKey("call_id") || data.containsKey("callId") -> "call"
            data.containsKey("message_id") ||
                data.containsKey("messageId") ||
                data.containsKey("conversation_id") ||
                data.containsKey("conversationId") ||
                data.containsKey("messageContent") -> "message"
            message.notification != null -> "message"
            else -> "generic"
        }
    }

    private fun firstDataValue(
        data: Map<String, String>,
        vararg keys: String,
    ): String? {
        for (key in keys) {
            val value = data[key]?.trim()
            if (!value.isNullOrBlank()) return value
        }
        return null
    }

    private fun handleCallNotification(data: Map<String, String>) {
        val callId = data["call_id"] ?: data["callId"]
        if (callId.isNullOrBlank()) {
            Log.w(TAG, "Ignoring call notification without call_id. payload=$data")
            return
        }

        val callerPhone = data["caller_phone"] ?: data["callerPhone"] ?: data["caller_number"] ?: ""
        val callerId = data["caller_id"] ?: data["callerId"] ?: ""
        val callerNameFromPayload = data["caller_name"]
            ?: data["callerName"]
            ?: data["sender_name"]
            ?: data["senderName"]
            ?: data["title"]
        val callerName = ChatrVoipCallRegistry.resolveDisplayName(
            context = this,
            callId = callId,
            callerId = callerId,
            proposedName = callerNameFromPayload,
            callerPhone = callerPhone,
        )
        val callerAvatar = data["caller_avatar"] ?: data["callerAvatar"]
        val conversationId = data["conversation_id"] ?: data["conversationId"] ?: ""
        val callType = resolveCallType(data)
        val ringtoneSound = data["ringtone_sound"] ?: data["ringtoneSound"] ?: "default"

        ChatrVoipCallRegistry.markIncoming(
            context = this,
            callId = callId,
            callerId = callerId,
            callerName = callerName,
            callerAvatar = callerAvatar,
            callerPhone = callerPhone,
            callType = callType,
            conversationId = conversationId,
        )

        Log.i(TAG, "Handling call notification for $callId from $callerName / $callerPhone")

        // 1. Prewarm JWT immediately on push receipt
        CoroutineScope(Dispatchers.IO).launch {
            NativeAuthManager.getValidTokenAsync(applicationContext)
        }

        // 2. Start VoIPPrewarmService in foreground to hold WakeLock and gather ICE
        VoIPPrewarmService.start(
            context = this,
            callId = callId,
            callerId = callerId,
            callType = callType
        )

        ChatrNotificationCoordinator.showIncomingCall(
            context = this,
            callId = callId,
            callerId = callerId,
            callerName = callerName,
            callerAvatar = callerAvatar,
            callerPhone = callerPhone,
            callType = callType,
            conversationId = conversationId,
            source = "fcm",
            ringtoneSound = ringtoneSound,
        )
    }

    private fun handleMissedCallNotification(data: Map<String, String>) {
        val callId = data["call_id"] ?: data["callId"] ?: return
        val callerName = data["caller_name"] ?: data["callerName"] ?: "Unknown Caller"
        val callType = resolveCallType(data)
        val callerId = data["caller_id"] ?: data["callerId"] ?: ""
        val conversationId = data["conversation_id"] ?: data["conversationId"] ?: ""
        
        Log.i(TAG, "Handling missed call notification for $callId from $callerName")
        
        // Use ChatrNotificationCoordinator to show missed call push
        ChatrNotificationCoordinator.showMissedCall(
            context = this,
            callId = callId,
            callerId = callerId,
            callerName = callerName,
            callType = callType,
            conversationId = conversationId,
        )
    }

    private fun handleMessageNotification(
        data: Map<String, String>,
        message: RemoteMessage,
    ) {
        val senderId = firstDataValue(data, "sender_id", "senderId", "from_id", "fromId", "user_id")
            ?: ""
        val senderName = firstDataValue(
            data,
            "sender_name",
            "senderName",
            "from_name",
            "fromName",
            "sender",
            "title",
        )
            ?: message.notification?.title
            ?: "Someone"
        val messageText = firstDataValue(
            data,
            "message",
            "body",
            "content",
            "text",
            "message_content",
            "messageContent",
            "message_preview",
            "preview",
        )
            ?: message.notification?.body
            ?: "New message"
        val conversationId = firstDataValue(
            data,
            "conversation_id",
            "conversationId",
            "chat_id",
            "chatId",
            "room_id",
            "group_id",
            "groupId",
        )
            ?: ""
        val notificationSound = firstDataValue(
            data,
            "notification_sound",
            "notificationSound",
            "custom_notification_sound",
            "default_notification_sound",
            "sound",
        )
            ?: "default"
        val senderAvatar = firstDataValue(
            data,
            "sender_avatar",
            "senderAvatar",
            "avatar_url",
            "avatarUrl",
            "profile_avatar",
            "profileAvatar",
            "photo_url",
            "photoUrl",
            "image",
            "icon",
        )

        Log.i(
            TAG,
            "Posting message notification conversationId=$conversationId senderId=$senderId sound=$notificationSound avatar=${!senderAvatar.isNullOrBlank()}",
        )

        ChatrNotificationCoordinator.showMessageNotification(
            context = this,
            senderId = senderId,
            senderName = senderName,
            messageText = messageText,
            conversationId = conversationId,
            notificationSound = notificationSound,
            senderAvatar = senderAvatar,
        )
    }

    private fun handleUrgentNotification(
        data: Map<String, String>,
        message: RemoteMessage,
    ) {
        val title = firstDataValue(data, "title", "sender_name", "senderName")
            ?: message.notification?.title
            ?: "Urgent Alert"
        val body = firstDataValue(data, "body", "message", "content", "messageContent")
            ?: message.notification?.body
            ?: "Urgent notification"
        val clickAction = firstDataValue(data, "click_action", "clickAction", "route", "url") ?: ""

        val notificationManager = getSystemService(NotificationManager::class.java) ?: return

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (clickAction.isNotBlank()) {
                putExtra("navigate_to", clickAction)
            }
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            ChatrNotificationCoordinator.stableRequestCode(title + body),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(this, ChatrApplication.CHANNEL_URGENT)
            .setSmallIcon(NotificationBranding.SMALL_ICON)
            .setLargeIcon(NotificationBranding.largeIcon(this))
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(ChatrNotificationCoordinator.stableRequestCode(title + body), notification)
    }

    private fun handleGenericNotification(
        data: Map<String, String>,
        message: RemoteMessage,
    ) {
        val title = firstDataValue(data, "title", "sender_name", "senderName")
            ?: message.notification?.title
            ?: "Chatr+"
        val body = firstDataValue(
            data,
            "body",
            "message",
            "content",
            "text",
            "message_content",
            "messageContent",
            "message_preview",
            "preview",
        )
            ?: message.notification?.body
            ?: return
        val clickAction = firstDataValue(data, "click_action", "clickAction", "route", "url") ?: ""

        val notificationManager = getSystemService(NotificationManager::class.java) ?: return

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (clickAction.isNotBlank()) {
                putExtra("navigate_to", clickAction)
            }
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            ChatrNotificationCoordinator.stableRequestCode(title + body),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(this, ChatrApplication.CHANNEL_MESSAGES)
            .setSmallIcon(NotificationBranding.SMALL_ICON)
            .setLargeIcon(NotificationBranding.largeIcon(this))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(ChatrNotificationCoordinator.stableRequestCode(title + body), notification)
    }

    private fun resolveCallType(data: Map<String, String>): String {
        val explicitType = data["call_type"] ?: data["callType"]
        if (!explicitType.isNullOrBlank()) {
            return if (explicitType.equals("video", true)) "video" else "audio"
        }

        val isVideo = data["is_video"] ?: data["isVideo"]
        return if (isVideo.equals("true", true)) "video" else "audio"
    }
}
