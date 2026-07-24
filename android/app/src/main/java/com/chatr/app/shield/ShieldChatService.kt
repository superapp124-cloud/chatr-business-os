package com.chatr.app.shield

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.util.Log
import com.chatr.app.BuildConfig
import com.chatr.app.auth.NativeAuthManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class ShieldChatService : Service() {

    private val serviceJob = Job()
    private val serviceScope = CoroutineScope(Dispatchers.IO + serviceJob)
    private val client = OkHttpClient()
    private lateinit var database: ShieldDatabase

    companion object {
        private const val TAG = "ShieldChatService"
        private const val ACTION_START = "ACTION_START"
        private const val ACTION_STOP = "ACTION_STOP"
        private const val ACTION_SEND_MESSAGE = "ACTION_SEND_MESSAGE"

        fun start(context: Context, conversationId: String) {
            val intent = Intent(context, ShieldChatService::class.java).apply {
                action = ACTION_START
                putExtra("conversation_id", conversationId)
            }
            context.startService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, ShieldChatService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }

        fun sendMessage(context: Context, messageId: String, conversationId: String, content: String) {
            val intent = Intent(context, ShieldChatService::class.java).apply {
                action = ACTION_SEND_MESSAGE
                putExtra("message_id", messageId)
                putExtra("conversation_id", conversationId)
                putExtra("content", content)
            }
            context.startService(intent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        database = ShieldDatabase.get(applicationContext)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val conversationId = intent.getStringExtra("conversation_id") ?: return START_NOT_STICKY
                startPolling(conversationId)
            }
            ACTION_STOP -> {
                stopSelf()
            }
            ACTION_SEND_MESSAGE -> {
                val messageId = intent.getStringExtra("message_id") ?: return START_NOT_STICKY
                val conversationId = intent.getStringExtra("conversation_id") ?: return START_NOT_STICKY
                val content = intent.getStringExtra("content") ?: return START_NOT_STICKY
                sendMessageToSupabase(messageId, conversationId, content)
            }
        }
        return START_STICKY
    }

    private fun startPolling(conversationId: String) {
        serviceScope.launch {
            var lastCheckedAt = System.currentTimeMillis() - 10000 // Look back 10s initially
            
            while (true) {
                try {
                    val token = NativeAuthManager.getValidTokenBlocking(applicationContext)
                    if (!token.isNullOrEmpty()) {
                        val timestampISO = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
                            timeZone = java.util.TimeZone.getTimeZone("UTC")
                        }.format(java.util.Date(lastCheckedAt))
                        
                        val url = "${BuildConfig.SUPABASE_URL}/rest/v1/messages?conversation_id=eq.$conversationId&created_at=gt.$timestampISO&order=created_at.asc"
                        
                        val request = Request.Builder()
                            .url(url)
                            .header("apikey", BuildConfig.SUPABASE_KEY)
                            .header("Authorization", "Bearer $token")
                            .build()
                            
                        val response = client.newCall(request).execute()
                        val body = response.body?.string()
                        
                        if (response.isSuccessful && !body.isNullOrBlank() && body != "[]") {
                            val array = org.json.JSONArray(body)
                            var maxTimestamp = lastCheckedAt
                            for (i in 0 until array.length()) {
                                val obj = array.getJSONObject(i)
                                val id = obj.getString("id")
                                val senderId = obj.getString("sender_id")
                                val content = obj.getString("content")
                                val createdAtStr = obj.getString("created_at")
                                
                                val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US)
                                sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
                                val time = try { sdf.parse(createdAtStr.take(19))?.time ?: System.currentTimeMillis() } catch(e: Exception) { System.currentTimeMillis() }
                                
                                if (time > maxTimestamp) {
                                    maxTimestamp = time
                                }
                                
                                val entity = ShieldChatMessageEntity(
                                    id = id,
                                    conversationId = conversationId,
                                    senderId = senderId,
                                    content = content,
                                    createdAt = time,
                                    status = "delivered"
                                )
                                database.dao().upsertChatMessage(entity)
                            }
                            lastCheckedAt = maxTimestamp
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error polling messages", e)
                }
                delay(2000) // Poll every 2 seconds during active call
            }
        }
    }

    private fun sendMessageToSupabase(messageId: String, conversationId: String, content: String) {
        serviceScope.launch {
            try {
                val token = NativeAuthManager.getValidTokenBlocking(applicationContext)
                if (token.isNullOrEmpty()) return@launch
                
                val myUserId = applicationContext.getSharedPreferences("chatr_prefs", Context.MODE_PRIVATE).getString("user_id", "") ?: ""
                
                val json = JSONObject().apply {
                    put("id", messageId)
                    put("conversation_id", conversationId)
                    put("sender_id", myUserId)
                    put("content", content)
                }
                
                val body = json.toString().toRequestBody("application/json".toMediaType())
                
                val request = Request.Builder()
                    .url("${BuildConfig.SUPABASE_URL}/rest/v1/messages")
                    .header("apikey", BuildConfig.SUPABASE_KEY)
                    .header("Authorization", "Bearer $token")
                    .header("Prefer", "return=minimal")
                    .post(body)
                    .build()
                    
                val response = client.newCall(request).execute()
                
                if (response.isSuccessful) {
                    // Update status in Room
                    val entity = ShieldChatMessageEntity(
                        id = messageId,
                        conversationId = conversationId,
                        senderId = myUserId,
                        content = content,
                        createdAt = System.currentTimeMillis(),
                        status = "sent"
                    )
                    database.dao().upsertChatMessage(entity)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send message to Supabase", e)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceJob.cancel()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
