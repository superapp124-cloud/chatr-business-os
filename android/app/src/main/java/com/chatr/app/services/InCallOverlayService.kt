package com.chatr.app.services

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.graphics.Color
import android.graphics.PixelFormat
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.AutomaticGainControl
import android.media.audiofx.NoiseSuppressor
import android.media.AudioManager
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.util.DisplayMetrics
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.app.NotificationCompat
import com.chatr.app.R
import kotlinx.coroutines.*
import java.util.Locale
import kotlin.math.abs

/**
 * CHATR AI GSM Layer — InCallOverlayService
 *
 * Shows a small draggable floating bubble on top of the native Android dialer
 * during active GSM / Wi-Fi carrier calls. Tap the bubble to open the AI Assist Drawer.
 *
 * ARCHITECTURE RULE: Completely isolated from CHATR VoIP / WebRTC.
 */
class InCallOverlayService : Service() {

    private var windowManager: WindowManager? = null
    private var bubbleView: View? = null
    private var drawerView: View? = null
    private var isDrawerOpen = false
    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // Bubble drag state
    private var initialX = 0; private var initialY = 0
    private var initialTouchX = 0f; private var initialTouchY = 0f
    private var isDragging = false
    private var bubbleParams: WindowManager.LayoutParams? = null

    // Audio enhancement
    private var audioRecord: AudioRecord? = null
    private var noiseSuppressor: NoiseSuppressor? = null
    private var echoCanceler: AcousticEchoCanceler? = null
    private var agc: AutomaticGainControl? = null
    private var audioEnhancementActive = false

    // Live captions & Translation
    private var speechRecognizer: SpeechRecognizer? = null
    private var captionsEnabled = false
    private var tts: TextToSpeech? = null
    private var lastTranslatedText = ""

    // AI Interpreter Mode
    private var myLanguage = "Kashmiri"
    private var callerLanguage = "Hindi"
    private var interpreterSpeechRecognizer: SpeechRecognizer? = null
    private var interpreterListening = false
    private val conversationLog = StringBuilder()
    private var voipTranslator: VoipTranslatorService? = null
    private var translatorConnection: ServiceConnection? = null
    private val sttResultReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            // Kept for compatibility with older Web STT broadcasts.
        }
    }

    // Scam detection keywords
    private val suspiciousKeywords = setOf(
        "verify", "urgent", "immediately", "don't tell", "secret", "refund",
        "prize", "lottery", "winner", "selected", "reward", "suspended"
    )
    private val dangerousKeywords = setOf(
        "otp", "one time password", "pin", "cvv", "password", "account number",
        "bank account", "transfer", "send money", "upi", "paytm", "gpay",
        "rbi", "cybercrime", "arrest", "police", "court", "warrant",
        "aadhaar", "pan card", "kyc", "link expired"
    )

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
        bindTranslatorService()
    }

    private fun bindTranslatorService() {
        if (translatorConnection != null) return

        translatorConnection = object : ServiceConnection {
            override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
                voipTranslator = (service as? VoipTranslatorService.LocalBinder)?.getService()
                voipTranslator?.myLanguage = myLanguage
                voipTranslator?.callerLanguage = callerLanguage
                Log.i(TAG, "VoIP translator service connected")
            }

            override fun onServiceDisconnected(name: ComponentName?) {
                voipTranslator = null
                Log.w(TAG, "VoIP translator service disconnected")
            }
        }

        runCatching {
            bindService(
                Intent(this, VoipTranslatorService::class.java),
                translatorConnection!!,
                Context.BIND_AUTO_CREATE
            )
        }.onFailure {
            Log.w(TAG, "Unable to bind translator service: ${it.message}")
            translatorConnection = null
        }
    }



    private var activePhoneNumber: String = ""
    private var previousCallSummary: com.chatr.app.services.CallSummary? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIF_ID, buildForegroundNotification())

        if (intent?.action == ACTION_STOP) { teardown(); stopSelf(); return START_NOT_STICKY }

        intent?.getStringExtra(EXTRA_PHONE_NUMBER)?.let {
            activePhoneNumber = it
            // Load previous summary asynchronously
            serviceScope.launch(Dispatchers.IO) {
                previousCallSummary = CallSummaryEngine.getLatestSummaryForNumber(this@InCallOverlayService, it)
                if (previousCallSummary != null) {
                    withContext(Dispatchers.Main) {
                        updateSummaryUiWithMemory()
                    }
                }
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Log.e(TAG, "SYSTEM_ALERT_WINDOW permission missing"); stopSelf(); return START_NOT_STICKY
        }

        if (bubbleView == null) showBubble()
        return START_NOT_STICKY
    }

    private fun updateSummaryUiWithMemory() {
        val summary = previousCallSummary ?: return
        drawerView?.findViewById<android.widget.TextView>(R.id.summaryPlaceholderText)?.let {
            if (summary.keyPoints.isEmpty()) {
                it.text = "You haven't spoken to this person recently, or the last call was too short to analyze.\n\n✨ AI will summarize your chat after you hang up."
            } else {
                it.text = "Last time you discussed:\n\n${summary.summary}\n\nKey Points:\n${summary.keyPoints.joinToString("\n") { pt -> "• $pt" }}"
            }
            it.setTextColor(Color.parseColor("#E5E7EB"))
            it.gravity = Gravity.START
        }
    }

    // ── Floating Bubble ───────────────────────────────────────────────────────

    private fun showBubble() {
        val inflater = getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater
        val wrapper = androidx.appcompat.view.ContextThemeWrapper(this, R.style.AppTheme)
        bubbleView = inflater.cloneInContext(wrapper).inflate(R.layout.overlay_active_call_strip, null)

        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        (getSystemService(Context.WINDOW_SERVICE) as WindowManager).defaultDisplay.getMetrics(metrics)
        val screenWidth = metrics.widthPixels

        bubbleParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = screenWidth - dpToPx(72)   // Start pinned to right edge
            y = dpToPx(120)
        }

        // Drag + tap logic
        bubbleView?.setOnTouchListener(object : View.OnTouchListener {
            private var downTime = 0L
            override fun onTouch(v: View, event: MotionEvent): Boolean {
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        downTime = System.currentTimeMillis()
                        initialX = bubbleParams!!.x
                        initialY = bubbleParams!!.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        isDragging = false
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val dx = (event.rawX - initialTouchX).toInt()
                        val dy = (event.rawY - initialTouchY).toInt()
                        if (abs(dx) > 8 || abs(dy) > 8) isDragging = true
                        if (isDragging) {
                            bubbleParams!!.x = initialX + dx
                            bubbleParams!!.y = initialY + dy
                            windowManager?.updateViewLayout(bubbleView, bubbleParams)
                        }
                    }
                    MotionEvent.ACTION_UP -> {
                        val elapsed = System.currentTimeMillis() - downTime
                        if (!isDragging && elapsed < 350) {
                            // Short tap → open/close drawer
                            if (isDrawerOpen) closeAiDrawer() else openAiDrawer()
                        } else if (isDragging) {
                            // Snap to nearest edge
                            snapToEdge(screenWidth)
                        }
                    }
                }
                return true
            }
        })

        try {
            windowManager?.addView(bubbleView, bubbleParams)
        } catch (e: Exception) {
            Log.e(TAG, "Error adding bubble", e)
        }

        // Start pulse animation
        startPulseAnimation()
        // Start audio enhancement
        startAudioEnhancement()
    }

    /** Snap bubble to nearest horizontal edge, like Messenger chat heads */
    private fun snapToEdge(screenWidth: Int) {
        val params = bubbleParams ?: return
        val bubbleSize = dpToPx(60)
        val targetX = if (params.x + bubbleSize / 2 < screenWidth / 2) {
            dpToPx(8)           // Snap left
        } else {
            screenWidth - bubbleSize - dpToPx(8)  // Snap right
        }
        val animator = ValueAnimator.ofInt(params.x, targetX).apply {
            duration = 250
            interpolator = DecelerateInterpolator()
            addUpdateListener {
                params.x = it.animatedValue as Int
                try { windowManager?.updateViewLayout(bubbleView, params) } catch (_: Exception) {}
            }
        }
        animator.start()
    }

    /** Subtle continuous pulse on the glow ring */
    private fun startPulseAnimation() {
        val glowRing = bubbleView?.findViewById<View>(R.id.bubbleGlowRing) ?: return
        ObjectAnimator.ofFloat(glowRing, "scaleX", 1f, 1.3f, 1f).apply {
            duration = 2000; repeatCount = ObjectAnimator.INFINITE
            interpolator = DecelerateInterpolator()
        }.start()
        ObjectAnimator.ofFloat(glowRing, "scaleY", 1f, 1.3f, 1f).apply {
            duration = 2000; repeatCount = ObjectAnimator.INFINITE
            interpolator = DecelerateInterpolator()
        }.start()
    }

    // ── AI Assist Drawer ──────────────────────────────────────────────────────

    private fun openAiDrawer() {
        if (drawerView != null || isDrawerOpen) return
        isDrawerOpen = true

        val inflater = getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater
        val wrapper = androidx.appcompat.view.ContextThemeWrapper(this, R.style.AppTheme)
        drawerView = inflater.cloneInContext(wrapper).inflate(R.layout.overlay_ai_drawer, null)

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL }

        // Swipe down to close
        drawerView?.setOnTouchListener(object : View.OnTouchListener {
            private var startY = 0f
            override fun onTouch(v: View, event: MotionEvent): Boolean {
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> startY = event.rawY
                    MotionEvent.ACTION_UP -> if (event.rawY - startY > 80) closeAiDrawer()
                }
                return true
            }
        })

        drawerView?.findViewById<View>(R.id.btnToggleCaptions)?.setOnClickListener {
            if (captionsEnabled) stopCaptions() else startCaptions()
        }
        drawerView?.findViewById<View>(R.id.btnEndSession)?.setOnClickListener {
            closeAiDrawer()
        }
        
        val btnStudioVoice = drawerView?.findViewById<TextView>(R.id.btnStudioVoice)
        btnStudioVoice?.setOnClickListener {
            if (audioEnhancementActive) {
                stopAudioEnhancement()
                btnStudioVoice.setTextColor(Color.parseColor("#9CA3AF"))
                btnStudioVoice.text = "✨ Studio Voice"
            } else {
                startAudioEnhancement()
                btnStudioVoice.setTextColor(Color.parseColor("#A78BFA"))
                btnStudioVoice.text = "✨ Studio Voice: ON"
            }
        }

        // Tab Switching Logic
        val tabCaptions = drawerView?.findViewById<TextView>(R.id.tabCaptions)
        val tabNotes = drawerView?.findViewById<TextView>(R.id.tabNotes)
        val tabScam = drawerView?.findViewById<TextView>(R.id.tabScam)
        val tabSummary = drawerView?.findViewById<TextView>(R.id.tabSummary)
        
        val containerCaptions = drawerView?.findViewById<View>(R.id.containerCaptions)
        val containerNotes = drawerView?.findViewById<View>(R.id.containerNotes)
        val containerScam = drawerView?.findViewById<View>(R.id.containerScam)
        val containerSummary = drawerView?.findViewById<View>(R.id.containerSummary)
        val containerTranslate = drawerView?.findViewById<View>(R.id.containerTranslate)
        val btnToggleCaptions = drawerView?.findViewById<View>(R.id.btnToggleCaptions)

        fun selectTab(index: Int) {
            val colorActive = Color.parseColor("#A78BFA")
            val colorInactive = Color.parseColor("#6B7280")

            tabCaptions?.setTextColor(if (index == 0) colorActive else colorInactive)
            tabNotes?.setTextColor(if (index == 1) colorActive else colorInactive)
            tabScam?.setTextColor(if (index == 2) colorActive else colorInactive)
            tabSummary?.setTextColor(if (index == 3) colorActive else colorInactive)
            val tabTranslate = drawerView?.findViewById<TextView>(R.id.tabTranslate)
            tabTranslate?.setTextColor(if (index == 4) colorActive else colorInactive)

            containerCaptions?.visibility = if (index == 0) View.VISIBLE else View.GONE
            containerNotes?.visibility = if (index == 1) View.VISIBLE else View.GONE
            containerScam?.visibility = if (index == 2) View.VISIBLE else View.GONE
            containerSummary?.visibility = if (index == 3) View.VISIBLE else View.GONE
            containerTranslate?.visibility = if (index == 4) View.VISIBLE else View.GONE

        // Only show captions toggle for captions tab (not translate)
            btnToggleCaptions?.visibility = if (index == 0) View.VISIBLE else View.INVISIBLE
        }

        tabCaptions?.setOnClickListener { selectTab(0) }
        tabNotes?.setOnClickListener { selectTab(1) }
        tabScam?.setOnClickListener { selectTab(2) }
        tabSummary?.setOnClickListener { selectTab(3) }
        drawerView?.findViewById<TextView>(R.id.tabTranslate)?.setOnClickListener { selectTab(4) }

        // ── Interpreter Mode — REMOVED (Migrated to WebRTC JS) ──
        drawerView?.findViewById<View>(R.id.btnISpeaking)?.setOnClickListener {
             drawerView?.findViewById<TextView>(R.id.translateText)
                 ?.text = "Translation is now handled in the Chatr+ VoIP Calling interface!"
        }
        drawerView?.findViewById<View>(R.id.btnTheySpeaking)?.setOnClickListener {
             drawerView?.findViewById<TextView>(R.id.translateText)
                 ?.text = "Translation is now handled in the Chatr+ VoIP Calling interface!"
        }

        // Initial state
        selectTab(0)

        try { windowManager?.addView(drawerView, params) } catch (e: Exception) {
            Log.e(TAG, "Error opening drawer", e)
        }

        // Apply call memory to the summary tab if we have it
        updateSummaryUiWithMemory()
    }

    private fun closeAiDrawer() {
        // Save notes
        drawerView?.findViewById<android.widget.EditText>(R.id.editNotes)?.text?.toString()?.let { notes ->
            if (notes.isNotBlank()) {
                val prefs = getSharedPreferences("chatr_native_call_capture", Context.MODE_PRIVATE)
                prefs.edit().putString("active_notes", notes).apply()
            }
        }
        isDrawerOpen = false
        drawerView?.let {
            try { windowManager?.removeView(it) } catch (_: Exception) {}
            drawerView = null
        }
    }

    // ── Scam Detection ────────────────────────────────────────────────────────

    private var currentRiskLevel = 0 // 0=Safe, 1=Suspicious, 2=Dangerous

    private fun triggerScamWarning(isDangerous: Boolean) {
        val newLevel = if (isDangerous) 2 else 1
        if (newLevel <= currentRiskLevel) return
        currentRiskLevel = newLevel

        serviceScope.launch(Dispatchers.Main) {
            val bgColor = if (isDangerous) R.drawable.bubble_bg_red else R.drawable.bubble_bg_yellow
            val iconBgColor = if (isDangerous) R.drawable.status_dot_red else R.drawable.status_dot_yellow
            val textColor = if (isDangerous) "#EF4444" else "#EAB308"
            val symbol = if (isDangerous) "!" else "?"
            val title = if (isDangerous) "⚠ DANGEROUS SCAM ALERT" else "⚠ SUSPICIOUS ACTIVITY"
            val text = if (isDangerous) {
                "Do NOT share OTPs, passwords, or bank details.\nHang up immediately."
            } else {
                "Caller is using pressure tactics or suspicious keywords.\nProceed with caution."
            }

            val riskScore = if (isDangerous) 95 else 50

            // Turn bubble red/yellow
            bubbleView?.findViewById<View>(R.id.bubbleBody)
                ?.setBackgroundResource(bgColor)
            bubbleView?.findViewById<View>(R.id.bubbleStatusDot)
                ?.setBackgroundResource(iconBgColor)
            bubbleView?.findViewById<TextView>(R.id.bubbleIcon)?.text = symbol

            // If drawer is open, update it
            drawerView?.let { drawer ->
                drawer.findViewById<TextView>(R.id.captionsText)?.let {
                    it.setTextColor(Color.parseColor(textColor))
                    it.text = "$title\n\n$text"
                }
                
                drawer.findViewById<TextView>(R.id.scamStatusIcon)?.let {
                    it.setBackgroundResource(iconBgColor)
                    it.text = symbol
                }
                drawer.findViewById<TextView>(R.id.scamStatusText)?.let {
                    it.setTextColor(Color.parseColor(textColor))
                    it.text = "$title\n\n$text"
                }
                
                // Animate Risk Score Bar
                drawer.findViewById<android.widget.ProgressBar>(R.id.scamRiskBar)?.let { bar ->
                    val color = if (isDangerous) Color.parseColor("#EF4444") else Color.parseColor("#EAB308")
                    bar.progressTintList = android.content.res.ColorStateList.valueOf(color)
                    ObjectAnimator.ofInt(bar, "progress", bar.progress, riskScore).apply {
                        duration = 1000
                        interpolator = DecelerateInterpolator()
                        start()
                    }
                }
                drawer.findViewById<TextView>(R.id.scamRiskText)?.text = "Risk Score: $riskScore/100"

                // Cinematic Red Pulse Background
                if (isDangerous) {
                    val colorAnim = ObjectAnimator.ofArgb(drawer, "backgroundColor", Color.parseColor("#EE0D0D0D"), Color.parseColor("#44330000"))
                    colorAnim.duration = 800
                    colorAnim.repeatCount = ValueAnimator.INFINITE
                    colorAnim.repeatMode = ValueAnimator.REVERSE
                    colorAnim.start()
                    
                    // Haptic feedback
                    val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? android.os.Vibrator
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator?.vibrate(android.os.VibrationEffect.createWaveform(longArrayOf(0, 100, 100, 100, 100, 500), -1))
                    } else {
                        @Suppress("DEPRECATION")
                        vibrator?.vibrate(longArrayOf(0, 100, 100, 100, 100, 500), -1)
                    }
                }
            }

            Log.w(TAG, "Scam keywords detected — risk level $currentRiskLevel")
        }
    }

    // ── Audio Enhancement ─────────────────────────────────────────────────────

    private fun startAudioEnhancement() {
        try {
            val minBufSize = AudioRecord.getMinBufferSize(16000,
                android.media.AudioFormat.CHANNEL_IN_MONO,
                android.media.AudioFormat.ENCODING_PCM_16BIT)
            audioRecord = AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, 16000,
                android.media.AudioFormat.CHANNEL_IN_MONO,
                android.media.AudioFormat.ENCODING_PCM_16BIT, minBufSize)

            val sid = audioRecord!!.audioSessionId
            if (NoiseSuppressor.isAvailable()) {
                noiseSuppressor = NoiseSuppressor.create(sid); noiseSuppressor?.enabled = true
            }
            if (AcousticEchoCanceler.isAvailable()) {
                echoCanceler = AcousticEchoCanceler.create(sid); echoCanceler?.enabled = true
            }
            if (AutomaticGainControl.isAvailable()) {
                agc = AutomaticGainControl.create(sid); agc?.enabled = true
            }
            audioRecord?.startRecording()
            audioEnhancementActive = true
            Log.i(TAG, "Audio enhancement active")
        } catch (e: Exception) {
            Log.e(TAG, "Audio enhancement failed: ${e.message}")
        }
    }

    private fun stopAudioEnhancement() {
        try {
            noiseSuppressor?.release(); echoCanceler?.release(); agc?.release()
            audioRecord?.stop(); audioRecord?.release()
        } catch (_: Exception) {}
        audioRecord = null; noiseSuppressor = null; echoCanceler = null; agc = null
    }

    // ── Live Captions ─────────────────────────────────────────────────────────

    private fun startCaptions() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            updateCaptionsText("[Captions not available on this device]"); return
        }
        captionsEnabled = true
        drawerView?.findViewById<TextView>(R.id.btnToggleCaptions)?.text = "Stop Captions"
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)
        speechRecognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(p: android.os.Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(r: Float) {}
            override fun onBufferReceived(b: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onError(e: Int) { if (captionsEnabled) restartCaptions() }
            override fun onResults(r: android.os.Bundle?) {
                val text = r?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                if (!text.isNullOrBlank()) {
                    updateCaptionsText("[Caller] $text", isFinal = true)
                    checkScam(text)
                }
                if (captionsEnabled) restartCaptions()
            }
            override fun onPartialResults(r: android.os.Bundle?) {
                val text = r?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                if (!text.isNullOrBlank()) updateCaptionsText("[Caller] $text...", isFinal = false)
            }
            override fun onEvent(t: Int, p: android.os.Bundle?) {}
        })
        restartCaptions()
    }

    private fun restartCaptions() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
        try { speechRecognizer?.startListening(intent) } catch (_: Exception) {}
    }

    private fun stopCaptions() {
        captionsEnabled = false
        drawerView?.findViewById<TextView>(R.id.btnToggleCaptions)?.text = "Start Captions"
        speechRecognizer?.destroy(); speechRecognizer = null
    }

    private fun updateCaptionsText(text: String, isFinal: Boolean = true) {
        serviceScope.launch(Dispatchers.Main) {
            val drawer = drawerView ?: return@launch
            
            // 1. Emotion + Tone Analysis
            val lower = text.lowercase()
            var toneEmoji = "😐"
            if (lower.contains("thanks") || lower.contains("appreciate") || lower.contains("great") || lower.contains("perfect") || lower.contains("happy")) {
                toneEmoji = "😊"
            } else if (lower.contains("angry") || lower.contains("cancel") || lower.contains("frustrated") || lower.contains("terrible") || lower.contains("bad")) {
                toneEmoji = "😠"
            }
            drawer.findViewById<TextView>(R.id.liveIndicator)?.text = "● LIVE $toneEmoji"

            // 2. Contextual Highlights
            // Use regex to find dates/days and numbers
            var highlightedText = text
            highlightedText = highlightedText.replace(Regex("(?i)\\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|jan\\w*|feb\\w*|mar\\w*|apr\\w*|may|jun\\w*|jul\\w*|aug\\w*|sep\\w*|oct\\w*|nov\\w*|dec\\w*)\\b"), "<font color='#A78BFA'><b>$1</b></font>")
            highlightedText = highlightedText.replace(Regex("\\b(\\d{3,}|\\$\\d+)\\b"), "<font color='#A78BFA'><b>$1</b></font>")
            
            drawer.findViewById<TextView>(R.id.captionsText)?.text = android.text.Html.fromHtml(highlightedText, android.text.Html.FROM_HTML_MODE_LEGACY)

            // 3. Smart Detection Chips
            val chipsContainer = drawer.findViewById<android.widget.LinearLayout>(R.id.liveChipsContainer)
            if (chipsContainer != null) {
                chipsContainer.removeAllViews()
                
                if (Regex("(?i)\\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\\b").containsMatchIn(text)) {
                    val chip = android.view.LayoutInflater.from(this@InCallOverlayService).inflate(R.layout.item_action_chip, chipsContainer, false) as TextView
                    chip.text = "✨ Add Reminder"
                    chipsContainer.addView(chip)
                }
                if (Regex("\\b\\d{10}\\b").containsMatchIn(text)) {
                    val chip = android.view.LayoutInflater.from(this@InCallOverlayService).inflate(R.layout.item_action_chip, chipsContainer, false) as TextView
                    chip.text = "👤 Save Contact"
                    chipsContainer.addView(chip)
                }
            }
        }
    }

    private fun checkScam(transcript: String) {
        val lower = transcript.lowercase()
        if (dangerousKeywords.any { lower.contains(it) }) {
            triggerScamWarning(isDangerous = true)
        } else if (suspiciousKeywords.any { lower.contains(it) }) {
            triggerScamWarning(isDangerous = false)
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun dpToPx(dp: Int): Int =
        (dp * resources.displayMetrics.density).toInt()

    private fun teardown() {
        Log.i(TAG, "Teardown called")
        try {
            translatorConnection?.let {
                unbindService(it)
                translatorConnection = null
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        serviceScope.cancel()
        stopCaptions()
        stopAudioEnhancement()
        closeAiDrawer()
        tts?.stop()
        tts?.shutdown()
        tts = null
        bubbleView?.let {
            try { windowManager?.removeView(it) } catch (_: Exception) {}
            bubbleView = null
        }
    }

    override fun onDestroy() { teardown(); super.onDestroy() }

    private fun buildForegroundNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Chatr AI • Active")
            .setContentText("Tap the AI bubble on your screen to open insights")
            .setSmallIcon(NotificationBranding.SMALL_ICON)
            .setLargeIcon(NotificationBranding.largeIcon(this))
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .build()

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL_ID, "Chatr AI Call Intelligence",
                NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) }
            getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
    }

    companion object {
        private const val TAG = "InCallOverlayService"
        private const val CHANNEL_ID = "ChatrAICallLayer"
        private const val NOTIF_ID = 9002
        const val ACTION_STOP = "com.chatr.app.INCALL_OVERLAY_STOP"
        const val EXTRA_PHONE_NUMBER = "phone_number"

        fun start(context: Context, phoneNumber: String) {
            val i = Intent(context, InCallOverlayService::class.java).apply {
                putExtra(EXTRA_PHONE_NUMBER, phoneNumber)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                context.startForegroundService(i) else context.startService(i)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, InCallOverlayService::class.java))
        }
    }
}
