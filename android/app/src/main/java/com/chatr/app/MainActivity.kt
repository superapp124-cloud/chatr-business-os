package com.chatr.app

import android.Manifest
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.media.AudioDeviceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.telecom.TelecomManager
import android.util.Log
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ConsoleMessage
import android.webkit.WebView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.chatr.app.services.CallBlockingManager
import com.chatr.app.services.ChatrConnectionService
import com.chatr.app.services.CallForegroundService
import com.chatr.app.services.ChatrNotificationCoordinator
import com.chatr.app.services.ChatrVoipCallRegistry
import com.chatr.app.services.InCallOverlayService
import com.chatr.app.services.VoIPBridgeService
import com.chatr.app.nativecallaudio.CallTone
import com.chatr.app.nativecallaudio.ToneManager
import com.chatr.app.nativecalls.NativeCallerProtection
import com.chatr.app.nativecalls.NativeCallRepository
import com.chatr.app.nativecalls.NativeCallSyncWorker
import com.chatr.app.nativecalls.NativeContactResolver
import com.chatr.app.nativecalls.NativeGsmDefenseEngine
import com.chatr.app.nativecalls.PhoneCoreRouter
import com.chatr.app.nativecalls.SupabaseNativeCallClient
import com.chatr.app.plugins.ChatrIntelligencePlugin
import com.chatr.app.plugins.ChatrSafeSmsPlugin
import com.chatr.app.plugins.ChatrShieldPlugin
import com.chatr.app.plugins.OnDeviceAiPlugin
import com.chatr.app.plugins.NativeTTSPlugin
import com.chatr.app.plugins.TelecomInterceptorPlugin
import com.chatr.app.plugins.VoiceTranslationPlugin
import com.chatr.app.plugins.ChatrCallScreeningPlugin
import com.getcapacitor.BridgeActivity
import com.getcapacitor.BridgeWebChromeClient
import java.io.File
import org.json.JSONArray
import org.json.JSONObject
/**
 * Capacitor BridgeActivity with native-to-web coordination for calls and notifications.
 */
class MainActivity : BridgeActivity() {

    companion object {
        private const val TAG = "ChatrMainActivity"
        private const val CALL_ACTION_FILTER = "com.chatr.app.CALL_ACTION"
        private const val STT_REQUEST_ACTION = "com.chatr.app.WEB_STT_REQUEST"
        const val STT_RESULT_ACTION  = "com.chatr.app.WEB_STT_RESULT"
        private const val NATIVE_RUNTIME_BRIDGE = "ChatrNativeRuntime"
        private const val NATIVE_AUTH_BRIDGE = "NativeAuth"
        private const val NATIVE_CALL_BRIDGE = "ChatrCall"
        private const val AUTH_PREFS = "chatr_prefs"
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_USER_ID = "user_id"
        private const val PENDING_EVENTS_PREFS = "chatr_native_events"
        private const val KEY_PENDING_EVENTS = "pending_events"
        private const val CALLBACK_CACHE_PREFS = "chatr_call_callback_cache"
        private const val CALLBACK_UUID_PREFIX = "call_uuid_"
        private const val CALL_BACK_ACTION = "android.telecom.action.CALL_BACK"
        private const val EXTRA_CALLBACK_UUID = "android.telecom.extra.UUID"
        private const val WEBVIEW_CACHE_PREFS = "chatr_webview_cache"
        private const val KEY_LAST_WEBVIEW_CACHE_PURGE_VERSION = "last_purged_version"
        private const val KEY_LAST_WEBVIEW_CACHE_PURGE_FINGERPRINT = "last_purged_fingerprint"
        private const val WEBVIEW_STARTUP_CACHE_SCHEMA_VERSION = 3
        private const val DUPLICATE_INTENT_WINDOW_MS = 1_500L

        private val recentIntentSignatures =
            java.util.Collections.synchronizedMap(
                object : java.util.LinkedHashMap<String, Long>(128, 0.75f, true) {
                    override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Long>): Boolean {
                        return size > 128
                    }
                },
            )
    }

    private var voipBridge: VoIPBridgeService? = null
    private var activeWebView: WebView? = null   // kept for JS-STT injection
    private var webViewCachePurged = false
    private var startupFallbackAttempted = false
    private var webViewBridgeConfigured = false
    private var callAudioFocusRequest: AudioFocusRequest? = null
    private val callAudioFocusChangeListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
        Log.i(TAG, "Call audio focus changed: $focusChange")
    }
    @Volatile
    private var isWebAppReady = false
    private var isActivityVisible = false
    private val pendingEventsPrefs by lazy {
        getSharedPreferences(PENDING_EVENTS_PREFS, MODE_PRIVATE)
    }
    private val callbackCachePrefs by lazy {
        getSharedPreferences(CALLBACK_CACHE_PREFS, MODE_PRIVATE)
    }
    private val nativeContactPermissionsLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
            val readContactsGranted = grants[Manifest.permission.READ_CONTACTS] == true ||
                ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
            val readCallLogGranted = grants[Manifest.permission.READ_CALL_LOG] == true ||
                ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED

            Log.i(
                TAG,
                "Native contact/call permissions changed readContacts=$readContactsGranted readCallLog=$readCallLogGranted",
            )

            if (readCallLogGranted) {
                NativeCallSyncWorker.enqueue(this, "permissions_granted")
            }

            emitNativeEvent(
                "nativeContactPermissionsChanged",
                JSONObject().apply {
                    put("readContacts", readContactsGranted)
                    put("readCallLog", readCallLogGranted)
                },
            )
        }
    private val toneManager by lazy {
        ToneManager.getInstance(applicationContext).also { manager ->
            manager.listener = object : ToneManager.ToneEventListener {
                override fun onToneAutoDisconnect(callId: String?, tone: CallTone) {
                    runOnUiThread {
                        emitNativeEvent(
                            "nativeCallProgressToneEnded",
                            JSONObject().apply {
                                put("callId", callId ?: JSONObject.NULL)
                                put("tone", tone.name)
                                put(
                                    "reason",
                                    when (tone) {
                                        CallTone.BUSY -> "busy_auto_disconnect"
                                        CallTone.FAILED -> "failed_playback_complete"
                                        else -> "tone_complete"
                                    },
                                )
                            },
                        )
                    }
                }
            }
        }
    }

    private val callActionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            intent?.let { handleIntent(it) }
        }
    }

    /**
     * Receives "START_WEB_STT" from InCallOverlayService → injects MediaRecorder
     * into the Capacitor WebView to capture the microphone, bypassing the Android mic lock.
     */
    private val sttRequestReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val stop = intent?.getBooleanExtra("stop", false) ?: false
            runOnUiThread {
                val wv = activeWebView ?: return@runOnUiThread
                if (stop) {
                    wv.evaluateJavascript("if(window.__chatrRecorder && window.__chatrRecorder.state !== 'inactive'){ window.__chatrRecorder.stop(); }", null)
                    return@runOnUiThread
                }
                val js = """
                    (function() {
                        if(window.__chatrRecorder && window.__chatrRecorder.state !== 'inactive'){ window.__chatrRecorder.stop(); }
                        navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
                            var recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                            var chunks = [];
                            recorder.ondataavailable = function(e) { if(e.data.size > 0) chunks.push(e.data); };
                            recorder.onstop = function() {
                                var blob = new Blob(chunks, { type: 'audio/webm' });
                                var reader = new FileReader();
                                reader.readAsDataURL(blob);
                                reader.onloadend = function() {
                                    var b64 = reader.result.split(',')[1];
                                    if(b64) { AndroidNativeSTT.onAudioResult(b64); }
                                };
                                stream.getTracks().forEach(t => t.stop());
                            };
                            recorder.start();
                            window.__chatrRecorder = recorder;
                        }).catch(function(e) {
                            AndroidNativeSTT.onError(e.toString());
                        });
                    })();
                """.trimIndent()
                wv.evaluateJavascript(js, null)
                Log.i(TAG, "WebView MediaRecorder started")
            }
        }
    }

    /** Called from JS MediaRecorder */
    private inner class NativeSTTBridge {
        @JavascriptInterface
        fun onAudioResult(base64: String) {
            // Obsolete WebRTC JS integration removed
        }

        @JavascriptInterface
        fun onError(error: String) {
            // Obsolete WebRTC JS integration removed
        }
    }

    private inner class NativeRuntimeBridge {
        @JavascriptInterface
        fun markWebAppReady() {
            runOnUiThread {
                isWebAppReady = true
                Log.i(TAG, "Web app reported ready")
                flushPendingNativeEvents()
            }
        }

        @JavascriptInterface
        fun getCallerProtectionState(): String {
            return NativeCallerProtection.statusJson(this@MainActivity).toString()
        }

        @JavascriptInterface
        fun getGsmDefenseState(): String {
            return NativeGsmDefenseEngine.stateJson(this@MainActivity).toString()
        }

        @JavascriptInterface
        fun setGsmDefenseFeature(key: String?, enabled: Boolean): String {
            if (!key.isNullOrBlank()) {
                NativeGsmDefenseEngine.setFeature(this@MainActivity, key, enabled)
            }
            return NativeGsmDefenseEngine.stateJson(this@MainActivity).toString()
        }

        @JavascriptInterface
        fun requestCallerProtectionSetup() {
            runOnUiThread {
                NativeCallerProtection.requestSetup(this@MainActivity)
            }
        }

        @JavascriptInterface
        fun requestDefaultDialerSetup() {
            runOnUiThread {
                NativeCallerProtection.requestDefaultDialer(this@MainActivity)
            }
        }

        @JavascriptInterface
        fun requestOutgoingGsmSetup() {
            runOnUiThread {
                if (!NativeCallerProtection.requestCallRedirection(this@MainActivity)) {
                    NativeCallerProtection.requestDefaultDialer(this@MainActivity)
                }
            }
        }

        @JavascriptInterface
        fun requestContactsPermission(): String {
            runOnUiThread {
                nativeContactPermissionsLauncher.launch(
                    arrayOf(
                        Manifest.permission.READ_CONTACTS,
                        Manifest.permission.READ_CALL_LOG,
                    ),
                )
            }
            return NativeCallerProtection.statusJson(this@MainActivity).toString()
        }

        @JavascriptInterface
        fun syncNativeCallLogNow() {
            NativeCallSyncWorker.enqueue(this@MainActivity, "web_manual")
        }

        @JavascriptInterface
        fun getRecentNativeCalls(limit: Int): String {
            return NativeCallRepository.getInstance(this@MainActivity)
                .recentEventsJson(limit.coerceIn(1, 100))
                .toString()
        }

        @JavascriptInterface
        fun getDeviceContacts(limit: Int): String {
            return NativeContactResolver.contactsJson(
                this@MainActivity,
                limit.coerceIn(1, 500),
            ).toString()
        }

        @JavascriptInterface
        fun getDeviceGPTStatus(): String {
            return JSONObject().apply {
                put("mode", "device")
                put("label", "Private local fallback")
                put("model", "CHATR local safety rules")
                put("provider", "Android JS bridge fallback")
                put("isOffline", false)
                put("isNative", false)
                put("geminiOnDevice", false)
                put("privacy", "on_device")
                put("detail", "Gemini Nano is not exposed through this legacy bridge. CHATR uses local safety guidance here and the Capacitor plugin handles real Gemini Nano when available.")
                put(
                    "capabilities",
                    JSONArray().apply {
                        put("Local scam triage")
                        put("Call summary guidance")
                        put("Job safety coaching")
                        put("Medicine and family reminders")
                        put("Bills and recharge planning")
                        put("Daily task planning")
                    },
                )
            }.toString()
        }

        @JavascriptInterface
        fun getAICoreStatus(): String {
            // Note: Actual FeatureStatus query for com.google.mlkit.genai requires the Google Play Services dependency.
            // By default, if the native plugin isn't active, we return unavailable to trigger silent fallback.
            // If the user has a Pixel 8 Pro with AICore, the OnDeviceAiPlugin should override this.
            return "unavailable"
        }

        @JavascriptInterface
        fun geminiNanoGenerate(payload: String?): String {
            val startedAt = SystemClock.elapsedRealtime()
            val query = readDeviceQuery(payload)

            return buildDeviceGptResponse(query).apply {
                put("latencyMs", SystemClock.elapsedRealtime() - startedAt)
                put("provider", "Android JS bridge fallback")
                put("geminiOnDevice", false)
            }.toString()
        }

        @JavascriptInterface
        fun deviceGPT(payload: String?): String {
            val startedAt = SystemClock.elapsedRealtime()
            val query = readDeviceQuery(payload)

            return buildDeviceGptResponse(query).apply {
                put("latencyMs", SystemClock.elapsedRealtime() - startedAt)
            }.toString()
        }

        @JavascriptInterface
        fun setAudioRoute(route: String?): Boolean {
            return applyAudioRoute(route.orEmpty())
        }

        @JavascriptInterface
        fun getAvailableAudioRoutes(): String {
            return try {
                val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                val routes = mutableListOf<String>("earpiece")
                if (audioManager.isSpeakerphoneOn || true) routes.add("speaker")
                if (audioManager.isBluetoothScoAvailableOffCall) routes.add("bluetooth")
                if (audioManager.isWiredHeadsetOn) routes.add("wired")
                val current = when {
                    audioManager.isBluetoothScoOn     -> "bluetooth"
                    audioManager.isSpeakerphoneOn     -> "speaker"
                    audioManager.isWiredHeadsetOn     -> "wired"
                    else                              -> "earpiece"
                }
                org.json.JSONObject().apply {
                    put("available", org.json.JSONArray(routes))
                    put("current", current)
                }.toString()
            } catch (e: Exception) {
                "{\"available\":[\"earpiece\"],\"current\":\"earpiece\"}"
            }
        }

        @JavascriptInterface
        fun setRingtone(name: String?) {
            // Persist the user-chosen ringtone key so IncomingCallActivity can read it
            getSharedPreferences("chatr_settings", MODE_PRIVATE)
                .edit()
                .putString("selected_ringtone_native", name?.trim()?.lowercase() ?: "default")
                .apply()
            Log.i(TAG, "Ringtone preference saved: $name")
        }

        private fun readDeviceQuery(payload: String?): String {
            return try {
                JSONObject(payload.orEmpty()).optString("query", "")
            } catch (error: Exception) {
                payload.orEmpty()
            }
        }

        private fun buildDeviceGptResponse(query: String): JSONObject {
            val lower = query.lowercase()
            var confidence = 0.78
            var model = "CHATR local safety rules"
            val sources = JSONArray()
                .put("CHATR local safety rules")
                .put("CHATR private safety rules")
            val followUp = JSONArray()
            val answer: String = when {
                isAmbientCheckIn(lower) -> {
                    confidence = 0.81
                    model = "CHATR local intelligence rules"
                    followUp.put("Check scam text")
                    followUp.put("Summarize pasted notes")
                    followUp.put("Plan from notes")
                    """
                    CHATR local fallback answer

                    I am active. I will stay quiet until something needs your attention.

                    Right now I can act on:
                    1. Scam Shield: check OTP, bank, UPI, fake recruiter, and suspicious caller patterns.
                    2. Call Copilot: turn call notes into summaries, tasks, reminders, and follow-up messages.
                    3. Life Assistant: manage medicine, bills, recharge, appointments, and daily routines.
                    4. Jobs Engine: verify recruiters, improve resume lines, practice interviews, and draft replies.

                    Best next move: send me the message, call note, job offer, bill, or family reminder that needs attention.

                    Privacy proof: this response used local CHATR rules in the app. No audio, SMS, call notes, or private text was uploaded.
                    """.trimIndent()
                }
                containsAny(lower, listOf("otp", "bank", "upi", "kyc", "pin", "password", "scam", "fraud", "phishing", "suspicious caller", "blocked caller", "caller blocked", "suspicious", "blocked")) -> {
                    confidence = 0.9
                    model = "CHATR local scam shield"
                    followUp.put("Create family warning")
                    followUp.put("Save evidence snapshot")
                    followUp.put("Block sender checklist")
                    """
                    CHATR AI scan: treat this as high-risk until verified.

                    Do this now:
                    1. Do not share OTP, PIN, UPI PIN, card details, or passwords.
                    2. Call the bank or service through an official number you find yourself.
                    3. Block/report the sender if they pressure you or threaten account closure.
                    4. Warn family if the message targets parents, elderly users, or shared accounts.

                    This analysis ran inside CHATR on this phone.
                    """.trimIndent()
                }
                containsAny(lower, listOf("last call", "call summary", "summarize", "meeting notes", "transcript")) -> {
                    confidence = 0.82
                    model = "CHATR local call copilot"
                    followUp.put("Summarize pasted transcript")
                    followUp.put("Create follow-up tasks")
                    followUp.put("Turn call into reminder")
                    """
                    CHATR AI Call Copilot is ready.

                    Choose a recent call from Recents or paste call notes here, and I will create:
                    1. Key points and important names.
                    2. Follow-up tasks, dates, and payment reminders.
                    3. A short version you can share or save.

                    This runs in CHATR local fallback mode unless the Capacitor Gemini route is available.
                    """.trimIndent()
                }
                containsAny(lower, listOf("job", "resume", "cv", "interview", "recruiter", "salary", "offer letter")) -> {
                    when {
                        containsAny(lower, listOf("resume", "cv", "summary", "profile")) -> {
                            confidence = 0.78
                            model = "CHATR local resume helper"
                            followUp.put("Rewrite my summary")
                            followUp.put("Make ATS keywords")
                            followUp.put("Draft cover letter")
                            """
                            CHATR AI resume helper is ready on-device.

                            Paste your current resume summary, skills, or target role and I will rewrite it.

                            Best format:
                            1. Start with role, years of experience, and top skills.
                            2. Add measurable proof: revenue, users, speed, cost saved, tickets closed, or campaigns run.
                            3. Keep it ATS-friendly with plain words and no inflated claims.
                            4. Tailor the first 3 lines to the job before applying.

                            Privacy proof: your resume text can be rewritten locally on this phone.
                            """.trimIndent()
                        }
                        containsAny(lower, listOf("practice interview", "interview practice", "mock interview", "interview answers")) -> {
                            confidence = 0.82
                            model = "CHATR local interview helper"
                            followUp.put("Start HR mock interview")
                            followUp.put("Practice salary answer")
                            followUp.put("Prepare self introduction")
                            """
                            CHATR AI interview practice is ready.

                            We can run this voice-first:
                            1. I ask one interview question at a time.
                            2. You answer naturally.
                            3. I score clarity, confidence, relevance, and salary-risk signals.
                            4. I give a better version you can say in the actual call.

                            Tell me the role, company, and interview type: HR, technical, sales, support, or fresher.
                            """.trimIndent()
                        }
                        containsAny(lower, listOf("fake recruiter", "recruiter", "job offer", "offer letter", "registration fee", "processing fee", "security deposit")) -> {
                            model = "CHATR local jobs helper"
                            if (!hasRecruiterEvidence(lower)) {
                                confidence = 0.72
                                followUp.put("Paste recruiter message")
                                followUp.put("Draft verification questions")
                                followUp.put("Practice interview")
                                """
                                CHATR AI recruiter scan needs evidence.

                                I cannot honestly score this recruiter yet because I only have the request, not the message or offer details.

                                Paste any one of these and I will scan it locally:
                                1. Recruiter WhatsApp/SMS message.
                                2. Email address or company domain.
                                3. Offer letter text or PDF details.
                                4. Salary, role, joining date, and any fee/deposit request.

                                Until then, safest rule: do not pay registration, training, laptop shipment, document verification, or security deposit fees.

                                Privacy proof: the recruiter scan runs on this phone. Nothing is uploaded.
                                """.trimIndent()
                            } else {
                                confidence = 0.86
                                followUp.put("Draft safe recruiter reply")
                                followUp.put("Save evidence snapshot")
                                followUp.put("Practice interview")
                                val severity = if (containsAny(lower, listOf("registration fee", "processing fee", "security deposit", "training fee", "laptop shipment"))) {
                                    "high-risk"
                                } else {
                                    "needs verification"
                                }
                                """
                                CHATR AI recruiter scan: $severity.

                                Do this before replying:
                                1. Verify the company domain and recruiter email. Avoid free email IDs for official offers.
                                2. Ask for role, salary range, interview process, joining date, and reporting manager.
                                3. Refuse any payment request for registration, training, laptop, verification, or security deposit.
                                4. Search the company name plus "scam", "fraud", and "reviews" before sharing documents.

                                I can draft a safe verification reply next.
                                """.trimIndent()
                            }
                        }
                        else -> {
                            confidence = 0.78
                            model = "CHATR local jobs helper"
                            followUp.put("Check fake recruiter")
                            followUp.put("Improve resume summary")
                            followUp.put("Practice interview")
                            """
                            CHATR AI Jobs Engine is active.

                            Tell me your target role, city or remote preference, experience level, expected salary, and 3 strongest skills.

                            I will help with:
                            1. Verified job discovery.
                            2. Fake recruiter detection.
                            3. Resume and cover letter improvement.
                            4. Interview and salary negotiation practice.

                            Everything sensitive can stay in this local fallback unless you choose a connected route.
                            """.trimIndent()
                        }
                    }
                }
                containsAny(lower, listOf("medicine", "tablet", "doctor", "hospital", "mom", "dad", "elder", "health")) -> {
                    confidence = 0.8
                    model = "CHATR local family care"
                    followUp.put("Create medicine reminder")
                    followUp.put("Prepare family call script")
                    followUp.put("Make doctor question list")
                    """
                    CHATR AI Family Care is ready.

                    On-device care plan:
                    1. Confirm the medicine name, dosage, and time.
                    2. Send a simple voice reminder or call the family member.
                    3. If a dose was missed, follow the doctor or pharmacist instructions on the prescription.
                    4. Escalate to family if reminders are missed repeatedly.
                    """.trimIndent()
                }
                containsAny(lower, listOf("recharge", "bill", "subscription", "payment", "due")) -> {
                    confidence = 0.78
                    model = "CHATR local life assistant"
                    followUp.put("Set reminder")
                    followUp.put("Check payment link safety")
                    followUp.put("Build low-data plan")
                    """
                    CHATR AI Life Assistant can manage this offline.

                    Suggested next step:
                    1. Confirm the bill, recharge, or subscription name.
                    2. Set a local reminder before the due date.
                    3. Keep a low-data backup plan if recharge expires soon.
                    4. If payment links arrive by SMS, run Scam Shield before tapping.
                    """.trimIndent()
                }
                else -> {
                    followUp.put("Check scam text")
                    followUp.put("Summarize pasted notes")
                    followUp.put("Plan from notes")
                    """
                    CHATR local fallback answer

                    I do not need cloud AI to start helping with this.

                    Right now I can act on:
                    1. Scam Shield: check OTP, bank, UPI, fake recruiter, and suspicious caller patterns.
                    2. Call Copilot: turn call notes into summaries, tasks, reminders, and follow-up messages.
                    3. Life Assistant: manage medicine, bills, recharge, appointments, and daily routines.
                    4. Jobs Engine: verify recruiters, improve resume lines, practice interviews, and draft replies.

                    Best next move: send me the exact message, call note, job offer, bill, or family reminder that needs attention.

                    Privacy proof: this response used local CHATR rules in the app. No audio, SMS, call notes, or private text was uploaded.
                    """.trimIndent()
                }
            }

            return JSONObject().apply {
                put("answer", answer)
                put("sources", sources)
                put("followUp", followUp)
                put("confidence", confidence)
                put("model", model)
                put("provider", "Android JS bridge fallback")
                put("geminiOnDevice", false)
            }
        }

        private fun containsAny(text: String, needles: List<String>): Boolean {
            return needles.any { needle -> text.contains(needle) }
        }

        private fun isAmbientCheckIn(text: String): Boolean {
            val normalized = text.trim().lowercase()
            return normalized in setOf(
                "ok",
                "okay",
                "yes",
                "start",
                "help",
                "hi",
                "hello",
                "hey",
                "thanks",
                "thank you",
                "what can you do",
                "status",
                "ready"
            ) || containsAny(normalized, listOf("how can you help", "start watching", "private ai", "local ai", "zero cost"))
        }

        private fun hasRecruiterEvidence(text: String): Boolean {
            val normalized = text.trim().lowercase()
            val wordCount = normalized.split(Regex("\\s+")).filter { it.isNotBlank() }.size
            val directEvidencePatterns = listOf(
                Regex("@[\\w.-]+\\.[a-z]{2,}"),
                Regex("https?://"),
                Regex("\\b[a-z0-9-]+\\.(com|in|org|net|co|io|ai)\\b"),
                Regex("\\b\\d{10}\\b"),
                Regex("whatsapp|telegram|gmail|yahoo|outlook"),
                Regex("registration fee|processing fee|security deposit|training fee|laptop shipment|document verification|paytm|upi|send money"),
                Regex("otp|bank|aadhaar|aadhar|pan card|password|account number")
            )
            val recruiterMessagePatterns = listOf(
                Regex("salary|ctc|joining date|joining|offer letter|interview process|reporting manager"),
                Regex("selected|shortlisted|congratulations|dear candidate|walk.?in|urgent hiring"),
                Regex("send documents|share documents|verification|training bond|appointment letter")
            )
            val directHit = directEvidencePatterns.any { pattern -> pattern.containsMatchIn(normalized) }
            val messageHits = recruiterMessagePatterns.count { pattern -> pattern.containsMatchIn(normalized) }
            val requestOnly = Regex("^(check|scan|review|verify|is|can you|tell me)\\b").containsMatchIn(normalized) &&
                    !directHit &&
                    messageHits == 0

            return !requestOnly && (directHit || messageHits >= 2 || (wordCount > 12 && messageHits >= 1))
        }
    }

    @Suppress("DEPRECATION")
    private fun applyAudioRoute(route: String): Boolean {
        val normalizedRoute = route.lowercase()
        if (normalizedRoute !in setOf("speaker", "earpiece", "bluetooth")) {
            Log.w(TAG, "Unsupported audio route requested: $route")
            return false
        }

        return try {
            val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            requestCallAudioFocus(audioManager)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val targetType = when (normalizedRoute) {
                    "speaker" -> AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
                    "bluetooth" -> AudioDeviceInfo.TYPE_BLUETOOTH_SCO
                    else -> AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
                }
                val targetDevice = audioManager.availableCommunicationDevices
                    .firstOrNull { it.type == targetType }

                if (targetDevice != null) {
                    val applied = audioManager.setCommunicationDevice(targetDevice)
                    if (!applied) {
                        Log.w(TAG, "Android rejected communication device route: $normalizedRoute")
                    }
                    return applied
                }

                if (normalizedRoute == "bluetooth") {
                    Log.w(TAG, "Bluetooth communication device unavailable")
                    return false
                }

                audioManager.clearCommunicationDevice()
            }

            when (normalizedRoute) {
                "speaker" -> {
                    audioManager.stopBluetoothSco()
                    audioManager.isBluetoothScoOn = false
                    audioManager.isSpeakerphoneOn = true
                }
                "bluetooth" -> {
                    audioManager.isSpeakerphoneOn = false
                    audioManager.startBluetoothSco()
                    audioManager.isBluetoothScoOn = true
                }
                else -> {
                    audioManager.stopBluetoothSco()
                    audioManager.isBluetoothScoOn = false
                    audioManager.isSpeakerphoneOn = false
                }
            }

            Log.i(TAG, "Audio route applied: $normalizedRoute")
            true
        } catch (error: Exception) {
            Log.e(TAG, "Failed to apply audio route: $route", error)
            false
        }
    }

    private fun requestCallAudioFocus(audioManager: AudioManager): Boolean {
        return try {
            val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()

                val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(audioAttributes)
                    .setAcceptsDelayedFocusGain(false)
                    .setOnAudioFocusChangeListener(callAudioFocusChangeListener)
                    .build()

                callAudioFocusRequest = request
                audioManager.requestAudioFocus(request)
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(
                    callAudioFocusChangeListener,
                    AudioManager.STREAM_VOICE_CALL,
                    AudioManager.AUDIOFOCUS_GAIN,
                )
            }

            val granted = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            Log.i(TAG, "Call audio focus requested granted=$granted")
            granted
        } catch (error: Exception) {
            Log.e(TAG, "Failed to request call audio focus", error)
            false
        }
    }

    private inner class NativeAuthBridge {
        private val prefs by lazy {
            getSharedPreferences(AUTH_PREFS, MODE_PRIVATE)
        }

        @JavascriptInterface
        fun setAuthToken(token: String?) {
            prefs.edit().putString(KEY_AUTH_TOKEN, token.orEmpty()).apply()
            NativeCallSyncWorker.enqueue(this@MainActivity, "auth_token_updated")
        }

        @JavascriptInterface
        fun setRefreshToken(token: String?) {
            prefs.edit().putString(KEY_REFRESH_TOKEN, token.orEmpty()).apply()
        }

        @JavascriptInterface
        fun setUserId(userId: String?) {
            prefs.edit().putString(KEY_USER_ID, userId.orEmpty()).apply()
            NativeCallSyncWorker.enqueue(this@MainActivity, "auth_user_updated")
        }

        @JavascriptInterface
        fun clearAuth() {
            prefs.edit()
                .remove(KEY_AUTH_TOKEN)
                .remove(KEY_REFRESH_TOKEN)
                .remove(KEY_USER_ID)
                .apply()
        }

        @JavascriptInterface
        fun getAuthToken(): String? {
            return prefs.getString(KEY_AUTH_TOKEN, null)
        }

        @JavascriptInterface
        fun getUserId(): String? {
            return prefs.getString(KEY_USER_ID, null)
        }
    }

    private inner class NativeCallBridge {
        private var lastActiveConnectionLogAt = 0L
        private var lastLoggedActiveConnection: Boolean? = null

        @JavascriptInterface
        fun onCallStateChanged(callId: String, state: String?) {
            val connection = ChatrConnectionService.getConnection(callId)
            when (state?.lowercase()) {
                "connecting" -> connection?.setDialing()
                "connected" -> {
                    toneManager.stopTone()
                    connection?.handoffToWebCall()
                    ChatrNotificationCoordinator.cancelIncomingCallNotification(this@MainActivity, callId)
                }
                "failed" -> {
                    toneManager.playTone(CallTone.FAILED, callId)
                    connection?.endCall()
                    ChatrNotificationCoordinator.cancelIncomingCallNotification(this@MainActivity, callId)
                    ChatrVoipCallRegistry.clear(this@MainActivity, callId)
                }
            }
        }

        @JavascriptInterface
        fun onCallConnected(callId: String) {
            toneManager.stopTone()
            ChatrConnectionService.getConnection(callId)?.handoffToWebCall()
            ChatrNotificationCoordinator.cancelIncomingCallNotification(this@MainActivity, callId)
            // Start AI overlay bubble on top of VoIP call
            InCallOverlayService.start(this@MainActivity, callId)
        }

        @JavascriptInterface
        fun onCallEnded(callId: String) {
            toneManager.stopTone()
            toneManager.playTone(CallTone.ENDED, callId)
            ChatrConnectionService.getConnection(callId)?.endCall()
            ChatrNotificationCoordinator.cancelIncomingCallNotification(this@MainActivity, callId)
            ChatrVoipCallRegistry.clear(this@MainActivity, callId)
            // Stop AI overlay when call ends
            InCallOverlayService.stop(this@MainActivity)
        }

        @JavascriptInterface
        fun playCallProgressTone(tone: String?, callId: String?, variant: String?) {
            runOnUiThread {
                // Pass variant so ToneManager can apply frequency personalisation
                val played = toneManager.playTone(tone, callId, variant)
                if (!played) {
                    Log.w(TAG, "Unknown call progress tone requested: $tone variant=$variant")
                }
            }
        }

        @JavascriptInterface
        fun stopCallProgressTone() {
            runOnUiThread {
                toneManager.stopTone()
            }
        }

        @JavascriptInterface
        fun pauseCallProgressTone() {
            runOnUiThread {
                toneManager.pauseTone()
            }
        }

        @JavascriptInterface
        fun resumeCallProgressTone() {
            runOnUiThread {
                toneManager.resumeTone()
            }
        }

        @JavascriptInterface
        fun hasActiveConnection(): Boolean {
            val active = ChatrConnectionService.hasActiveConnections()
            val now = SystemClock.elapsedRealtime()
            val shouldLog = active ||
                lastLoggedActiveConnection != active ||
                now - lastActiveConnectionLogAt > 30_000L

            if (shouldLog) {
                Log.d(TAG, "ChatrCall.hasActiveConnection() queried: $active")
                lastLoggedActiveConnection = active
                lastActiveConnectionLogAt = now
            }
            return active
        }

        @JavascriptInterface
        fun setCallProgressToneMuted(muted: Boolean) {
            runOnUiThread {
                toneManager.setMuted(muted)
            }
        }

        @JavascriptInterface
        fun syncSystemCallIdentity(
            callId: String?,
            phoneNumber: String?,
            displayName: String?,
            avatarUrl: String?,
            remoteId: String?,
        ) {
            val cleanedPhone = phoneNumber?.takeIf { it.isNotBlank() }
            val cleanedName = displayName?.takeIf { it.isNotBlank() }

            if (!callId.isNullOrBlank()) {
                ChatrConnectionService.getConnection(callId)?.let { connection ->
                    cleanedPhone?.let {
                        connection.setAddress(
                            Uri.fromParts("tel", it, null),
                            TelecomManager.PRESENTATION_ALLOWED,
                        )
                    }
                    cleanedName?.let {
                        connection.setCallerDisplayName(it, TelecomManager.PRESENTATION_ALLOWED)
                    }
                }
            }

            ChatrSystemContactSync.syncAsync(
                this@MainActivity,
                cleanedPhone,
                cleanedName,
                avatarUrl?.takeIf { it.isNotBlank() },
                remoteId?.takeIf { it.isNotBlank() },
            )

            if (!callId.isNullOrBlank() && !cleanedPhone.isNullOrBlank()) {
                persistCallbackTarget(callId, cleanedPhone)
            }
        }

        @JavascriptInterface
        fun showIncomingCall(
            callId: String?,
            callerId: String?,
            callerName: String?,
            callerAvatar: String?,
            callerPhone: String?,
            callType: String?,
            conversationId: String?,
        ) {
            if (callId.isNullOrBlank()) return

            runOnUiThread {
                ChatrNotificationCoordinator.showIncomingCall(
                    context = this@MainActivity,
                    callId = callId,
                    callerId = callerId.orEmpty(),
                    callerName = callerName.orEmpty(),
                    callerAvatar = callerAvatar,
                    callerPhone = callerPhone.orEmpty(),
                    callType = callType.orEmpty(),
                    conversationId = conversationId.orEmpty(),
                    source = "web_background",
                )
            }
        }

        @JavascriptInterface
        fun dismissIncomingCall(callId: String?) {
            if (callId.isNullOrBlank()) return

            runOnUiThread {
                val conn = ChatrConnectionService.getConnection(callId)
                conn?.handoffToWebCall()
                ChatrNotificationCoordinator.cancelIncomingCallNotification(this@MainActivity, callId)
            }
        }

        @JavascriptInterface
        fun showMessageNotification(
            senderId: String?,
            senderName: String?,
            messageText: String?,
            conversationId: String?,
        ) {
            showNativeMessageNotification(senderId, senderName, messageText, conversationId, null)
        }

        @JavascriptInterface
        fun showMessageNotificationWithAvatar(
            senderId: String?,
            senderName: String?,
            messageText: String?,
            conversationId: String?,
            senderAvatar: String?,
        ) {
            showNativeMessageNotification(senderId, senderName, messageText, conversationId, senderAvatar)
        }

        private fun showNativeMessageNotification(
            senderId: String?,
            senderName: String?,
            messageText: String?,
            conversationId: String?,
            senderAvatar: String?,
        ) {
            val body = messageText?.takeIf { it.isNotBlank() } ?: return

            runOnUiThread {
                ChatrNotificationCoordinator.showMessageNotification(
                    context = this@MainActivity,
                    senderId = senderId.orEmpty(),
                    senderName = senderName.orEmpty(),
                    messageText = body,
                    conversationId = conversationId.orEmpty(),
                    senderAvatar = senderAvatar,
                )
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        sanitizeIntent(intent)
        webViewCachePurged = purgeStaleWebViewCachesIfNeeded()
        registerPlugin(ChatrIntelligencePlugin::class.java)
        registerPlugin(ChatrSafeSmsPlugin::class.java)
        registerPlugin(ChatrShieldPlugin::class.java)
        registerPlugin(OnDeviceAiPlugin::class.java)
        // New Capacitor plugins — June 2026
        registerPlugin(NativeTTSPlugin::class.java)
        registerPlugin(TelecomInterceptorPlugin::class.java)
        registerPlugin(VoiceTranslationPlugin::class.java)
        registerPlugin(ChatrCallScreeningPlugin::class.java)
        super.onCreate(savedInstanceState)
        isWebAppReady = false
        startupFallbackAttempted = false
        webViewBridgeConfigured = false
        Log.i(TAG, "MainActivity onCreate")
        CallForegroundService.clearStaleNotificationIfTelecomIdle(this, "main_activity_start")

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(
                callActionReceiver,
                IntentFilter(CALL_ACTION_FILTER),
                Context.RECEIVER_NOT_EXPORTED
            )
            registerReceiver(
                sttRequestReceiver,
                IntentFilter(STT_REQUEST_ACTION),
                Context.RECEIVER_NOT_EXPORTED
            )
        } else {
            @Suppress("DEPRECATION")
            registerReceiver(callActionReceiver, IntentFilter(CALL_ACTION_FILTER))
            @Suppress("DEPRECATION")
            registerReceiver(sttRequestReceiver, IntentFilter(STT_REQUEST_ACTION))
        }

        val needsImmediateCallWork = isCallActionLaunch(intent)
        if (needsImmediateCallWork) {
            runPostLaunchNativeWork()
        }

        setupWebView()

        handleChatrCallsLaunch(intent)
        handleIntent(intent)

        if (!needsImmediateCallWork) {
            schedulePostLaunchNativeWork()
        }
    }

    private fun isCallActionLaunch(intent: Intent?): Boolean {
        val action = intent?.getStringExtra("action")
        val intentAction = intent?.action
        val dataScheme = intent?.data?.scheme

        return action in setOf(
            "answer_call",
            "answer",
            "reject_call",
            "reject",
            "end_call",
            "end",
            "mark_missed",
            "missed",
            "prewarm_call",
            "start_outgoing",
        ) ||
            intentAction == CALL_BACK_ACTION ||
            intentAction == Intent.ACTION_CALL ||
            dataScheme == "tel"
    }

    private fun schedulePostLaunchNativeWork() {
        Handler(Looper.getMainLooper()).postDelayed({
            runPostLaunchNativeWork()
        }, 1_000L)
    }

    private fun runPostLaunchNativeWork() {
        CallForegroundService.clearStaleNotificationIfTelecomIdle(this, "main_activity_start")
        checkAndRequestPermissions()
        logFullScreenIntentStatus()
        initializeVoIPServices()
    }

    override fun onNewIntent(intent: Intent) {
        sanitizeIntent(intent)
        super.onNewIntent(intent)
        setIntent(intent)
        Log.i(TAG, "MainActivity onNewIntent: ${intent.action}")
        handleChatrCallsLaunch(intent)
        handleIntent(intent)
    }

    private fun sanitizeIntent(intentToSanitize: Intent?) {
        if (intentToSanitize == null) return
        try {
            val extras = intentToSanitize.extras
            if (extras != null) {
                for (key in extras.keySet()) {
                    val value = extras.get(key)
                    if (value is Long || value is Int) {
                        intentToSanitize.putExtra(key, value.toString())
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error sanitizing intent extras", e)
        }
    }

    /**
     * Detects if the app was launched from the ChatrCalls launcher alias
     * and navigates the WebView directly to /calls.
     *
     * The alias component name contains ".ChatrCallsActivity".
     * If the user is not signed in, React's auth guard shows
     * the sign-in screen automatically.
     */
    private fun handleChatrCallsLaunch(intent: Intent) {
        val componentClass = intent.component?.className ?: return
        if (!componentClass.contains("ChatrCallsActivity", ignoreCase = true)) return

        Log.i(TAG, "ChatrCalls alias launch detected — routing to /calls")

        NativeCallSyncWorker.enqueue(this, "chatrcalls_launch")
        NativeCallerProtection.requestSetup(this)

        // emitNativeEvent queues the event if the web app isn't ready yet
        // and flushes it once markWebAppReady() is called from the web layer.
        emitNativeEvent(
            "nativeNavigate",
            org.json.JSONObject().apply {
                put("path", "/calls")
                put("source", "chatrcalls_alias")
            }
        )
    }

    private fun initializeVoIPServices() {
        try {
            CallBlockingManager.getInstance(this)
            Log.i(TAG, "VoIP services initialized")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize VoIP services", e)
        }
    }

    private fun setupWebView(attempt: Int = 0) {
        val activeBridge = bridge
        val webViewId = resources.getIdentifier("webview", "id", packageName)
        val webView = activeBridge?.webView
            ?: if (webViewId != 0) findViewById<WebView?>(webViewId) else null

        if (webView == null) {
            if (attempt < 20) {
                Handler(Looper.getMainLooper()).postDelayed({ setupWebView(attempt + 1) }, 150L)
            } else {
                Log.e(TAG, "WebView was not available after startup retries")
            }
            return
        }

        if (webViewBridgeConfigured) return

        if (activeBridge == null && attempt < 20) {
            Log.w(TAG, "Capacitor bridge not ready for WebView setup; retry=$attempt")
            Handler(Looper.getMainLooper()).postDelayed({ setupWebView(attempt + 1) }, 150L)
            return
        }

        if (activeBridge == null) {
            Log.w(TAG, "Configuring WebView without Capacitor bridge after retries")
        }

            if (webViewCachePurged) {
                Log.i(TAG, "WebView disk caches were purged before app launch")
            }
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
            webView.settings.mediaPlaybackRequiresUserGesture = false
            voipBridge = VoIPBridgeService(this, webView)
            webView.addJavascriptInterface(voipBridge!!, VoIPBridgeService.BRIDGE_NAME)
            webView.addJavascriptInterface(NativeRuntimeBridge(), NATIVE_RUNTIME_BRIDGE)
            webView.addJavascriptInterface(NativeAuthBridge(), NATIVE_AUTH_BRIDGE)
            webView.addJavascriptInterface(NativeCallBridge(), NATIVE_CALL_BRIDGE)
            webView.addJavascriptInterface(NativeSTTBridge(), "AndroidNativeSTT")
            activeWebView = webView
            if (activeBridge != null) {
                webView.webChromeClient = object : BridgeWebChromeClient(activeBridge) {
                    override fun onPermissionRequest(request: PermissionRequest?) {
                        request?.let { super.onPermissionRequest(it) }
                    }

                    override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                        consoleMessage?.let {
                            Log.i(
                                TAG,
                                "WebView console: ${it.message()} (${it.sourceId()}:${it.lineNumber()})"
                            )
                        }
                        return super.onConsoleMessage(consoleMessage)
                    }
                }

            }
            webViewBridgeConfigured = true
            // Phase 8 — Network Handoff: give NetworkChangeReceiver a reference to
            // dispatch nativeNetworkChanged events for proactive ICE restart
            com.chatr.app.receivers.NetworkChangeReceiver.webViewRef = webView
            Handler(Looper.getMainLooper()).postDelayed({
                if (isWebAppReady || startupFallbackAttempted) return@postDelayed
                if (webView.url?.startsWith(activeBridge?.localUrl ?: "https://localhost") == true &&
                    webView.progress <= 10
                ) {
                    Log.w(
                        TAG,
                        "Initial Capacitor WebView load is still pending after bridge setup; loading bundled index fallback",
                    )
                    startupFallbackAttempted = true
                    loadBundledIndexHtmlFallback(webView)
                }
            }, 4_000L)
            scheduleWebViewStartupFallback(webView)
            Log.i(TAG, "WebView configured with native bridges")
    }

    private fun scheduleWebViewStartupFallback(webView: WebView) {
        Handler(Looper.getMainLooper()).postDelayed({
            if (isWebAppReady || startupFallbackAttempted) return@postDelayed

            Log.w(
                TAG,
                "WebView early startup check: url=${webView.url} progress=${webView.progress}"
            )
        }, 900L)

        Handler(Looper.getMainLooper()).postDelayed({
            if (isWebAppReady || startupFallbackAttempted) return@postDelayed
            recoverBlankWebViewIfNeeded(webView)
        }, 8_000L)

        Handler(Looper.getMainLooper()).postDelayed({
            if (isWebAppReady || startupFallbackAttempted) return@postDelayed

            Log.w(
                TAG,
                "WebView has not reported ready yet. " +
                    "url=${webView.url} progress=${webView.progress}"
            )

            // Do not interrupt a real bundled app load. On slower devices React can
            // still be parsing/running while the WebView progress is low; forcing a
            // reload here leaves users on a white screen. Only recover when the
            // WebView has not started a navigation at all.
            if (webView.url.isNullOrBlank() && webView.progress <= 0) {
                startupFallbackAttempted = true
                restartCapacitorLocalLoad(webView)
            }
        }, 20_000L)
    }

    private fun recoverBlankWebViewIfNeeded(webView: WebView) {
        try {
            val localUrl = bridge?.localUrl ?: "https://localhost"
            if (webView.url?.startsWith(localUrl) == true && webView.progress <= 10) {
                Log.w(
                    TAG,
                    "Capacitor localhost document is still stalled; loading bundled index fallback",
                )
                startupFallbackAttempted = true
                loadBundledIndexHtmlFallback(webView)
                return
            }

            webView.evaluateJavascript(
                """
                (function() {
                    var body = document.body;
                    if (!body) return JSON.stringify({ blank: true, reason: 'no-body' });
                    var text = (body.innerText || '').trim();
                    var root = document.getElementById('root');
                    return JSON.stringify({
                        blank: text.length === 0 && (!root || root.children.length === 0),
                        textLength: text.length,
                        rootChildren: root ? root.children.length : -1,
                        href: location.href,
                        readyState: document.readyState
                    });
                })();
                """.trimIndent(),
            ) { result ->
                Log.w(TAG, "WebView blank check: $result")
                val normalized = result.orEmpty()
                val looksBlank =
                    normalized.contains("\"blank\":true") ||
                        normalized.contains("\\\"blank\\\":true")
                if (!isWebAppReady && looksBlank) {
                    startupFallbackAttempted = true
                    restartCapacitorLocalLoad(webView)
                }
            }
        } catch (error: Exception) {
            Log.w(TAG, "Blank WebView check failed; restarting localhost load", error)
            startupFallbackAttempted = true
            restartCapacitorLocalLoad(webView)
        }
    }

    private fun restartCapacitorLocalLoad(webView: WebView) {
        try {
            val activeBridge = bridge
            val restartUrl = "${bridge?.localUrl ?: "https://localhost"}/"
            Log.w(
                TAG,
                "Restarting Capacitor localhost load current=${webView.url} " +
                    "progress=${webView.progress} appUrl=${activeBridge?.appUrl ?: restartUrl}",
            )
            webView.stopLoading()
            webView.loadUrl("about:blank")
            Handler(Looper.getMainLooper()).postDelayed({
                if (activeBridge != null) {
                    activeBridge.reload()
                } else {
                    webView.loadUrl(restartUrl)
                }
                logWebViewDomState(webView, "capacitor-local-restart")
            }, 120L)
        } catch (error: Exception) {
            Log.e(TAG, "Failed to restart Capacitor localhost document", error)
            loadBundledHomeFallback(webView)
        }
    }

    private fun loadBundledIndexHtmlFallback(webView: WebView) {
        try {
            val baseUrl = "${bridge?.localUrl ?: "https://localhost"}/"
            val html = assets.open("public/index.html").bufferedReader().use { it.readText() }
            Log.w(TAG, "Initial localhost document stalled; loading bundled index.html directly")
            webView.stopLoading()
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
            webView.settings.mediaPlaybackRequiresUserGesture = false
            webView.loadDataWithBaseURL(
                baseUrl,
                html,
                "text/html",
                "UTF-8",
                baseUrl,
            )
            logWebViewDomState(webView, "bundled-index-fallback")
        } catch (error: Exception) {
            Log.e(TAG, "Failed to load bundled fallback", error)
            loadBundledHomeFallback(webView)
        }
    }

    private fun logWebViewDomState(webView: WebView, label: String) {
        Handler(Looper.getMainLooper()).postDelayed({
            try {
                webView.evaluateJavascript(
                    """
                    (function() {
                        var body = document.body;
                        return JSON.stringify({
                            href: location.href,
                            readyState: document.readyState,
                            text: body ? body.innerText.slice(0, 120) : '',
                            childCount: body ? body.children.length : 0
                        });
                    })();
                    """.trimIndent(),
                ) { result ->
                    Log.i(TAG, "WebView state[$label]: $result")
                }
            } catch (error: Exception) {
                Log.w(TAG, "Unable to inspect WebView state[$label]", error)
            }
        }, 1_000L)
    }

    private fun loadBundledHomeFallback(webView: WebView) {
        try {
            val fallbackUrl = "${bridge?.localUrl ?: "https://localhost"}/home"
            webView.stopLoading()
            webView.loadUrl(fallbackUrl)
        } catch (error: Exception) {
            Log.e(TAG, "Failed to load bundled home fallback", error)
        }
    }

    private fun purgeStaleWebViewCachesIfNeeded(): Boolean {
        val prefs = getSharedPreferences(WEBVIEW_CACHE_PREFS, MODE_PRIVATE)
        val currentVersion = BuildConfig.VERSION_CODE
        val currentFingerprint = currentWebViewCacheFingerprint(currentVersion)
        val shouldPurge =
            prefs.getString(KEY_LAST_WEBVIEW_CACHE_PURGE_FINGERPRINT, null) != currentFingerprint ||
                prefs.getInt(KEY_LAST_WEBVIEW_CACHE_PURGE_VERSION, -1) != currentVersion

        if (!shouldPurge) {
            return false
        }

        val webViewRoot = File(applicationInfo.dataDir, "app_webview")
        val targets = listOf(
            "Service Worker",
            "CacheStorage",
            "Cache",
            "Code Cache",
            "Default/Service Worker",
            "Default/CacheStorage",
            "Default/Cache",
            "Default/Code Cache",
            "Default/GPUCache",
            "Default/Network Persistent State",
        )

        var deletedAny = false
        targets.forEach { relativePath ->
            val candidate = File(webViewRoot, relativePath)
            deletedAny = deleteWebViewCachePathSafely(webViewRoot, candidate) || deletedAny
        }

        prefs.edit()
            .putInt(KEY_LAST_WEBVIEW_CACHE_PURGE_VERSION, currentVersion)
            .putString(KEY_LAST_WEBVIEW_CACHE_PURGE_FINGERPRINT, currentFingerprint)
            .apply()
        Log.i(
            TAG,
            if (deletedAny) {
                "Purged stale WebView service worker/cache data before app launch fingerprint=$currentFingerprint"
            } else {
                "WebView cache purge requested, but no stale service worker/cache data was present fingerprint=$currentFingerprint"
            }
        )
        return deletedAny
    }

    private fun currentWebViewCacheFingerprint(currentVersion: Int): String {
        return "$currentVersion:startup-v$WEBVIEW_STARTUP_CACHE_SCHEMA_VERSION"
    }

    private fun currentBundledWebAssetFingerprint(): String {
        return try {
            assets.open("public/index.html").bufferedReader().use { reader ->
                reader.readText().hashCode().toString()
            }
        } catch (error: Exception) {
            Log.w(TAG, "Unable to fingerprint bundled web assets; falling back to app version", error)
            "unknown"
        }
    }

    private fun deleteWebViewCachePathSafely(root: File, candidate: File): Boolean {
        return try {
            val canonicalRoot = root.canonicalFile
            val canonicalCandidate = candidate.canonicalFile

            if (!canonicalCandidate.path.startsWith(canonicalRoot.path)) {
                Log.w(TAG, "Skipping unsafe WebView cache delete target: ${canonicalCandidate.path}")
                false
            } else if (!canonicalCandidate.exists()) {
                false
            } else {
                canonicalCandidate.deleteRecursively().also { deleted ->
                    if (deleted) {
                        Log.i(TAG, "Deleted stale WebView path: ${canonicalCandidate.path}")
                    } else {
                        Log.w(TAG, "Failed to delete stale WebView path: ${canonicalCandidate.path}")
                    }
                }
            }
        } catch (error: Exception) {
            Log.w(TAG, "Could not purge WebView cache path: ${candidate.path}", error)
            false
        }
    }

    private fun handleIntent(intent: Intent) {
        val action = intent.getStringExtra("action")
        val intentAction = intent.action
        val dataUri = intent.data
        val callId = intent.getStringExtra("call_id")
        val phoneNumber = intent.getStringExtra("phone_number")
            ?: intent.getStringExtra("caller_phone")
            ?: intent.getStringExtra("caller_number")

        if (isDuplicateIntent(action, intentAction, callId, phoneNumber, dataUri?.toString())) {
            Log.i(TAG, "Skipping duplicate intent action=$action intentAction=$intentAction callId=$callId")
            return
        }

        Log.i(TAG, "Handling action=$action intentAction=$intentAction data=$dataUri")

        if (intent.getBooleanExtra("show_post_call_ai", false)) {
            Log.i(TAG, "Triggering Post-Call AI panel for $phoneNumber")
            emitNativeEvent("nativeNavigate", org.json.JSONObject().apply {
                put("path", "/call-history")
                put("showInsights", true)
                put("phoneNumber", phoneNumber)
            })
            return
        }

        if (intent.getBooleanExtra("show_spam_report", false)) {
            Log.i(TAG, "Triggering Spam Report modal for $phoneNumber")
            emitNativeEvent("nativeNavigate", org.json.JSONObject().apply {
                put("path", "/call-history")
                put("showSpamReport", true)
                put("phoneNumber", phoneNumber)
            })
            return
        }

        if (intentAction == CALL_BACK_ACTION) {
            handleCallBackIntent(intent)
            return
        }

        if (intentAction == Intent.ACTION_VIEW ||
            intentAction == Intent.ACTION_DIAL ||
            intentAction == Intent.ACTION_CALL
        ) {
            if (dataUri?.scheme == "tel") {
                handleOutgoingCall(dataUri.schemeSpecificPart)
                return
            }
        }

        when (action) {
            "answer_call", "answer" -> handleAnswerCall(intent)
            "reject_call", "reject" -> handleRejectCall(intent)
            "end_call", "end" -> handleEndCall(intent)
            "mark_missed", "missed" -> handleMissedCall(intent)
            "send_reply" -> handleSendReply(intent)
            "prewarm_call" -> handlePrewarmCall(intent)
            "start_outgoing" -> handleOutgoingCall(
                intent.getStringExtra("phone_number") ?: return,
                intent.getStringExtra("call_id")
            )
            else -> handleNavigateTo(intent)
        }
    }

    private fun handleCallBackIntent(intent: Intent) {
        val callbackUuid = intent.getStringExtra(EXTRA_CALLBACK_UUID)?.trim().orEmpty()
        val cachedNumber = if (callbackUuid.isNotBlank()) {
            callbackCachePrefs.getString(CALLBACK_UUID_PREFIX + callbackUuid, null)
        } else {
            null
        }

        if (!cachedNumber.isNullOrBlank()) {
            Log.i(TAG, "Handling Telecom callback for cached UUID=$callbackUuid")
            handleOutgoingCall(cachedNumber, callbackUuid)
            return
        }

        val fallbackNumber = intent.data?.schemeSpecificPart
            ?: intent.getStringExtra("phone_number")
            ?: intent.getStringExtra("caller_phone")
            ?: intent.getStringExtra("caller_number")
        if (!fallbackNumber.isNullOrBlank()) {
            Log.i(TAG, "Handling Telecom callback fallback for UUID=$callbackUuid")
            handleOutgoingCall(fallbackNumber, callbackUuid.ifBlank { null })
            return
        }

        Log.w(TAG, "Received Telecom callback without a cached number for UUID=$callbackUuid")
    }

    private fun isDuplicateIntent(
        action: String?,
        intentAction: String?,
        callId: String?,
        phoneNumber: String?,
        dataUri: String?,
    ): Boolean {
        val normalizedAction = when (action) {
            "answer_call" -> "answer"
            "reject_call" -> "reject"
            "end_call" -> "end"
            "mark_missed" -> "missed"
            else -> action
        }

        val signature = if (normalizedAction in setOf("answer", "reject", "end", "missed") && !callId.isNullOrBlank()) {
            "call_action|$normalizedAction|$callId"
        } else {
            listOf(
                action.orEmpty(),
                intentAction.orEmpty(),
                callId.orEmpty(),
                phoneNumber.orEmpty(),
                dataUri.orEmpty(),
            ).joinToString("|")
        }

        if (signature == "||||" || signature.isBlank()) {
            return false
        }

        val now = System.currentTimeMillis()
        val previous = recentIntentSignatures[signature]
        if (previous != null && now - previous < DUPLICATE_INTENT_WINDOW_MS) {
            return true
        }

        recentIntentSignatures[signature] = now
        return false
    }

    private fun handlePrewarmCall(intent: Intent) {
        val callId = intent.getStringExtra("call_id") ?: return
        val callerId = intent.getStringExtra("caller_id") ?: ""
        val callerName = intent.getStringExtra("caller_name") ?: ""
        val callerPhone = intent.getStringExtra("caller_phone")
            ?: intent.getStringExtra("caller_number")
            ?: ""
        val callType = intent.getStringExtra("call_type") ?: "audio"
        val conversationId = intent.getStringExtra("conversation_id") ?: ""
        Log.i(TAG, "Pre-warming VoIP session for $callId (callerId=$callerId)")
        if (!isActivityVisible) {
            Log.i(TAG, "MainActivity is not visible. Moving task to back to stay backgrounded during prewarm.")
            moveTaskToBack(true)
            overridePendingTransition(0, 0)
        }
        voipBridge?.notifyCallPrewarm(
            callId = callId,
            callerId = callerId,
            callerName = callerName,
            callerPhone = callerPhone,
            callType = callType,
            conversationId = conversationId,
        )
    }

    private fun handleAnswerCall(intent: Intent) {
        val callId = intent.getStringExtra("call_id") ?: return
        val callerId = intent.getStringExtra("caller_id") ?: ""
        val rawCallerName = intent.getStringExtra("caller_name")
        val callerPhone = intent.getStringExtra("caller_phone")
            ?: intent.getStringExtra("caller_number")
            ?: ChatrVoipCallRegistry.extractPhoneCandidate(rawCallerName)
            ?: ""
        val callerName = ChatrVoipCallRegistry.resolveDisplayName(
            context = this,
            callId = callId,
            callerId = callerId,
            proposedName = rawCallerName,
            callerPhone = callerPhone,
        )
        val callerAvatar = intent.getStringExtra("caller_avatar") ?: ""
        val callType = intent.getStringExtra("call_type") ?: "audio"
        val conversationId = intent.getStringExtra("conversation_id") ?: ""

        Log.i(TAG, "Answering call $callId")

        // Broadcast to IncomingCallActivity to stop ringing and finish immediately.
        // The actual media call belongs to the WebView; Telecom is released once
        // the web side dismisses the incoming shell or reports connected.
        val callActionIntent = Intent(CALL_ACTION_FILTER).apply {
            setPackage(packageName)
            putExtra("action", "answer")
            putExtra("call_id", callId)
        }
        sendBroadcast(callActionIntent)

        stopVibration()
        ChatrNotificationCoordinator.cancelIncomingCallNotification(this, callId)

        val serviceIntent = Intent(this, CallForegroundService::class.java).apply {
            action = CallForegroundService.ACTION_START
            putExtra("call_id", callId)
            putExtra("call_type", callType)
            putExtra("partner_name", callerName)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }

        emitNativeEvent(
            "nativeCallAction",
            JSONObject().apply {
                put("action", "answer")
                put("callId", callId)
                put("callerId", callerId)
                put("callerName", callerName)
                put("callerAvatar", callerAvatar)
                put("callerPhone", callerPhone)
                put("callType", callType)
                put("conversationId", conversationId)
            }
        )
    }

    private fun handleEndCall(intent: Intent) {
        val callId = intent.getStringExtra("call_id") ?: return

        Log.i(TAG, "Ending call $callId")

        toneManager.stopTone()
        toneManager.playTone(CallTone.ENDED, callId)
        ChatrConnectionService.getConnection(callId)?.endCall()
        stopCallService()
        updateVoipCallStatusNative(callId, "ended")
        ChatrVoipCallRegistry.clear(this, callId)

        emitNativeEvent(
            "nativeCallAction",
            JSONObject().apply {
                put("action", "end")
                put("callId", callId)
            }
        )
    }

    private fun handleRejectCall(intent: Intent) {
        val callId = intent.getStringExtra("call_id") ?: return
        val navigateTo = intent.getStringExtra("navigate_to")

        Log.i(TAG, "Rejecting call $callId")

        // 1. Update TelecomManager connection if exists
        ChatrConnectionService.rejectConnection(callId)

        // 2. Broadcast to IncomingCallActivity to stop ringing and finish immediately
        val callActionIntent = Intent(CALL_ACTION_FILTER).apply {
            setPackage(packageName)
            putExtra("action", "reject")
            putExtra("call_id", callId)
        }
        sendBroadcast(callActionIntent)

        // 3. Stop vibration
        stopVibration()

        // 4. Cancel notification
        ChatrNotificationCoordinator.cancelIncomingCallNotification(this, callId)

        toneManager.stopTone()
        updateVoipCallStatusNative(callId, "ended")
        ChatrVoipCallRegistry.clear(this, callId)

        emitNativeEvent(
            "nativeCallAction",
            JSONObject().apply {
                put("action", "reject")
                put("callId", callId)
                if (!navigateTo.isNullOrBlank()) {
                    put("navigateTo", navigateTo)
                }
            }
        )
    }

    private fun handleMissedCall(intent: Intent) {
        val callId = intent.getStringExtra("call_id") ?: return
        val navigateTo = intent.getStringExtra("navigate_to")

        Log.i(TAG, "Marking call missed $callId")

        ChatrConnectionService.missConnection(callId)
        updateVoipCallStatusNative(callId, "missed")
        ChatrVoipCallRegistry.clear(this, callId)

        emitNativeEvent(
            "nativeCallAction",
            JSONObject().apply {
                put("action", "missed")
                put("callId", callId)
                if (!navigateTo.isNullOrBlank()) {
                    put("navigateTo", navigateTo)
                }
            }
        )
    }

    private fun updateVoipCallStatusNative(callId: String, status: String) {
        if (callId.isBlank()) return

        Thread {
            val updated = SupabaseNativeCallClient(applicationContext)
                .updateVoipCallStatus(callId, status)
            if (updated) {
                Log.i(TAG, "Native status update sent: $callId -> $status")
            } else {
                Log.w(TAG, "Native status update failed: $callId -> $status")
            }
        }.start()
    }

    private fun handleSendReply(intent: Intent) {
        val conversationId = intent.getStringExtra("conversation_id") ?: return
        val replyText = intent.getStringExtra("reply_text") ?: return

        emitNativeEvent(
            "nativeReply",
            JSONObject().apply {
                put("conversationId", conversationId)
                put("message", replyText)
            }
        )
    }

    private fun handleNavigateTo(intent: Intent) {
        val navigateTo = intent.getStringExtra("navigate_to") ?: return
        emitNativeEvent(
            "nativeNavigate",
            JSONObject().apply {
                put("path", navigateTo)
            }
        )
    }

    private fun handleOutgoingCall(phoneNumber: String, callId: String? = null) {
        val routeDecision = PhoneCoreRouter.resolveOutgoing(this, phoneNumber, callId)
        Log.i(
            TAG,
            "PhoneCore route primary=${routeDecision.primaryRoute.wireValue} fallback=${routeDecision.fallbackRoute?.wireValue} shield=${routeDecision.shieldDisposition.wireValue} reason=${routeDecision.reason}",
        )

        // If this is a fresh outgoing call (no callId yet) and it should route via Chatr VoIP,
        // let TelecomManager handle it so the system tracks the call state.
        if (callId == null && routeDecision.primaryRoute.wireValue == "chatr_voip") {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                try {
                    val telecomManager = getSystemService(android.telecom.TelecomManager::class.java)
                    val phoneAccountHandle = android.telecom.PhoneAccountHandle(
                        android.content.ComponentName(this, com.chatr.app.services.ChatrConnectionService::class.java),
                        "chatr_calling"
                    )
                    
                    val extras = android.os.Bundle().apply {
                        putParcelable(android.telecom.TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, phoneAccountHandle)
                        putBoolean(android.telecom.TelecomManager.EXTRA_START_CALL_WITH_VIDEO_STATE, false)
                        putParcelable(android.telecom.TelecomManager.EXTRA_OUTGOING_CALL_EXTRAS, android.os.Bundle().apply {
                            putString("phone_number", phoneNumber)
                        })
                    }
                    val uri = android.net.Uri.fromParts("tel", phoneNumber, null)
                    telecomManager?.placeCall(uri, extras)
                    Log.i(TAG, "Placed outgoing call via TelecomManager. Waiting for ChatrConnectionService.")
                    return // Stop here. Telecom will launch the UI with a call_id.
                } catch (e: SecurityException) {
                    Log.e(TAG, "Failed to placeCall via TelecomManager, falling back to manual UI", e)
                }
            }
        }

        emitNativeEvent(
            "nativeCallAction",
            JSONObject().apply {
                put("action", "start_outgoing")
                put("phoneNumber", phoneNumber)
                put("phoneRoute", routeDecision.toJson())
                put("normalizedPhoneNumber", routeDecision.normalizedNumber)
                put("primaryRoute", routeDecision.primaryRoute.wireValue)
                routeDecision.fallbackRoute?.let { put("fallbackRoute", it.wireValue) }
                put("shieldDisposition", routeDecision.shieldDisposition.wireValue)
                put("routeReason", routeDecision.reason)
                if (!callId.isNullOrBlank()) {
                    put("callId", callId)
                }
            }
        )
    }

    private fun persistCallbackTarget(callId: String, phoneNumber: String) {
        callbackCachePrefs.edit()
            .putString(CALLBACK_UUID_PREFIX + callId, phoneNumber)
            .apply()
    }

    private fun executeJavaScript(script: String) {
        runOnUiThread {
            try {
                bridge?.webView?.evaluateJavascript(script) { result ->
                    Log.d(TAG, "JavaScript result: $result")
                }
            } catch (e: Exception) {
                Log.e(TAG, "JavaScript execution failed", e)
            }
        }
    }

    private fun emitNativeEvent(eventName: String, detail: JSONObject) {
        if (isWebAppReady) {
            dispatchNativeEvent(eventName, detail)
        } else {
            queueNativeEvent(eventName, detail)
        }
    }

    fun emitNativeEventPublic(eventName: String, detail: JSONObject) {
        runOnUiThread {
            emitNativeEvent(eventName, detail)
        }
    }

    private fun dispatchNativeEvent(eventName: String, detail: JSONObject) {
        val quotedEventName = JSONObject.quote(eventName)
        val js = """
            (function() {
                window.dispatchEvent(new CustomEvent($quotedEventName, { detail: ${detail.toString()} }));
            })();
        """.trimIndent()
        executeJavaScript(js)
    }

    private fun queueNativeEvent(eventName: String, detail: JSONObject) {
        val rawQueue = pendingEventsPrefs.getString(KEY_PENDING_EVENTS, "[]") ?: "[]"
        val queue = try {
            JSONArray(rawQueue)
        } catch (_: Exception) {
            JSONArray()
        }

        queue.put(
            JSONObject().apply {
                put("eventName", eventName)
                put("detail", detail)
            }
        )

        pendingEventsPrefs.edit().putString(KEY_PENDING_EVENTS, queue.toString()).apply()
        Log.i(TAG, "Queued native event $eventName")
    }

    private fun flushPendingNativeEvents() {
        val rawQueue = pendingEventsPrefs.getString(KEY_PENDING_EVENTS, "[]") ?: "[]"
        val queue = try {
            JSONArray(rawQueue)
        } catch (_: Exception) {
            JSONArray()
        }

        if (queue.length() == 0) {
            return
        }

        pendingEventsPrefs.edit().remove(KEY_PENDING_EVENTS).apply()

        for (index in 0 until queue.length()) {
            val item = queue.optJSONObject(index) ?: continue
            val eventName = item.optString("eventName")
            val detail = item.optJSONObject("detail") ?: JSONObject()
            if (eventName.isNotBlank()) {
                dispatchNativeEvent(eventName, detail)
            }
        }
    }

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf<String>()
        permissions.add(Manifest.permission.CAMERA)
        permissions.add(Manifest.permission.RECORD_AUDIO)
        permissions.add(Manifest.permission.READ_PHONE_STATE)
        permissions.add(Manifest.permission.CALL_PHONE)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            permissions.add(Manifest.permission.ANSWER_PHONE_CALLS)
        }

        permissions.add(Manifest.permission.READ_CONTACTS)
        permissions.add(Manifest.permission.WRITE_CONTACTS)
        permissions.add(Manifest.permission.READ_CALL_LOG)
        permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            permissions.add(Manifest.permission.READ_MEDIA_IMAGES)
            permissions.add(Manifest.permission.READ_MEDIA_VIDEO)
            permissions.add(Manifest.permission.READ_MEDIA_AUDIO)
        } else {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
            permissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        }

        val missingPermissions = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missingPermissions.isNotEmpty()) {
            Log.i(TAG, "Requesting ${missingPermissions.size} permissions")
            ActivityCompat.requestPermissions(this, missingPermissions.toTypedArray(), 10002)
        } else {
            Log.i(TAG, "All permissions already granted")
        }
    }

    private fun logFullScreenIntentStatus() {
        if (Build.VERSION.SDK_INT < 34) return
        try {
            val notificationManager = getSystemService(NotificationManager::class.java)
            if (notificationManager != null && !notificationManager.canUseFullScreenIntent()) {
                Log.w(TAG, "Full-screen intents are disabled for this app")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read full-screen intent setting", e)
        }
    }

    private fun stopVibration() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? android.os.VibratorManager
                vibratorManager?.defaultVibrator?.cancel()
            } else {
                @Suppress("DEPRECATION")
                val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? android.os.Vibrator
                vibrator?.cancel()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop vibration", e)
        }
    }

    fun stopCallService() {
        CallForegroundService.releaseIfNoActiveCall(this, "main_activity_stop_call_service")
    }

    override fun onStart() {
        super.onStart()
        isActivityVisible = true
        Log.i(TAG, "MainActivity onStart: isActivityVisible=true")
    }

    override fun onPause() {
        super.onPause()
        Log.i(TAG, "MainActivity onPause")
        val webViewId = resources.getIdentifier("webview", "id", packageName)
        val webView = bridge?.webView
            ?: if (webViewId != 0) findViewById<WebView?>(webViewId) else null
        if (webView != null) {
            Log.i(TAG, "Forcing WebView to remain resumed in onPause")
            webView.onResume()
        }
    }

    override fun onStop() {
        super.onStop()
        isActivityVisible = false
        Log.i(TAG, "MainActivity onStop: isActivityVisible=false")
        val webViewId = resources.getIdentifier("webview", "id", packageName)
        val webView = bridge?.webView
            ?: if (webViewId != 0) findViewById<WebView?>(webViewId) else null
        if (webView != null) {
            Log.i(TAG, "Forcing WebView to remain resumed in onStop")
            webView.onResume()
        }
    }

    override fun onDestroy() {
        Log.i(TAG, "MainActivity onDestroy")
        toneManager.stopTone()
        try {
            unregisterReceiver(callActionReceiver)
        } catch (e: Exception) {
            Log.e(TAG, "Error unregistering receiver", e)
        }
        super.onDestroy()
    }
}
