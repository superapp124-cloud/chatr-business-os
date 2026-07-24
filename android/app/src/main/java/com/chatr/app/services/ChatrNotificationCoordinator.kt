package com.chatr.app.services

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.telecom.PhoneAccount
import android.telecom.TelecomManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import androidx.core.graphics.drawable.IconCompat
import com.chatr.app.ChatrApplication
import com.chatr.app.ChatrSystemContactSync
import com.chatr.app.webrtc.ShieldIncomingCallActivity
import com.chatr.app.MainActivity
import com.chatr.app.R
import com.chatr.app.receivers.NotificationActionReceiver

object ChatrNotificationCoordinator {

    private const val TAG = "ChatrNotifications"
    private const val CALL_NOTIFICATION_BASE = 100_000
    private const val MESSAGE_NOTIFICATION_BASE = 1_100_000
    private const val DUPLICATE_CALL_ALERT_WINDOW_MS = 12_000L
    private val customMessageSounds = setOf(
        "frog_sms",
        "i_got_5",
        "jetsons",
        "message_notify",
        "trap_text",
    )
    private val messageSoundAliases = mapOf(
        "frog-sms" to "frog_sms",
        "i-got-5" to "i_got_5",
        "message-notify" to "message_notify",
        "notification" to "message_notify",
        "notification_sound" to "message_notify",
        "trap-text" to "trap_text",
    )

    private val recentIncomingCallAlerts =
        java.util.Collections.synchronizedMap(
            object : java.util.LinkedHashMap<String, Long>(128, 0.75f, true) {
                override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Long>): Boolean {
                    return size > 128
                }
            },
        )

    fun showIncomingCall(
        context: Context,
        callId: String,
        callerId: String,
        callerName: String,
        callerAvatar: String?,
        callerPhone: String,
        callType: String,
        conversationId: String,
        source: String = "unknown",
        ringtoneSound: String = "default",
    ) {
        if (callId.isBlank()) {
            Log.w(TAG, "Ignoring incoming call without callId from $source")
            return
        }

        val appContext = context.applicationContext

        if (!registerIncomingCallAlert(appContext, callId)) {
            Log.i(TAG, "Skipping duplicate incoming call alert for $callId from $source")
            return
        }

        val sanitizedCallType = if (callType.equals("video", true)) "video" else "audio"
        val resolvedCallerNumber = resolveCallerNumber(callerPhone, callerName)
        val sanitizedCallerName = ChatrVoipCallRegistry.resolveDisplayName(
            context = appContext,
            callId = callId,
            callerId = callerId,
            proposedName = callerName,
            callerPhone = resolvedCallerNumber.ifBlank { callerPhone },
        )
        val resolvedCallerAvatar = ChatrVoipCallRegistry.resolveAvatar(
            context = appContext,
            callId = callId,
            callerId = callerId,
            proposedAvatar = callerAvatar,
            callerPhone = resolvedCallerNumber.ifBlank { callerPhone },
            proposedName = callerName,
        )
        val callerAddress = resolvedCallerNumber
            .takeIf { it.isNotBlank() }
            ?.let { Uri.fromParts(PhoneAccount.SCHEME_TEL, it, null) }

        Log.i(TAG, "Showing incoming call for $callId from $sanitizedCallerName via $source")

        ChatrVoipCallRegistry.markIncoming(
            context = appContext,
            callId = callId,
            callerId = callerId,
            callerName = sanitizedCallerName,
            callerAvatar = resolvedCallerAvatar,
            callerPhone = resolvedCallerNumber,
            callType = sanitizedCallType,
            conversationId = conversationId,
        )

        try {
            ChatrSystemContactSync.ensureContact(appContext, resolvedCallerNumber, sanitizedCallerName, callerId)
            ChatrSystemContactSync.syncAsync(appContext, resolvedCallerNumber, sanitizedCallerName, callerAvatar, callerId)
        } catch (error: Exception) {
            Log.e(TAG, "Contact sync failed for incoming call $callId", error)
        }

        wakeDevice(appContext)

        var telecomRegistered = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val telecomManager = appContext.getSystemService(android.telecom.TelecomManager::class.java)
                val phoneAccountHandle = android.telecom.PhoneAccountHandle(
                    android.content.ComponentName(appContext, com.chatr.app.services.ChatrConnectionService::class.java),
                    "chatr_calling"
                )

                val extras = android.os.Bundle().apply {
                    putString("call_id", callId)
                    putString("caller_id", callerId)
                    putString("caller_name", sanitizedCallerName)
                    putString("caller_avatar", resolvedCallerAvatar)
                    putString("caller_phone", resolvedCallerNumber)
                    putString("call_type", sanitizedCallType)
                    putString("conversation_id", conversationId)
                }

                val incomingCallExtras = android.os.Bundle().apply {
                    putParcelable(android.telecom.TelecomManager.EXTRA_INCOMING_CALL_EXTRAS, extras)
                }

                telecomManager?.addNewIncomingCall(phoneAccountHandle, incomingCallExtras)
                telecomRegistered = true
                Log.i(TAG, "Incoming call routed to TelecomManager. It will manage the UI.")
                
            } catch (e: Exception) {
                Log.e(TAG, "Failed to route to TelecomManager, falling back to custom notification", e)
            }
        }
        // Always try to prewarm the WebView to make call connection under 2 seconds.
        // On Android 10+ (Q+), background starts are restricted but may succeed if the app
        // has draw overlay permissions, is a managed telecom account, or is granted a temporary window.
        triggerPrewarm(
            context = appContext,
            callId = callId,
            callerId = callerId,
            callerName = sanitizedCallerName,
            callerPhone = resolvedCallerNumber,
            callType = sanitizedCallType,
            conversationId = conversationId,
        )

        val callIntent = Intent(appContext, ShieldIncomingCallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("call_id", callId)
            putExtra("caller_id", callerId)
            putExtra("caller_name", sanitizedCallerName)
            putExtra("caller_avatar", resolvedCallerAvatar)
            putExtra("caller_phone", resolvedCallerNumber)
            putExtra("caller_number", resolvedCallerNumber)
            putExtra("call_type", sanitizedCallType)
            putExtra("conversation_id", conversationId)
        }

        val requestCodeBase = stableRequestCode(callId)
        val fullScreenPendingIntent = PendingIntent.getActivity(
            appContext,
            requestCodeBase,
            callIntent,
            immutablePendingIntentFlags(),
        )

        if (telecomRegistered) {
            Log.i(TAG, "Telecom registered for $callId; it will launch the UI via ChatrConnectionService")
            // Telecom will trigger ChatrConnection.onShowIncomingCallUi()
            // which handles the activity launch.
            return
        }

        Log.i(TAG, "Telecom registration failed or unsupported; falling back to custom notification UI")
        showCallNotification(
            context = appContext,
            callId = callId,
            callerId = callerId,
            callerName = sanitizedCallerName,
            callerAvatar = resolvedCallerAvatar,
            callerPhone = resolvedCallerNumber,
            callType = sanitizedCallType,
            conversationId = conversationId,
            fullScreenIntent = fullScreenPendingIntent,
            ringtoneSound = ringtoneSound,
        )
        launchIncomingCallUi(appContext, fullScreenPendingIntent, callIntent)
    }

    fun triggerIncomingCallFallback(
        context: Context,
        callId: String,
        callerId: String,
        callerName: String,
        callerAvatar: String?,
        callerPhone: String,
        callType: String,
        conversationId: String,
    ) {
        val appContext = context.applicationContext
        val sanitizedCallType = if (callType.equals("video", true)) "video" else "audio"
        val resolvedCallerNumber = resolveCallerNumber(callerPhone, callerName)
        val sanitizedCallerName = ChatrVoipCallRegistry.resolveDisplayName(
            context = appContext,
            callId = callId,
            callerId = callerId,
            proposedName = callerName,
            callerPhone = resolvedCallerNumber.ifBlank { callerPhone },
        )
        val resolvedCallerAvatar = ChatrVoipCallRegistry.resolveAvatar(
            context = appContext,
            callId = callId,
            callerId = callerId,
            proposedAvatar = callerAvatar,
            callerPhone = resolvedCallerNumber.ifBlank { callerPhone },
            proposedName = callerName,
        )

        Log.i(TAG, "Executing high-reliability fallback incoming call UI & notification for $callId")

        ChatrVoipCallRegistry.markIncoming(
            context = appContext,
            callId = callId,
            callerId = callerId,
            callerName = sanitizedCallerName,
            callerAvatar = resolvedCallerAvatar,
            callerPhone = resolvedCallerNumber,
            callType = sanitizedCallType,
            conversationId = conversationId,
        )

        val callIntent = Intent(appContext, ShieldIncomingCallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("call_id", callId)
            putExtra("caller_id", callerId)
            putExtra("caller_name", sanitizedCallerName)
            putExtra("caller_avatar", resolvedCallerAvatar)
            putExtra("caller_phone", resolvedCallerNumber)
            putExtra("caller_number", resolvedCallerNumber)
            putExtra("call_type", sanitizedCallType)
            putExtra("conversation_id", conversationId)
        }

        val requestCodeBase = stableRequestCode(callId)
        val fullScreenPendingIntent = PendingIntent.getActivity(
            appContext,
            requestCodeBase,
            callIntent,
            immutablePendingIntentFlags(),
        )

        showCallNotification(
            context = appContext,
            callId = callId,
            callerId = callerId,
            callerName = sanitizedCallerName,
            callerAvatar = resolvedCallerAvatar,
            callerPhone = resolvedCallerNumber,
            callType = sanitizedCallType,
            conversationId = conversationId,
            fullScreenIntent = fullScreenPendingIntent,
            ringtoneSound = "default", // Fallback typically doesn't have custom sound
        )
        launchIncomingCallUi(appContext, fullScreenPendingIntent, callIntent)
    }

    fun showMessageNotification(
        context: Context,
        senderId: String,
        senderName: String,
        messageText: String,
        conversationId: String,
        notificationSound: String = "default",
        senderAvatar: String? = null,
    ) {
        val appContext = context.applicationContext
        val notificationManager = appContext.getSystemService(NotificationManager::class.java) ?: return
        val notificationSeed = conversationId.ifBlank { senderId.ifBlank { messageText } }
        val safeSenderName = senderName.ifBlank { "Someone" }
        val safeMessageText = messageText.ifBlank { "New message" }
        val avatarIcon = NotificationBranding.avatarIcon(appContext, senderAvatar)

        if (!NotificationManagerCompat.from(appContext).areNotificationsEnabled()) {
            Log.w(TAG, "Notifications are disabled for ${appContext.packageName}; message notification cannot be displayed")
        }

        val openIntent = Intent(appContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (conversationId.isNotBlank()) {
                putExtra("navigate_to", "/chat/$conversationId")
                putExtra("conversation_id", conversationId)
            }
        }
        val openPendingIntent = PendingIntent.getActivity(
            appContext,
            stableRequestCode(notificationSeed),
            openIntent,
            immutablePendingIntentFlags(),
        )

        val remoteInput = RemoteInput.Builder(ChatrFirebaseMessagingService.KEY_TEXT_REPLY)
            .setLabel("Reply...")
            .build()

        val replyIntent = Intent(appContext, NotificationActionReceiver::class.java).apply {
            action = "ACTION_REPLY_MESSAGE"
            putExtra("conversation_id", conversationId)
            putExtra("sender_id", senderId)
        }
        val replyPendingIntent = PendingIntent.getBroadcast(
            appContext,
            stableRequestCode(notificationSeed) + 1,
            replyIntent,
            mutablePendingIntentFlags(),
        )

        val markReadIntent = Intent(appContext, NotificationActionReceiver::class.java).apply {
            action = "ACTION_MARK_READ"
            putExtra("conversation_id", conversationId)
        }
        val markReadPendingIntent = PendingIntent.getBroadcast(
            appContext,
            stableRequestCode(notificationSeed) + 2,
            markReadIntent,
            immutablePendingIntentFlags(),
        )

        val normalizedSound = normalizeMessageSound(notificationSound)
        val preferredChannelId = if (normalizedSound != null) {
            "${ChatrApplication.CHANNEL_MESSAGES}_$normalizedSound"
        } else {
            ChatrApplication.CHANNEL_MESSAGES
        }
        val channelId = if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            notificationManager.getNotificationChannel(preferredChannelId) == null
        ) {
            Log.w(TAG, "Message channel $preferredChannelId is missing; falling back to ${ChatrApplication.CHANNEL_MESSAGES}")
            ChatrApplication.CHANNEL_MESSAGES
        } else {
            preferredChannelId
        }

        val me = Person.Builder()
            .setName("You")
            .build()
        val sender = Person.Builder()
            .setName(safeSenderName)
            .setIcon(
                avatarIcon?.let { IconCompat.createWithBitmap(it) }
                    ?: NotificationBranding.personIcon(appContext),
            )
            .build()
        val messageStyle = NotificationCompat.MessagingStyle(me)
            .addMessage(safeMessageText, System.currentTimeMillis(), sender)

        val notification = NotificationCompat.Builder(appContext, channelId)
            .setSmallIcon(NotificationBranding.SMALL_ICON)
            .setLargeIcon(avatarIcon)
            .setContentTitle(safeSenderName)
            .setContentText(safeMessageText)
            .setStyle(messageStyle)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(openPendingIntent)
            .addAction(
                NotificationCompat.Action.Builder(
                    R.drawable.ic_reply,
                    "Reply",
                    replyPendingIntent,
                ).addRemoteInput(remoteInput)
                    .setAllowGeneratedReplies(true)
                    .build(),
            )
            .addAction(R.drawable.ic_done, "Mark Read", markReadPendingIntent)
            .setGroup("messages")
            .build()

        Log.i(
            TAG,
            "Posting message notification id=${messageNotificationId(notificationSeed)} channel=$channelId seed=$notificationSeed avatar=${!senderAvatar.isNullOrBlank()}",
        )
        notificationManager.notify(messageNotificationId(notificationSeed), notification)
    }

    fun cancelIncomingCallNotification(context: Context, callId: String?) {
        if (callId.isNullOrBlank()) return
        val notificationManager = context.applicationContext.getSystemService(NotificationManager::class.java)
        notificationManager?.cancel(callNotificationId(callId))
        recentIncomingCallAlerts.remove(callId)
    }

    fun cancelMessageNotification(context: Context, notificationSeed: String?) {
        if (notificationSeed.isNullOrBlank()) return
        val notificationManager = context.applicationContext.getSystemService(NotificationManager::class.java)
        notificationManager?.cancel(messageNotificationId(notificationSeed))
    }

    fun messageNotificationIdForSeed(notificationSeed: String): Int {
        return messageNotificationId(notificationSeed)
    }

    private fun showCallNotification(
        context: Context,
        callId: String,
        callerId: String,
        callerName: String,
        callerAvatar: String?,
        callerPhone: String,
        callType: String,
        conversationId: String,
        fullScreenIntent: PendingIntent,
        ringtoneSound: String = "default",
    ) {
        val notificationManager = context.getSystemService(NotificationManager::class.java) ?: return
        val requestCodeBase = stableRequestCode(callId)

        val answerIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = "ACTION_ANSWER_CALL"
            putExtra("call_id", callId)
            putExtra("caller_id", callerId)
            putExtra("caller_name", callerName)
            putExtra("caller_avatar", callerAvatar)
            putExtra("caller_phone", callerPhone)
            putExtra("caller_number", callerPhone)
            putExtra("call_type", callType)
            putExtra("conversation_id", conversationId)
        }
        val answerPendingIntent = PendingIntent.getBroadcast(
            context,
            requestCodeBase + 1,
            answerIntent,
            immutablePendingIntentFlags(),
        )

        val rejectIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = "ACTION_REJECT_CALL"
            putExtra("call_id", callId)
            putExtra("caller_id", callerId)
            putExtra("caller_name", callerName)
            putExtra("caller_avatar", callerAvatar)
            putExtra("caller_phone", callerPhone)
            putExtra("caller_number", callerPhone)
            putExtra("call_type", callType)
            putExtra("conversation_id", conversationId)
        }
        val rejectPendingIntent = PendingIntent.getBroadcast(
            context,
            requestCodeBase + 2,
            rejectIntent,
            immutablePendingIntentFlags(),
        )

        val caller = Person.Builder()
            .setName(callerName)
            .setIcon(NotificationBranding.personIcon(context))
            .build()

        val channelId = if (ringtoneSound != "default" && ringtoneSound.isNotBlank()) {
            "${ChatrApplication.CHANNEL_CALLS_HIGH}_$ringtoneSound"
        } else {
            ChatrApplication.CHANNEL_CALLS_HIGH
        }

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(NotificationBranding.SMALL_ICON)
            .setLargeIcon(NotificationBranding.largeIcon(context))
            .setContentTitle("Incoming ${if (callType == "video") "Video" else "Voice"} Call")
            .setContentText(callerName)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(fullScreenIntent)
            .setFullScreenIntent(fullScreenIntent, true)
            .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, rejectPendingIntent, answerPendingIntent))
            .setTimeoutAfter(60_000)
            .build()

        notificationManager.notify(callNotificationId(callId), notification)
    }

    fun showMissedCall(
        context: Context,
        callId: String,
        callerId: String,
        callerName: String,
        callType: String,
        conversationId: String,
    ) {
        val notificationManager = context.getSystemService(NotificationManager::class.java) ?: return
        val requestCodeBase = stableRequestCode(callId)

        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (conversationId.isNotBlank()) {
                putExtra("navigate_to", "/chat/$conversationId")
            }
        }
        val openPendingIntent = PendingIntent.getActivity(
            context,
            requestCodeBase,
            openIntent,
            immutablePendingIntentFlags(),
        )

        // For Callback Action: route to chat with an auto_call parameter if we want frontend to auto dial, 
        // or just route to chat where call buttons are.
        val callbackIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (conversationId.isNotBlank()) {
                putExtra("navigate_to", "/chat/$conversationId?auto_call=$callType")
            } else {
                putExtra("navigate_to", "/calls")
            }
        }
        val callbackPendingIntent = PendingIntent.getActivity(
            context,
            requestCodeBase + 1,
            callbackIntent,
            immutablePendingIntentFlags(),
        )

        val notification = NotificationCompat.Builder(context, ChatrApplication.CHANNEL_MISSED_CALLS)
            .setSmallIcon(NotificationBranding.SMALL_ICON)
            .setLargeIcon(NotificationBranding.largeIcon(context))
            .setContentTitle("Missed ${if (callType == "video") "Video" else "Voice"} Call")
            .setContentText(callerName)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_MISSED_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(openPendingIntent)
            .addAction(android.R.drawable.sym_action_call, "Call Back", callbackPendingIntent)
            .build()

        notificationManager.notify(callNotificationId(callId), notification)
    }

    private fun triggerPrewarm(
        context: Context,
        callId: String,
        callerId: String,
        callerName: String,
        callerPhone: String,
        callType: String,
        conversationId: String,
    ) {
        val packageName = context.packageName
        Log.i(TAG, "Attempting to prewarm MainActivity for call $callId (package: $packageName)")
        
        val intentsToTry = mutableListOf<Intent>()

        // 1. Explicit Intent using Class reference (Standard way)
        try {
            intentsToTry.add(Intent(context, MainActivity::class.java))
        } catch (e: Throwable) {
            Log.w(TAG, "Could not resolve MainActivity class: ${e.message}")
        }

        // 2. Explicit ComponentName using hardcoded target (useful if context is different classloader)
        try {
            intentsToTry.add(Intent().apply {
                component = android.content.ComponentName(packageName, "com.chatr.app.MainActivity")
            })
        } catch (e: Throwable) {
            Log.w(TAG, "Could not construct explicit ComponentName for MainActivity: ${e.message}")
        }

        // 3. Resolve via Package Manager Launch Intent (Highly robust fallback)
        try {
            context.packageManager.getLaunchIntentForPackage(packageName)?.let { launchIntent ->
                intentsToTry.add(launchIntent)
            }
        } catch (e: Throwable) {
            Log.w(TAG, "Could not query launch intent: ${e.message}")
        }

        // 4. Try the ChatrCallsActivity alias
        try {
            intentsToTry.add(Intent().apply {
                component = android.content.ComponentName(packageName, "com.chatr.app.ChatrCallsActivity")
            })
        } catch (e: Throwable) {
            Log.w(TAG, "Could not construct explicit ComponentName for ChatrCallsActivity: ${e.message}")
        }

        var success = false
        var lastError: Throwable? = null

        for ((index, baseIntent) in intentsToTry.withIndex()) {
            try {
                val prewarmIntent = baseIntent.apply {
                    action = Intent.ACTION_VIEW
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_NO_USER_ACTION or
                            Intent.FLAG_ACTIVITY_SINGLE_TOP
                    putExtra("action", "prewarm_call")
                    putExtra("call_id", callId)
                    putExtra("caller_id", callerId)
                    putExtra("caller_name", callerName)
                    putExtra("caller_phone", callerPhone)
                    putExtra("caller_number", callerPhone)
                    putExtra("call_type", callType)
                    putExtra("conversation_id", conversationId)
                }
                
                context.startActivity(prewarmIntent)
                Log.i(TAG, "Prewarm triggered successfully using candidate $index: ${prewarmIntent.component ?: prewarmIntent.action}")
                success = true
                break
            } catch (error: Throwable) {
                lastError = error
                Log.d(TAG, "Candidate $index failed to prewarm: ${error.message}")
            }
        }

        if (!success) {
            Log.e(TAG, "Failed to trigger prewarm for $callId after trying all candidates", lastError)
        }
    }

    private fun launchIncomingCallUi(
        context: Context,
        fullScreenPendingIntent: PendingIntent,
        callIntent: Intent,
    ) {
        try {
            fullScreenPendingIntent.send()
            Log.i(TAG, "Requested ShieldIncomingCallActivity via fullscreen PendingIntent")
            return
        } catch (error: PendingIntent.CanceledException) {
            Log.w(TAG, "Fullscreen PendingIntent was cancelled, trying direct launch", error)
        } catch (error: Exception) {
            Log.w(TAG, "Fullscreen PendingIntent launch failed, trying direct launch", error)
        }

        try {
            context.startActivity(callIntent)
            Log.i(TAG, "Launched ShieldIncomingCallActivity directly")
        } catch (error: Exception) {
            Log.e(TAG, "Failed to launch ShieldIncomingCallActivity directly", error)
        }
    }

    private fun wakeDevice(context: Context) {
        try {
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
            val wakeLock = powerManager.newWakeLock(
                PowerManager.FULL_WAKE_LOCK or
                    PowerManager.ACQUIRE_CAUSES_WAKEUP or
                    PowerManager.ON_AFTER_RELEASE,
                "chatr:incoming_call",
            )
            wakeLock.acquire(30_000)
        } catch (error: Exception) {
            Log.e(TAG, "Failed to wake device", error)
        }
    }

    private fun registerIncomingCallAlert(context: Context, callId: String): Boolean {
        val now = System.currentTimeMillis()
        val lastAlertAt = recentIncomingCallAlerts[callId]
        if (lastAlertAt != null && now - lastAlertAt < DUPLICATE_CALL_ALERT_WINDOW_MS) {
            return false
        }
        if (!ChatrVoipCallRegistry.registerIncomingAlert(context, callId, DUPLICATE_CALL_ALERT_WINDOW_MS)) {
            return false
        }
        recentIncomingCallAlerts[callId] = now
        return true
    }

    private fun resolveCallerNumber(primary: String?, fallback: String?): String {
        val candidates = listOf(primary, fallback)
        for (candidate in candidates) {
            val sanitized = candidate
                ?.trim()
                ?.replace(Regex("[^+\\d]"), "")
                .orEmpty()
            if (sanitized.any { it.isDigit() }) {
                return sanitized
            }
        }
        return ""
    }

    private fun normalizeMessageSound(sound: String?): String? {
        val raw = sound?.trim()
        if (raw.isNullOrBlank() || raw.equals("default", true)) return null

        val fileName = raw
            .substringAfterLast('/')
            .substringAfterLast('\\')
            .substringBeforeLast('.', raw)
        val canonical = messageSoundAliases[fileName.lowercase()]
            ?: fileName
                .lowercase()
                .replace(Regex("[^a-z0-9]+"), "_")
                .trim('_')

        if (canonical in customMessageSounds) {
            return canonical
        }

        Log.w(TAG, "Unknown message notification sound '$sound'; using base message channel")
        return null
    }

    fun stableRequestCode(value: String): Int {
        if (value.isBlank()) {
            return (System.currentTimeMillis() and 0x7fffffffL).toInt()
        }
        return value.hashCode() and 0x7fffffff
    }

    private fun callNotificationId(callId: String): Int {
        return CALL_NOTIFICATION_BASE + (stableRequestCode(callId) % 900_000)
    }

    private fun messageNotificationId(seed: String): Int {
        return MESSAGE_NOTIFICATION_BASE + (stableRequestCode(seed) % 900_000)
    }

    private fun immutablePendingIntentFlags(): Int {
        return PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    }

    private fun mutablePendingIntentFlags(): Int {
        return PendingIntent.FLAG_UPDATE_CURRENT or
            (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
    }
}
