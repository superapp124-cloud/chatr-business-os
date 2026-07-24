package com.chatr.app.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import kotlinx.coroutines.*
import java.util.Locale

/**
 * AIScreeningService – AI Call Screening foreground service.
 *
 * Lifecycle:
 * 1. Started via [start] with the caller's phone number.
 * 2. Greets the caller with TTS: "Hi, this is Chatr AI Call Screen. Please state your name
 *    and the reason for your call."
 * 3. Listens for the spoken response via [SpeechRecognizer].
 * 4. Broadcasts the transcription as [ACTION_SCREENING_RESULT] via [LocalBroadcastManager].
 * 5. Auto-stops after [AUTO_STOP_MS] (30 s) regardless of recognition outcome.
 */
class AIScreeningService : Service() {

    // -----------------------------------------------------------------------
    // Fields
    // -----------------------------------------------------------------------

    private var phoneNumber: String = ""
    private var screeningMode: String = "MODE_DEFAULT"

    private var tts: TextToSpeech? = null
    private var speechRecognizer: SpeechRecognizer? = null

    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var autoStopJob: Job? = null

    private var ttsInitialized = false

    // -----------------------------------------------------------------------
    // Service lifecycle
    // -----------------------------------------------------------------------

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "AIScreeningService created")
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        phoneNumber = intent?.getStringExtra(EXTRA_PHONE_NUMBER) ?: ""
        screeningMode = intent?.getStringExtra(EXTRA_SCREENING_MODE) ?: "MODE_DEFAULT"
        Log.d(TAG, "onStartCommand – screening call from: $phoneNumber, mode: $screeningMode")

        startForeground(NOTIFICATION_ID, buildNotification())
        scheduleAutoStop()
        initializeTts()

        return START_NOT_STICKY
    }

    override fun onDestroy() {
        Log.d(TAG, "AIScreeningService destroyed")
        cleanUp()
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // -----------------------------------------------------------------------
    // TTS
    // -----------------------------------------------------------------------

    private fun initializeTts() {
        tts = TextToSpeech(applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                if (screeningMode == "MODE_DELIVERY_GUIDE" || screeningMode == "MODE_AI_BOUNCER") {
                    tts?.language = Locale("hi", "IN")
                } else {
                    tts?.language = Locale.US
                }
                ttsInitialized = true
                Log.d(TAG, "TTS initialized – starting greeting")
                speakGreeting()
            } else {
                Log.e(TAG, "TTS initialization failed with status: $status")
                broadcastResult(phoneNumber, RESULT_TTS_FAILED)
                stopSelf()
            }
        }
    }

    private fun speakGreeting() {
        val greeting = when (screeningMode) {
            "MODE_DELIVERY_GUIDE" -> "Hello bhaiya, Arshid sir busy hain. Aap main gate par aake security ko bata dijiye, flat number 402 hai."
            "MODE_AI_BOUNCER" -> "Namaskar. Arshid ji currently busy hain. Kya aap loan ya credit card bech rahe hain?"
            else -> "Hi, this is Chatr AI Call Screen. Please state your name and the reason for your call."
        }

        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                Log.d(TAG, "TTS speaking greeting…")
            }

            override fun onDone(utteranceId: String?) {
                Log.d(TAG, "TTS greeting done – starting speech recognition")
                serviceScope.launch {
                    startSpeechRecognition()
                }
            }

            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) {
                Log.e(TAG, "TTS utterance error")
                broadcastResult(phoneNumber, RESULT_TTS_FAILED)
                stopSelf()
            }
        })

        tts?.speak(
            greeting,
            TextToSpeech.QUEUE_FLUSH,
            null,
            UTTERANCE_ID
        )
    }

    // -----------------------------------------------------------------------
    // Speech recognition
    // -----------------------------------------------------------------------

    private fun startSpeechRecognition() {
        if (!SpeechRecognizer.isRecognitionAvailable(applicationContext)) {
            Log.w(TAG, "Speech recognition not available on this device")
            broadcastResult(phoneNumber, RESULT_RECOGNITION_UNAVAILABLE)
            stopSelf()
            return
        }

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(applicationContext).apply {
            setRecognitionListener(buildRecognitionListener())
            startListening(buildRecognizerIntent())
        }

        Log.d(TAG, "SpeechRecognizer started")
    }

    private fun buildRecognizerIntent(): Intent =
        Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
            )
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "en-IN")
            putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 2_000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 3_000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2_000L)
        }

    private fun buildRecognitionListener() = object : RecognitionListener {

        override fun onReadyForSpeech(params: Bundle?) {
            Log.d(TAG, "SpeechRecognizer ready for speech")
        }

        override fun onBeginningOfSpeech() {
            Log.d(TAG, "Speech input detected")
        }

        override fun onRmsChanged(rmsdB: Float) {
            // Intentionally empty – no UI to update
        }

        override fun onBufferReceived(buffer: ByteArray?) {
            // Intentionally empty
        }

        override fun onEndOfSpeech() {
            Log.d(TAG, "Speech input ended")
        }

        override fun onError(error: Int) {
            val errorMsg = recognitionErrorToString(error)
            Log.e(TAG, "SpeechRecognizer error: $errorMsg ($error)")
            broadcastResult(phoneNumber, RESULT_NO_SPEECH)
            stopSelf()
        }

        override fun onResults(results: Bundle?) {
            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            val transcript = matches?.firstOrNull() ?: ""
            Log.d(TAG, "Recognition result: $transcript")
            broadcastResult(phoneNumber, transcript)
            stopSelf()
        }

        override fun onPartialResults(partialResults: Bundle?) {
            // Could be used for real-time display; not needed here
        }

        override fun onEvent(eventType: Int, params: Bundle?) {
            // Intentionally empty
        }
    }

    // -----------------------------------------------------------------------
    // Broadcast
    // -----------------------------------------------------------------------

    private fun broadcastResult(phoneNumber: String, screeningResult: String) {
        val intent = Intent(ACTION_SCREENING_RESULT).apply {
            putExtra(EXTRA_PHONE_NUMBER, phoneNumber)
            putExtra(EXTRA_SCREENING_RESULT, screeningResult)
        }
        LocalBroadcastManager.getInstance(applicationContext).sendBroadcast(intent)
        Log.d(TAG, "Broadcast sent: phone=$phoneNumber result=$screeningResult")
    }

    // -----------------------------------------------------------------------
    // Notification
    // -----------------------------------------------------------------------

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Chatr AI is screening an incoming call"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification() = NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("Chatr AI Screening Call…")
        .setContentText("Screening incoming call from $phoneNumber")
        .setSmallIcon(android.R.drawable.ic_btn_speak_now)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setOngoing(true)
        .setSilent(true)
        .build()

    // -----------------------------------------------------------------------
    // Auto-stop
    // -----------------------------------------------------------------------

    private fun scheduleAutoStop() {
        autoStopJob = serviceScope.launch {
            delay(AUTO_STOP_MS)
            Log.w(TAG, "AIScreeningService auto-stopping after ${AUTO_STOP_MS}ms")
            broadcastResult(phoneNumber, RESULT_TIMEOUT)
            stopSelf()
        }
    }

    // -----------------------------------------------------------------------
    // Clean-up
    // -----------------------------------------------------------------------

    private fun cleanUp() {
        autoStopJob?.cancel()
        try {
            speechRecognizer?.stopListening()
            speechRecognizer?.destroy()
            speechRecognizer = null
        } catch (e: Exception) {
            Log.e(TAG, "Error destroying SpeechRecognizer: ${e.message}")
        }
        try {
            tts?.stop()
            tts?.shutdown()
            tts = null
        } catch (e: Exception) {
            Log.e(TAG, "Error shutting down TTS: ${e.message}")
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private fun recognitionErrorToString(error: Int): String = when (error) {
        SpeechRecognizer.ERROR_AUDIO                -> "Audio recording error"
        SpeechRecognizer.ERROR_CLIENT               -> "Client-side error"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions"
        SpeechRecognizer.ERROR_NETWORK              -> "Network error"
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT      -> "Network timeout"
        SpeechRecognizer.ERROR_NO_MATCH             -> "No recognition match"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY      -> "Recognizer busy"
        SpeechRecognizer.ERROR_SERVER               -> "Server error"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT       -> "Speech timeout"
        else                                        -> "Unknown error"
    }

    // -----------------------------------------------------------------------
    // Companion
    // -----------------------------------------------------------------------

    companion object {

        private const val TAG = "AIScreeningService"

        // Broadcast
        const val ACTION_SCREENING_RESULT = "com.chatr.app.SCREENING_RESULT"
        const val EXTRA_PHONE_NUMBER      = "phone_number"
        const val EXTRA_SCREENING_RESULT  = "screening_result"
        const val EXTRA_SCREENING_MODE    = "screening_mode"

        // Well-known result strings for non-speech outcomes
        const val RESULT_TIMEOUT                 = "__timeout__"
        const val RESULT_NO_SPEECH               = "__no_speech__"
        const val RESULT_TTS_FAILED              = "__tts_failed__"
        const val RESULT_RECOGNITION_UNAVAILABLE = "__recognition_unavailable__"

        // Notification
        private const val CHANNEL_ID   = "ChatrAIScreening"
        private const val CHANNEL_NAME = "Chatr AI Call Screening"
        private const val NOTIFICATION_ID = 7001

        // TTS
        private const val UTTERANCE_ID = "chatr_greeting"

        // Auto-stop: 30 seconds
        private const val AUTO_STOP_MS = 30_000L

        /**
         * Starts the AI screening service for the given [phoneNumber].
         * Call this when an incoming call is detected and the user has not yet answered.
         */
        fun start(context: Context, phoneNumber: String) {
            start(context, phoneNumber, "MODE_DEFAULT")
        }

        fun start(context: Context, phoneNumber: String, mode: String) {
            val intent = Intent(context, AIScreeningService::class.java).apply {
                putExtra(EXTRA_PHONE_NUMBER, phoneNumber)
                putExtra(EXTRA_SCREENING_MODE, mode)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            Log.d(TAG, "AIScreeningService.start() called for $phoneNumber")
        }

        /**
         * Stops a running [AIScreeningService].
         */
        fun stop(context: Context) {
            val intent = Intent(context, AIScreeningService::class.java)
            context.stopService(intent)
            Log.d(TAG, "AIScreeningService.stop() called")
        }
    }
}
