package com.chatr.app.webrtc

import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.bumptech.glide.Glide
import com.chatr.app.R
import com.chatr.app.services.ChatrConnectionService
import com.chatr.app.services.ChatrVoipCallRegistry
import android.media.AudioManager
import android.os.SystemClock
import android.widget.Chronometer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoTrack
import org.webrtc.RendererCommon
import android.widget.FrameLayout
import android.view.ViewGroup
import android.graphics.Color
import android.widget.GridLayout
import android.widget.LinearLayout

/**
 * ShieldActiveCallActivity
 * 
 * The native Android active call UI for the Chatr Shield experience.
 * Replaces ActiveCallActivity with the new glassmorphism Shield design.
 */
class ShieldActiveCallActivity : AppCompatActivity(), 
    WebRTCEventListener, 
    SignalingListener, 
    ShieldMoreBottomSheet.MoreSheetListener,
    ShieldSettingsBottomSheet.SettingsSheetListener {

    private lateinit var webrtcClient: NativeWebRTCClient
    private lateinit var signalingClient: NativeSignalingClient

    private var isMuted = false
    private var isSpeakerOn = true
    private var isVideoOn = false
    private var callId: String = ""

    private var durationChronometer: Chronometer? = null
    
    // For Video Calls
    private var localVideoView: SurfaceViewRenderer? = null
    private var remoteVideoGrid: FrameLayout? = null
    private val remoteVideoViews = mutableMapOf<String, SurfaceViewRenderer>()
    
    // Auto-Hide UI
    private val uiHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private var isUiVisible = true
    private val hideControlsRunnable = java.lang.Runnable { hideControls() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        setupImmersiveMode()
        setContentView(R.layout.activity_shield_active_call)

        callId = intent.getStringExtra("call_id") ?: ""
        
        setupAudio()
        setupUI()
        setupVideoViews()
        setupAutoHide()

        initWebRTC()
        
        if (intent.getStringExtra("call_type") == "video") {
            toggleVideo()
        }
    }

    private fun setupImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).let { controller ->
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun setupAudio() {
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        audioManager.isSpeakerphoneOn = true
        isSpeakerOn = true
    }

    private fun setupUI() {
        val callerNameExtra = intent.getStringExtra("caller_name") ?: ""
        val callerPhoneExtra = intent.getStringExtra("caller_phone") ?: intent.getStringExtra("caller_number") ?: ""
        val callerId = intent.getStringExtra("caller_id") ?: ""
        
        val callerName = ChatrVoipCallRegistry.resolveDisplayName(this, callId, callerId, callerNameExtra, callerPhoneExtra)
        val callerAvatar = ChatrVoipCallRegistry.resolveAvatar(this, callId, callerId, intent.getStringExtra("caller_avatar"), callerPhoneExtra, callerNameExtra)

        findViewById<TextView>(R.id.callerNameText)?.text = callerName.ifBlank { callerPhoneExtra }
        
        durationChronometer = Chronometer(this).apply {
            base = SystemClock.elapsedRealtime()
            setTextColor(getColor(R.color.shield_text_secondary))
            textSize = 18f
            start()
        }
        val durationContainer = findViewById<TextView>(R.id.callDurationText)
        val parent = durationContainer.parent as ViewGroup
        val index = parent.indexOfChild(durationContainer)
        parent.removeView(durationContainer)
        durationChronometer?.id = R.id.callDurationText
        parent.addView(durationChronometer, index, durationContainer.layoutParams)

        val avatarView = findViewById<ImageView>(R.id.callerAvatarImage)
        val initialView = findViewById<TextView>(R.id.callerInitialText)
        if (!callerAvatar.isNullOrBlank()) {
            initialView?.visibility = View.GONE
            avatarView?.visibility = View.VISIBLE
            avatarView?.let {
                Glide.with(this).load(callerAvatar).circleCrop().into(it)
            }
            findViewById<ImageView>(R.id.backgroundBlurImage)?.let { bgView ->
                Glide.with(this).load(callerAvatar).centerCrop().into(bgView)
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                    bgView.setRenderEffect(android.graphics.RenderEffect.createBlurEffect(50f, 50f, android.graphics.Shader.TileMode.CLAMP))
                }
            }
        } else {
            avatarView?.visibility = View.INVISIBLE
            avatarView?.setImageDrawable(null)
            initialView?.visibility = View.VISIBLE
            initialView?.text = callerName.firstOrNull { it.isLetterOrDigit() }?.uppercaseChar()?.toString() ?: "C"
        }

        findViewById<View>(R.id.btnMute)?.setOnClickListener { toggleMute() }
        findViewById<View>(R.id.btnVideo)?.setOnClickListener { toggleVideo() }
        findViewById<View>(R.id.btnSpeaker)?.setOnClickListener { toggleSpeaker() }
        findViewById<View>(R.id.btnFlipCamera)?.setOnClickListener { 
            webrtcClient.switchCamera() 
        }
        findViewById<View>(R.id.btnAddParticipant)?.setOnClickListener {
            val shareIntent = android.content.Intent().apply {
                action = android.content.Intent.ACTION_SEND
                putExtra(android.content.Intent.EXTRA_TEXT, "Join my Chatr+ call: https://chatr.chat/call/$callId")
                type = "text/plain"
            }
            startActivity(android.content.Intent.createChooser(shareIntent, "Invite to Call"))
        }
        findViewById<View>(R.id.btnMore)?.setOnClickListener {
            val sheet = ShieldMoreBottomSheet()
            sheet.listener = this
            sheet.show(supportFragmentManager, "ShieldMoreBottomSheet")
        }
        
        setupZoomControls()

        findViewById<View>(R.id.btnEndCall)?.setOnClickListener { endCall() }
    }
    
    private fun setupAutoHide() {
        val rootLayout = findViewById<View>(android.R.id.content)
        val gestureDetector = android.view.GestureDetector(this, object : android.view.GestureDetector.SimpleOnGestureListener() {
            override fun onSingleTapConfirmed(e: android.view.MotionEvent): Boolean {
                if (isUiVisible) {
                    hideControls()
                } else {
                    showControls()
                }
                return true
            }

            override fun onDoubleTap(e: android.view.MotionEvent): Boolean {
                hideControls()
                return true
            }
        })
        
        rootLayout.setOnTouchListener { _, event ->
            gestureDetector.onTouchEvent(event)
            false
        }
        
        // Initial auto-hide trigger removed per user request
        // scheduleHideControls()
    }
    
    private fun scheduleHideControls() {
        uiHandler.removeCallbacks(hideControlsRunnable)
        uiHandler.postDelayed(hideControlsRunnable, 2000)
    }
    
    private fun hideControls() {
        if (!isUiVisible) return
        isUiVisible = false
        uiHandler.removeCallbacks(hideControlsRunnable)
        
        val bottomControls = findViewById<View>(R.id.bottomControlsPanel)
        val zoomToggle = findViewById<View>(R.id.btnZoomToggle)
        val callerOverlay = findViewById<View>(R.id.videoCallerNameOverlay)
        val zoomPanel = findViewById<View>(R.id.zoomOptionsPanel)
        
        zoomPanel?.visibility = View.GONE
        
        bottomControls?.animate()?.alpha(0f)?.translationY(100f)?.setDuration(300)?.start()
        zoomToggle?.animate()?.alpha(0f)?.translationY(100f)?.setDuration(300)?.start()
        callerOverlay?.animate()?.alpha(0f)?.translationY(-100f)?.setDuration(300)?.start()
    }
    
    private fun showControls() {
        if (isUiVisible) return
        isUiVisible = true
        
        val bottomControls = findViewById<View>(R.id.bottomControlsPanel)
        val zoomToggle = findViewById<View>(R.id.btnZoomToggle)
        val callerOverlay = findViewById<View>(R.id.videoCallerNameOverlay)
        
        bottomControls?.animate()?.alpha(1f)?.translationY(0f)?.setDuration(300)?.start()
        zoomToggle?.animate()?.alpha(1f)?.translationY(0f)?.setDuration(300)?.start()
        callerOverlay?.animate()?.alpha(1f)?.translationY(0f)?.setDuration(300)?.start()
        callerOverlay?.animate()?.alpha(1f)?.translationY(0f)?.setDuration(300)?.start()
        
        // scheduleHideControls()
    }

    override fun onReactionClicked() {
        val overlay = findViewById<FrameLayout>(R.id.reactionsOverlay) ?: return
        val emojis = listOf("👍", "❤️", "😂", "🎉", "🔥")
        val randomEmoji = emojis.random()
        
        val textView = TextView(this).apply {
            text = randomEmoji
            textSize = 48f
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = android.view.Gravity.BOTTOM or android.view.Gravity.CENTER_HORIZONTAL
                bottomMargin = 200
            }
        }
        
        overlay.addView(textView)
        
        textView.animate()
            .translationYBy(-500f)
            .alpha(0f)
            .setDuration(2000)
            .withEndAction { overlay.removeView(textView) }
            .start()
    }

    override fun onChatClicked() {
        val prefs = getSharedPreferences("chatr_prefs", Context.MODE_PRIVATE)
        val myUserId = prefs.getString("user_id", "") ?: ""
        com.chatr.app.shield.ShieldChatSheet.newInstance(callId, myUserId)
            .show(supportFragmentManager, "ShieldChatSheet")
    }

    private fun setupZoomControls() {
        val btnZoomToggle = findViewById<View>(R.id.btnZoomToggle)
        val zoomOptionsPanel = findViewById<View>(R.id.zoomOptionsPanel)
        val tvZoomLabel = findViewById<TextView>(R.id.tvZoomLabel)
        
        btnZoomToggle?.setOnClickListener {
            val isVisible = zoomOptionsPanel?.visibility == View.VISIBLE
            zoomOptionsPanel?.visibility = if (isVisible) View.GONE else View.VISIBLE
        }
        
        val zoomLevels = mapOf(
            R.id.btnZoom05 to 0.5f,
            R.id.btnZoom1 to 1.0f,
            R.id.btnZoom2 to 2.0f,
            R.id.btnZoom3 to 3.0f,
            R.id.btnZoom5 to 5.0f
        )
        
        for ((id, level) in zoomLevels) {
            findViewById<View>(id)?.setOnClickListener {
                onZoomChanged(level)
                tvZoomLabel?.text = "🔍 ${level}x"
                zoomOptionsPanel?.visibility = View.GONE
            }
        }
    }

    override fun onZoomChanged(zoomLevel: Float) {
        // Digital zoom using scale on the local video view
        localVideoView?.scaleX = zoomLevel
        localVideoView?.scaleY = zoomLevel
    }

    override fun onThemeSelected(themeName: String) {
        val color = when (themeName) {
            "Cosmic" -> Color.parseColor("#336200EA") // Deep purple tint
            "Aurora" -> Color.parseColor("#3300C853") // Green tint
            "Midnight" -> Color.parseColor("#33000000") // Dark tint
            "Ocean" -> Color.parseColor("#332962FF") // Blue tint
            "Forest" -> Color.parseColor("#331B5E20") // Dark green tint
            "Sunset" -> Color.parseColor("#33FF6D00") // Orange tint
            "Royal" -> Color.parseColor("#33D50000") // Red tint
            else -> Color.TRANSPARENT
        }
        // Create an overlay view if it doesn't exist, or just use the reactions overlay background
        val overlay = findViewById<FrameLayout>(R.id.reactionsOverlay)
        overlay?.setBackgroundColor(color)
    }

    override fun onAiAssistantClicked() {
        com.chatr.app.shield.ShieldChatSheet.newInstance(callId, intent.getStringExtra("my_user_id") ?: "me")
            .show(supportFragmentManager, "ShieldChatSheet")
    }

    override fun onSnapshotClicked() {
        android.widget.Toast.makeText(this, "Snapshot taking...", android.widget.Toast.LENGTH_SHORT).show()
        val rootView = findViewById<View>(android.R.id.content)
        val bitmap = android.graphics.Bitmap.createBitmap(rootView.width, rootView.height, android.graphics.Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(bitmap)
        rootView.draw(canvas)
        
        // Save to MediaStore
        val resolver = contentResolver
        val contentValues = android.content.ContentValues().apply {
            put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, "chatr_snapshot_${System.currentTimeMillis()}.png")
            put(android.provider.MediaStore.MediaColumns.MIME_TYPE, "image/png")
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_PICTURES + "/CHATR")
            }
        }
        val uri = resolver.insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)
        if (uri != null) {
            resolver.openOutputStream(uri)?.use { out ->
                bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, out)
            }
            android.widget.Toast.makeText(this, "Snapshot saved to Gallery", android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    override fun onSettingsClicked() {
        val sheet = ShieldSettingsBottomSheet()
        sheet.listener = this
        // Basic state passing
        sheet.isDataSaverOn = false // Default
        sheet.isLowLightOn = false // Default
        sheet.show(supportFragmentManager, "ShieldSettingsBottomSheet")
    }

    override fun onEffectsClicked() {
        val sheet = ShieldEffectsBottomSheet()
        sheet.listener = object : ShieldEffectsBottomSheet.EffectsSheetListener {
            override fun onEffectSelected(effectName: String) {
                // For now, map simple effects to theme color overlay or basic toast
                when (effectName) {
                    "Blur" -> android.widget.Toast.makeText(this@ShieldActiveCallActivity, "Background Blur requires ML Kit (coming later)", android.widget.Toast.LENGTH_SHORT).show()
                    "StudioLight" -> android.widget.Toast.makeText(this@ShieldActiveCallActivity, "Studio Light enabled", android.widget.Toast.LENGTH_SHORT).show()
                    "BlackAndWhite" -> android.widget.Toast.makeText(this@ShieldActiveCallActivity, "B&W Filter enabled", android.widget.Toast.LENGTH_SHORT).show()
                    "None" -> android.widget.Toast.makeText(this@ShieldActiveCallActivity, "Effects cleared", android.widget.Toast.LENGTH_SHORT).show()
                }
            }
        }
        sheet.show(supportFragmentManager, "ShieldEffectsBottomSheet")
    }

    override fun onThemesMenuClicked() {
        val sheet = ShieldThemesBottomSheet()
        sheet.listener = object : ShieldThemesBottomSheet.ThemesSheetListener {
            override fun onThemeSelected(themeName: String) {
                this@ShieldActiveCallActivity.onThemeSelected(themeName)
            }
        }
        sheet.show(supportFragmentManager, "ShieldThemesBottomSheet")
    }

    private val screenShareLauncher = registerForActivityResult(androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == RESULT_OK && result.data != null) {
            val intentData = result.data!!
            
            // Start foreground service to keep capture alive
            val serviceIntent = android.content.Intent(this, ScreenCaptureService::class.java)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
            
            webrtcClient.startScreenCapture(intentData)
            android.widget.Toast.makeText(this, "Screen Share started", android.widget.Toast.LENGTH_SHORT).show()
            isScreenSharing = true
        } else {
            android.widget.Toast.makeText(this, "Screen Share permission denied", android.widget.Toast.LENGTH_SHORT).show()
        }
    }
    
    private var isScreenSharing = false

    override fun onScreenShareClicked() {
        if (isScreenSharing) {
            webrtcClient.stopScreenCapture()
            val serviceIntent = android.content.Intent(this, ScreenCaptureService::class.java)
            stopService(serviceIntent)
            isScreenSharing = false
            android.widget.Toast.makeText(this, "Screen Share stopped", android.widget.Toast.LENGTH_SHORT).show()
            return
        }
        
        val mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as android.media.projection.MediaProjectionManager
        screenShareLauncher.launch(mediaProjectionManager.createScreenCaptureIntent())
    }

    // SettingsSheetListener Implementation
    override fun onAudioDeviceChanged(device: String) {
        android.widget.Toast.makeText(this, "Audio Device changed to: $device", android.widget.Toast.LENGTH_SHORT).show()
    }

    override fun onDataSaverToggled(enabled: Boolean) {
        android.widget.Toast.makeText(this, "Data Saver: ${if (enabled) "ON" else "OFF"}", android.widget.Toast.LENGTH_SHORT).show()
    }

    override fun onLowLightToggled(enabled: Boolean) {
        android.widget.Toast.makeText(this, "Low-Light Mode: ${if (enabled) "ON" else "OFF"}", android.widget.Toast.LENGTH_SHORT).show()
    }

    private fun setupVideoViews() {
        // Use the containers defined in XML
        remoteVideoGrid = findViewById<FrameLayout>(R.id.remoteVideoContainer)
        
        val localContainer = findViewById<androidx.cardview.widget.CardView>(R.id.localVideoContainer)
        localVideoView = SurfaceViewRenderer(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setZOrderMediaOverlay(true)
        }
        localContainer?.addView(localVideoView)
        
        setupPiPGestures(localContainer)
    }

    private var dX = 0f
    private var dY = 0f
    private fun setupPiPGestures(localContainer: View?) {
        if (localContainer == null) return
        
        val gestureDetector = android.view.GestureDetector(this, object : android.view.GestureDetector.SimpleOnGestureListener() {
            override fun onDoubleTap(e: android.view.MotionEvent): Boolean {
                webrtcClient.switchCamera()
                return true
            }
        })
        
        localContainer.setOnTouchListener { view, event ->
            if (gestureDetector.onTouchEvent(event)) return@setOnTouchListener true
            
            when (event.actionMasked) {
                android.view.MotionEvent.ACTION_DOWN -> {
                    dX = view.x - event.rawX
                    dY = view.y - event.rawY
                    view.animate().scaleX(1.05f).scaleY(1.05f).setDuration(100).start()
                    true
                }
                android.view.MotionEvent.ACTION_MOVE -> {
                    view.x = event.rawX + dX
                    view.y = event.rawY + dY
                    true
                }
                android.view.MotionEvent.ACTION_UP, android.view.MotionEvent.ACTION_CANCEL -> {
                    view.animate().scaleX(1f).scaleY(1f).setDuration(100).start()
                    // Magnetic snapping could be implemented here
                    true
                }
                else -> false
            }
        }
    }

    private fun toggleMute() {
        isMuted = !isMuted
        webrtcClient.toggleAudio(!isMuted)
        val btnMute = findViewById<View>(R.id.btnMute)
        val frameLayout = (btnMute as ViewGroup).getChildAt(0) as FrameLayout
        frameLayout.backgroundTintList = getColorStateList(if (isMuted) R.color.shield_text_primary else R.color.shield_glass_bg)
        val icon = frameLayout.getChildAt(0) as ImageView
        icon.setColorFilter(getColor(if (isMuted) R.color.shield_bg else R.color.shield_text_primary))
    }

    private fun toggleVideo() {
        isVideoOn = !isVideoOn
        webrtcClient.toggleVideo(isVideoOn)
        
        val btnVideo = findViewById<View>(R.id.btnVideo)
        val frameLayout = (btnVideo as ViewGroup).getChildAt(0) as FrameLayout
        frameLayout.backgroundTintList = getColorStateList(if (isVideoOn) R.color.shield_text_primary else R.color.shield_glass_bg)
        val icon = frameLayout.getChildAt(0) as ImageView
        icon.setColorFilter(getColor(if (isVideoOn) R.color.shield_bg else R.color.shield_text_primary))
        
        val localContainer = findViewById<View>(R.id.localVideoContainer)
        localContainer?.visibility = if (isVideoOn) View.VISIBLE else View.GONE
        
        val bgBlur = findViewById<View>(R.id.backgroundBlurImage)
        val avatar = findViewById<View>(R.id.avatarContainer)
        
        if (isVideoOn || remoteVideoViews.isNotEmpty()) {
            bgBlur?.animate()?.alpha(0f)?.setDuration(300)?.withEndAction { bgBlur.visibility = View.GONE }?.start()
            avatar?.animate()?.alpha(0f)?.setDuration(300)?.withEndAction { avatar.visibility = View.GONE }?.start()
        } else {
            bgBlur?.visibility = View.VISIBLE
            avatar?.visibility = View.VISIBLE
            bgBlur?.animate()?.alpha(0.2f)?.setDuration(300)?.start()
            avatar?.animate()?.alpha(1f)?.setDuration(300)?.start()
        }
    }

    private fun toggleSpeaker() {
        isSpeakerOn = !isSpeakerOn
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
        audioManager.isSpeakerphoneOn = isSpeakerOn
        
        val btnSpeaker = findViewById<View>(R.id.btnSpeaker)
        val frameLayout = (btnSpeaker as ViewGroup).getChildAt(0) as FrameLayout
        frameLayout.backgroundTintList = getColorStateList(if (isSpeakerOn) R.color.shield_text_primary else R.color.shield_glass_bg)
        val icon = frameLayout.getChildAt(0) as ImageView
        icon.setColorFilter(getColor(if (isSpeakerOn) R.color.shield_bg else R.color.shield_text_primary))
    }

    private fun initWebRTC() {
        val prefs = getSharedPreferences("chatr_prefs", Context.MODE_PRIVATE)
        val myUserId = prefs.getString("user_id", "") ?: ""
        
        signalingClient = NativeSignalingClient(this, com.chatr.app.BuildConfig.SOCKET_URL, myUserId)
        webrtcClient = NativeWebRTCClient(applicationContext, signalingClient)
        
        ChatrConnectionService.getConnection(callId)?.setAudioBridge(webrtcClient)

        if (localVideoView != null) {
            val eglBaseContext = webrtcClient.getEglBaseContext()
            localVideoView?.init(eglBaseContext, null)
            localVideoView?.setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FIT)
            localVideoView?.setEnableHardwareScaler(true)
            webrtcClient.localVideoView = localVideoView
        }

        signalingClient.connect()
        
        val targetId = intent.getStringExtra("caller_id") ?: ""
        webrtcClient.currentCallId = callId
        if (targetId.isNotEmpty()) {
            webrtcClient.targetUserIds.add(targetId)
        }
        webrtcClient.eventListener = this
        signalingClient.listener = this
        
        // Start Chat Service
        com.chatr.app.shield.ShieldChatService.start(this, callId)
        
        // Fetch missed offer
        fetchMissedOffer(myUserId)
    }

    private fun fetchMissedOffer(myUserId: String) {
        Thread {
            try {
                val url = "${com.chatr.app.BuildConfig.SUPABASE_URL}/rest/v1/webrtc_signals?call_id=eq.$callId&signal_type=eq.offer&to_user=eq.$myUserId&order=created_at.desc&limit=1"
                val validToken = com.chatr.app.auth.NativeAuthManager.getValidTokenBlocking(this)
                if (validToken.isNullOrEmpty()) return@Thread
                
                val request = okhttp3.Request.Builder()
                    .url(url)
                    .header("apikey", com.chatr.app.BuildConfig.SUPABASE_KEY)
                    .header("Authorization", "Bearer $validToken")
                    .build()
                
                val client = okhttp3.OkHttpClient.Builder()
                    .authenticator(com.chatr.app.auth.SupabaseAuthenticator(this))
                    .build()
                    
                val response = client.newCall(request).execute()
                val body = response.body?.string()
                
                if (response.isSuccessful && !body.isNullOrBlank() && body != "[]") {
                    val array = org.json.JSONArray(body)
                    if (array.length() > 0) {
                        val row = array.getJSONObject(0)
                        val signalData = row.getJSONObject("signal_data")
                        val sdp = signalData.getString("sdp")
                        val senderId = row.getString("from_user")
                        
                        runOnUiThread {
                            webrtcClient.handleRemoteOfferFromDB(sdp, senderId, callId)
                            startIceCandidatePolling(myUserId)
                        }
                    }
                }
            } catch (e: Exception) {
                // ignore
            }
        }.start()
    }

    private fun startIceCandidatePolling(myUserId: String) {
        val handler = android.os.Handler(android.os.Looper.getMainLooper())
        val processedIceCandidates = mutableSetOf<String>()
        val icePollingRunnable = object : Runnable {
            override fun run() {
                Thread {
                    try {
                        val iceUrl = "${com.chatr.app.BuildConfig.SUPABASE_URL}/rest/v1/webrtc_signals?call_id=eq.$callId&signal_type=eq.ice-candidate&to_user=eq.$myUserId&order=created_at.asc"
                        val validToken = com.chatr.app.auth.NativeAuthManager.getValidTokenBlocking(this@ShieldActiveCallActivity)
                        if (validToken.isNullOrEmpty()) return@Thread
                        
                        val request = okhttp3.Request.Builder()
                            .url(iceUrl)
                            .header("apikey", com.chatr.app.BuildConfig.SUPABASE_KEY)
                            .header("Authorization", "Bearer $validToken")
                            .build()
                        
                        val client = okhttp3.OkHttpClient.Builder()
                            .authenticator(com.chatr.app.auth.SupabaseAuthenticator(this@ShieldActiveCallActivity))
                            .build()
                        val response = client.newCall(request).execute()
                        val body = response.body?.string()
                        
                        if (response.isSuccessful && !body.isNullOrBlank() && body != "[]") {
                            val array = org.json.JSONArray(body)
                            for (i in 0 until array.length()) {
                                val row = array.getJSONObject(i)
                                val signalId = row.getString("id")
                                if (!processedIceCandidates.contains(signalId)) {
                                    processedIceCandidates.add(signalId)
                                    val signalData = row.getJSONObject("signal_data")
                                    val candidate = signalData.getString("candidate")
                                    val sdpMid = signalData.getString("sdpMid")
                                    val sdpMLineIndex = signalData.getInt("sdpMLineIndex")
                                    val senderId = row.getString("from_user")
                                    val ice = org.webrtc.IceCandidate(sdpMid, sdpMLineIndex, candidate)
                                    
                                    runOnUiThread {
                                        webrtcClient.handleRemoteIceCandidate(ice, senderId)
                                    }
                                }
                            }
                        }
                    } catch (e: Exception) {
                        // ignore
                    }
                }.start()
                handler.postDelayed(this, 2000)
            }
        }
        handler.post(icePollingRunnable)
    }

    private fun showDtmfKeypad() {
        val keys = arrayOf("1","2","3","4","5","6","7","8","9","*","0","#")
        val dtmfDisplay = android.widget.EditText(this).apply {
            isFocusable = false
            hint = "DTMF"
            textSize = 20f
            gravity = android.view.Gravity.CENTER
            setPadding(16, 8, 16, 8)
        }
        val grid = android.widget.GridLayout(this).apply {
            columnCount = 3
            rowCount = 4
            setPadding(16, 16, 16, 16)
        }
        keys.forEach { key ->
            val btn = android.widget.Button(this).apply {
                text = key
                textSize = 20f
                val p = android.widget.GridLayout.LayoutParams().apply {
                    width = 0
                    height = android.widget.GridLayout.LayoutParams.WRAP_CONTENT
                    columnSpec = android.widget.GridLayout.spec(android.widget.GridLayout.UNDEFINED, 1f)
                    setMargins(8, 8, 8, 8)
                }
                layoutParams = p
                setOnClickListener {
                    dtmfDisplay.append(key)
                    webrtcClient.sendDtmf(key)
                }
            }
            grid.addView(btn)
        }
        val container = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            addView(dtmfDisplay, android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            ))
            addView(grid, android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            ))
        }
        android.app.AlertDialog.Builder(this)
            .setTitle("Keypad")
            .setView(container)
            .setNegativeButton("Close", null)
            .show()
    }

    private fun endCall() {
        ChatrConnectionService.getConnection(callId)?.endCall()
        webrtcClient.endCall()
        localVideoView?.release()
        remoteVideoViews.values.forEach { it.release() }
        WebRTCMediaService.stopService(this)
        com.chatr.app.shield.ShieldChatService.stop(this)
        finish()
    }


    override fun onDestroy() {
        super.onDestroy()
        try {
            localVideoView?.release()
            remoteVideoViews.values.forEach { it.release() }
        } catch (e: Exception) {}
    }

    // WebRTC Listeners
    override fun onRemoteVideoTrackAdded(userId: String, track: VideoTrack) {
        runOnUiThread {
            if (remoteVideoViews.containsKey(userId) || remoteVideoGrid == null) return@runOnUiThread

            val renderer = SurfaceViewRenderer(this).apply {
                layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                init(webrtcClient.getEglBaseContext(), null)
                setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FILL)
                setEnableHardwareScaler(true)
            }
            track.addSink(renderer)
            remoteVideoViews[userId] = renderer
            remoteVideoGrid?.addView(renderer)
            
            // Hide avatar/background when remote video arrives
            val bgBlur = findViewById<View>(R.id.backgroundBlurImage)
            val avatar = findViewById<View>(R.id.avatarContainer)
            bgBlur?.animate()?.alpha(0f)?.setDuration(300)?.withEndAction { bgBlur.visibility = View.GONE }?.start()
            avatar?.animate()?.alpha(0f)?.setDuration(300)?.withEndAction { avatar.visibility = View.GONE }?.start()
        }
    }

    override fun onRemoteVideoTrackRemoved(userId: String) {
        runOnUiThread {
            val renderer = remoteVideoViews.remove(userId)
            if (renderer != null) {
                remoteVideoGrid?.removeView(renderer)
                renderer.release()
            }
            
            // Bring back avatar if no video
            if (remoteVideoViews.isEmpty() && !isVideoOn) {
                val bgBlur = findViewById<View>(R.id.backgroundBlurImage)
                val avatar = findViewById<View>(R.id.avatarContainer)
                bgBlur?.visibility = View.VISIBLE
                avatar?.visibility = View.VISIBLE
                bgBlur?.animate()?.alpha(0.2f)?.setDuration(300)?.start()
                avatar?.animate()?.alpha(1f)?.setDuration(300)?.start()
            }
        }
    }

    override fun onOfferReceived(senderId: String, offerSdp: String, callId: String) {
        runOnUiThread { webrtcClient.handleRemoteOfferFromDB(offerSdp, senderId, callId) }
    }

    override fun onAnswerReceived(senderId: String, answerSdp: String) {
        runOnUiThread { webrtcClient.handleRemoteAnswerFromDB(answerSdp, senderId) }
    }

    override fun onIceCandidateReceived(senderId: String, candidate: String, sdpMid: String, sdpMLineIndex: Int) {
        runOnUiThread { webrtcClient.handleRemoteIceCandidate(org.webrtc.IceCandidate(sdpMid, sdpMLineIndex, candidate), senderId) }
    }

    override fun onCallEnded(senderId: String) {
        runOnUiThread { endCall() }
    }
}
