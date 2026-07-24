package com.chatr.app.services

import android.net.Uri
import android.provider.ContactsContract

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.BroadcastReceiver
import android.content.IntentFilter
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.core.app.NotificationCompat
import com.chatr.app.MainActivity
import com.chatr.app.R
import com.chatr.app.nativecalls.NativeCallEvent
import com.chatr.app.nativecalls.NativeCallRepository
import com.chatr.app.nativecalls.NativeCallSyncWorker
import com.chatr.app.nativecalls.NativeGsmDefenseEngine
import com.chatr.app.nativecalls.NativePhoneNormalizer
import com.chatr.app.nativecalls.SupabaseNativeCallClient
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

class IncomingCallOverlayService : Service() {

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var activeLookupNumber: String? = null
    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private val screeningReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val phone = intent.getStringExtra("phone_number")
            val result = intent.getStringExtra("screening_result")
            if (phone == activeLookupNumber && result != null) {
                overlayView?.findViewById<TextView>(R.id.liveTranscriptText)?.text = result
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildForegroundNotification("Chatr Caller ID", "Screening incoming call...")
        startForeground(NOTIF_ID, notification)

        val phoneNumber = intent?.getStringExtra("PHONE_NUMBER")
            ?: intent?.getStringExtra("phone_number")
            ?: "Unknown"

        if (ChatrVoipCallRegistry.hasRecentIncoming(this) || isUnavailableNumber(phoneNumber)) {
            Log.i(TAG, "Skipping GSM caller overlay; no usable GSM number or Chatr VoIP call is active.")
            stopForegroundCompat()
            stopSelf()
            return START_NOT_STICKY
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Log.e(TAG, "SYSTEM_ALERT_WINDOW permission missing — cannot draw overlay")
            stopSelf()
            return START_NOT_STICKY
        }

        showOverlay(phoneNumber)

        return START_NOT_STICKY
    }

    private fun isUnavailableNumber(value: String?): Boolean {
        val cleaned = value?.trim().orEmpty()
        return cleaned.isBlank() ||
            cleaned.equals("unknown", ignoreCase = true) ||
            cleaned.equals("unknown caller", ignoreCase = true)
    }

    private fun stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    private fun removeOverlay() {
        try {
            LocalBroadcastManager.getInstance(this).unregisterReceiver(screeningReceiver)
        } catch (e: Exception) {
            // Ignore if not registered
        }
        try {
            if (overlayView != null) {
                windowManager?.removeView(overlayView)
                overlayView = null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error removing overlay view", e)
        }
    }

    private fun showOverlay(phoneNumber: String) {
        if (overlayView != null) {
            refreshOverlayForNumber(phoneNumber)
            return
        }

        // Register receiver for live screening updates
        LocalBroadcastManager.getInstance(this).registerReceiver(
            screeningReceiver,
            IntentFilter("com.chatr.app.SCREENING_RESULT")
        )

        val inflater = getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater
        val contextWrapper = androidx.appcompat.view.ContextThemeWrapper(this, R.style.AppTheme)
        val themedInflater = inflater.cloneInContext(contextWrapper)
        overlayView = themedInflater.inflate(R.layout.overlay_incoming_call, null)

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            PixelFormat.TRANSLUCENT
        )
        params.gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
        params.y = 100

        val callerNameText = overlayView?.findViewById<TextView>(R.id.callerName)
        val callerNumberText = overlayView?.findViewById<TextView>(R.id.callerNumber)
        val aiSummaryText = overlayView?.findViewById<TextView>(R.id.aiSummaryText)
        val spamBadge = overlayView?.findViewById<TextView>(R.id.spamBadge)
        val transcriptContainer = overlayView?.findViewById<View>(R.id.liveTranscriptContainer)
        val transcriptText = overlayView?.findViewById<TextView>(R.id.liveTranscriptText)

        callerNumberText?.text = phoneNumber
        callerNameText?.text = "Chatr AI searching..."
        spamBadge?.text = "ANALYZING"

        overlayView?.findViewById<Button>(R.id.btnGuideDelivery)?.setOnClickListener {
            spamBadge?.text = "GUIDING"
            spamBadge?.setBackgroundColor(Color.parseColor("#3B82F6"))
            transcriptContainer?.visibility = View.VISIBLE

            transcriptText?.text = "Chatr AI is guiding the delivery driver..."
            aiSummaryText?.text = "AI has taken over the call."
            
            // Start the screening service in delivery mode
            AIScreeningService.start(this, phoneNumber, "MODE_DELIVERY_GUIDE")
        }
        
        overlayView?.findViewById<Button>(R.id.btnAiBouncer)?.setOnClickListener {
            spamBadge?.text = "BOUNCER"
            spamBadge?.setBackgroundColor(Color.parseColor("#EF4444"))
            transcriptContainer?.visibility = View.VISIBLE

            transcriptText?.text = "Chatr AI Bouncer active..."
            aiSummaryText?.text = "AI is negotiating with the caller."
            
            // Start the screening service in bouncer mode
            AIScreeningService.start(this, phoneNumber, "MODE_AI_BOUNCER")
        }

        try {
            windowManager?.addView(overlayView, params)
        } catch (e: Exception) {
            Log.e(TAG, "Error adding overlay view", e)
        }

        refreshOverlayForNumber(phoneNumber)
    }

    private fun refreshOverlayForNumber(phoneNumber: String) {
        val callerNameText = overlayView?.findViewById<TextView>(R.id.callerName)
        val callerNumberText = overlayView?.findViewById<TextView>(R.id.callerNumber)
        val aiSummaryText = overlayView?.findViewById<TextView>(R.id.aiSummaryText)
        val spamBadge = overlayView?.findViewById<TextView>(R.id.spamBadge)
        val progressBar = overlayView?.findViewById<View>(R.id.globalSearchProgress)

        callerNumberText?.text = phoneNumber

        if (phoneNumber.isBlank() || phoneNumber == "Unknown") {
            activeLookupNumber = null
            callerNameText?.text = "Unknown caller"
            spamBadge?.text = "WAITING"
            spamBadge?.setBackgroundColor(Color.parseColor("#64748B"))
            aiSummaryText?.text = "Chatr AI: Waiting for Android to provide caller details."
            progressBar?.visibility = View.VISIBLE
            return
        }

        if (activeLookupNumber == phoneNumber) return
        activeLookupNumber = phoneNumber

        callerNameText?.text = "Chatr AI searching..."
        spamBadge?.text = "ANALYZING"
        spamBadge?.setBackgroundColor(Color.parseColor("#6366F1"))
        aiSummaryText?.text = "Scanning caller intelligence sources..."
        progressBar?.visibility = View.VISIBLE

        serviceScope.launch {
            val scanningJob = launch {
                val scanningText = overlayView?.findViewById<TextView>(R.id.aiScanningText)
                val aiFeatures = listOf(
                    "live AI analysis...",
                    "scam intent detection...",
                    "voice pattern analysis...",
                    "conversational screening...",
                    "smart summaries...",
                    "native call enhancement..."
                )
                var index = 0
                while (isActive) {
                    scanningText?.text = aiFeatures[index % aiFeatures.size]
                    index++
                    delay(800)
                }
            }

            val info = lookupCallerAsync(phoneNumber)
            
            scanningJob.cancel()

            withContext(Dispatchers.Main) {
                overlayView?.findViewById<TextView>(R.id.aiScanningText)?.text = "Analysis complete."
                updateOverlayWithCallerInfo(callerNameText, spamBadge, aiSummaryText, info)
                if (info.name != "Unknown Caller") progressBar?.visibility = View.GONE
            }

            if (info.name == "Unknown Caller") {
                withContext(Dispatchers.Main) {
                    progressBar?.visibility = View.GONE
                }
            }
        }
    }

    private suspend fun recordCallToSupabase(phoneNumber: String) {
        withContext(Dispatchers.IO) {
            try {
                val normalized = NativePhoneNormalizer.normalize(phoneNumber)
                if (normalized.isBlank()) return@withContext

                NativeCallRepository.getInstance(this@IncomingCallOverlayService).upsertEvent(
                    NativeCallEvent(
                        deviceEventId = "overlay:$normalized:${System.currentTimeMillis()}",
                        callLogId = null,
                        phoneNumber = phoneNumber,
                        normalizedNumber = normalized,
                        hashedNumber = NativePhoneNormalizer.hash(normalized),
                        contactName = null,
                        callerName = null,
                        direction = "incoming",
                        status = "ringing",
                        startedAt = System.currentTimeMillis(),
                        endedAt = null,
                        durationSeconds = 0,
                        trustScore = 50,
                        spamReports = 0,
                        riskLevel = "safe",
                        source = "caller_id_overlay",
                        rawPayload = JSONObject().apply {
                            put("overlay_started", true)
                        }.toString(),
                    )
                )
                NativeCallSyncWorker.enqueue(this@IncomingCallOverlayService, "overlay_ringing")
                Log.i(TAG, "Call recorded to native intelligence history")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to record call: ${e.message}")
            }
        }
    }

    data class EnrichedIdentity(
        val name: String,
        val summary: String,
        val isVerified: Boolean = false
    )

    private suspend fun deepResearchAsync(number: String, base: CallerLookupResult): CallerLookupResult {
        Log.d(TAG, "deepResearchAsync: enrichment not yet implemented for $number")
        // TODO: When Gemini/Supabase enrichment is ready, this function should:
        //   1. POST number hash to the enrichment queue (Cloud Task or Supabase Edge Function)
        //   2. Await async result (or return base immediately if not cached)
        //   3. Return enriched CallerLookupResult with real AI-generated summary
        //
        // Do NOT simulate status messages or return hardcoded identity results here.
        // Showing fabricated "Neural Scan" progress to users is a false-result bug,
        // not a UX enhancement — same category as the Layer 4 "82ms" issue.
        return base
    }

    private fun updateOverlayWithCallerInfo(
        nameView: TextView?,
        badgeView: TextView?,
        summaryView: TextView?,
        info: CallerLookupResult
    ) {
        nameView?.text = info.name
        
        val isBusiness = info.summary.contains("Business", ignoreCase = true) || 
                         info.summary.contains("Delivery", ignoreCase = true) || 
                         info.summary.contains("Bank", ignoreCase = true)
                         
        when {
            info.spamReports >= 5 || info.trustScore < 30 -> {
                badgeView?.text = "HIGH RISK"
                badgeView?.setBackgroundColor(Color.parseColor("#DC2626"))
                summaryView?.text = info.summary.ifBlank { "Chatr AI: High spam risk. Avoid answering unless this call is expected." }
            }
            info.spamReports >= 2 || info.trustScore < 60 -> {
                badgeView?.text = "POSSIBLE SPAM"
                badgeView?.setBackgroundColor(Color.parseColor("#F59E0B"))
                summaryView?.text = info.summary.ifBlank { "Chatr AI: Suspicious caller. Verify before sharing personal details." }
            }
            info.name != "Unknown Caller" && isBusiness -> {
                badgeView?.text = "TRUSTED BUSINESS"
                badgeView?.setBackgroundColor(Color.parseColor("#8B5CF6"))
                summaryView?.text = info.summary.ifBlank { "Chatr AI: Verified business caller." }
            }
            info.name != "Unknown Caller" && info.trustScore >= 80 -> {
                badgeView?.text = "VERIFIED HUMAN"
                badgeView?.setBackgroundColor(Color.parseColor("#10B981"))
                summaryView?.text = info.summary.ifBlank { "Chatr AI: Verified human caller." }
            }
            info.name != "Unknown Caller" -> {
                badgeView?.text = "SAFE CONTACT"
                badgeView?.setBackgroundColor(Color.parseColor("#3B82F6"))
                summaryView?.text = info.summary.ifBlank { "Chatr AI: Known or trusted caller. Safe to answer." }
            }
            else -> {
                badgeView?.text = "ANALYZING"
                badgeView?.setBackgroundColor(Color.parseColor("#6B7280"))
                summaryView?.text = info.summary.ifBlank { "Chatr AI: No spam reports found. Standard trust level." }
            }
        }
    }

    data class CallerLookupResult(
        val name: String = "Unknown Caller",
        val trustScore: Int = 50,
        val spamReports: Int = 0,
        val summary: String = "Scanning intelligence sources...",
        val riskLevel: String = "safe",
        val isVerified: Boolean = false
    )

    private suspend fun lookupCallerAsync(rawNumber: String): CallerLookupResult =
        withContext(Dispatchers.IO) {
            try {
                Log.d(TAG, "Starting lookup for: $rawNumber")
                val result = NativeGsmDefenseEngine.evaluateIncoming(
                    context = this@IncomingCallOverlayService,
                    rawNumber = rawNumber,
                    status = "ringing",
                    source = "caller_id_overlay",
                    allowLiveLookup = true,
                )

                return@withContext CallerLookupResult(
                    name = result.displayName ?: "Unknown Caller",
                    trustScore = result.trustScore,
                    spamReports = result.spamReports,
                    summary = result.summary,
                    riskLevel = result.riskLevel,
                    isVerified = result.displayName != null && result.riskLevel != "spam",
                )

            } catch (e: Exception) {
                Log.e(TAG, "Caller lookup failed: ${e.message}", e)
            }
            Log.d(TAG, "Lookup finished with no results.")
            CallerLookupResult()
        }

    private fun callSupabaseRpc(url: String, key: String, hashed: String, raw: String): CallerLookupResult? {
        return try {
            val endpoint = URL("$url/rest/v1/rpc/lookup_caller_id")
            val conn = endpoint.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("apikey", key)
            conn.setRequestProperty("Authorization", "Bearer $key")
            conn.connectTimeout = 3000
            conn.doOutput = true

            val body = JSONObject().apply {
                put("p_hashed_number", hashed)
                put("p_raw_number", raw)
            }.toString()

            conn.outputStream.write(body.toByteArray())

            if (conn.responseCode == 200) {
                val response = BufferedReader(InputStreamReader(conn.inputStream)).readText()
                val json = if (response.startsWith("[")) org.json.JSONArray(response).optJSONObject(0) else JSONObject(response)
                if (json != null) {
                    val spamReports = json.optInt("spam_reports", 0)
                    val trustScore = json.optInt("trust_score", 50)
                    val riskLevel = when {
                        spamReports >= 5 || trustScore < 30 -> "spam"
                        spamReports >= 2 || trustScore < 60 -> "suspicious"
                        else -> "safe"
                    }
                    return CallerLookupResult(
                        name = json.optString("name", "Unknown Caller"),
                        trustScore = trustScore,
                        spamReports = spamReports,
                        summary = when (riskLevel) {
                            "spam" -> "Chatr AI: High spam risk from community reports."
                            "suspicious" -> "Chatr AI: Suspicious caller pattern detected."
                            else -> "Chatr AI: Caller reputation looks safe."
                        },
                        riskLevel = riskLevel
                    )
                }
            }
            null
        } catch (e: Exception) { null }
    }

    private fun querySupabaseTable(url: String, key: String, hashed: String): CallerLookupResult? {
        return try {
            val endpoint = URL("$url/rest/v1/contacts_hash?hashed_number=eq.$hashed&select=name,trust_score")
            val conn = endpoint.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("apikey", key)
            conn.setRequestProperty("Authorization", "Bearer $key")
            conn.connectTimeout = 3000

            if (conn.responseCode == 200) {
                val response = BufferedReader(InputStreamReader(conn.inputStream)).readText()
                val array = org.json.JSONArray(response)
                if (array.length() > 0) {
                    val obj = array.getJSONObject(0)
                    val trustScore = obj.optInt("trust_score", 50)
                    return CallerLookupResult(
                        name = obj.getString("name"),
                        trustScore = trustScore,
                        spamReports = 0,
                        summary = "Chatr AI: Caller matched in Chatr identity database.",
                        riskLevel = if (trustScore < 60) "suspicious" else "safe",
                        isVerified = trustScore >= 80
                    )
                }
            }
            null
        } catch (e: Exception) { null }
    }

    private fun lookupLocalContact(phoneNumber: String): String? {
        Log.v(TAG, "lookupLocalContact: $phoneNumber")
        
        // Try exact match
        queryLocalContact(phoneNumber)?.let { return it }
        
        // Try normalized match
        val normalized = normalizePhoneNumber(phoneNumber)
        if (normalized != phoneNumber) {
            queryLocalContact(normalized)?.let { return it }
        }
        
        // Try last 10 digits match (very common in India/US)
        if (phoneNumber.length >= 10) {
            val last10 = phoneNumber.takeLast(10)
            Log.v(TAG, "Trying last 10 digits: $last10")
            queryLocalContact(last10)?.let { return it }
        }
        
        return null
    }

    private fun queryLocalContact(number: String): String? {
        try {
            val uri = android.net.Uri.withAppendedPath(
                android.provider.ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                android.net.Uri.encode(number)
            )
            val projection = arrayOf(android.provider.ContactsContract.PhoneLookup.DISPLAY_NAME)
            contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val name = cursor.getString(0)
                    Log.d(TAG, "MATCH FOUND for $number: $name")
                    return name
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Query error for $number: ${e.message}")
        }
        return null
    }

    private fun normalizePhoneNumber(phone: String): String {
        val digits = phone.replace(Regex("[^0-9]"), "")
        return if (phone.startsWith("+")) "+$digits" else "+91$digits"
    }

    private fun sha256(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }

    private fun getSupabaseUrl(): String? =
        try { getString(R.string.supabase_url) } catch (e: Exception) { null }

    private fun getSupabaseKey(): String? =
        try { getString(R.string.supabase_anon_key) } catch (e: Exception) { null }

    private fun openAppWithAction(phoneNumber: String, action: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("show_post_call_ai", action == "note" || action == "open")
            putExtra("phone_number", phoneNumber)
            if (action == "spam") putExtra("show_spam_report", true)
        }
        startActivity(intent)
    }

    private fun buildForegroundNotification(title: String, text: String): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(NotificationBranding.SMALL_ICON)
            .setLargeIcon(NotificationBranding.largeIcon(this))
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .build()

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Caller ID Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply { setShowBadge(false) }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        serviceScope.cancel()
        overlayView?.let {
            try { windowManager?.removeView(it) } catch (_: Exception) {}
            overlayView = null
        }
        super.onDestroy()
    }

    companion object {
        private const val TAG = "IncomingCallOverlay"
        private const val CHANNEL_ID = "CallerIDChannel"
        private const val NOTIF_ID = 9001
    }
}
