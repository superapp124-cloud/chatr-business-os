package com.chatr.app.services

import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.IBinder
import android.speech.tts.TextToSpeech
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale

class VoipTranslatorService : Service() {

    inner class LocalBinder : Binder() {
        fun getService(): VoipTranslatorService = this@VoipTranslatorService
    }

    var myLanguage: String = "Kashmiri"
    var callerLanguage: String = "Hindi"
    var onTranslationResult: ((original: String, translated: String, isMe: Boolean) -> Unit)? = null
    var onError: ((message: String) -> Unit)? = null
    var onListeningState: ((listening: Boolean) -> Unit)? = null
    var isListening: Boolean = false
        private set

    private val binder = LocalBinder()
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var tts: TextToSpeech? = null

    override fun onCreate() {
        super.onCreate()
        tts = TextToSpeech(this) { status ->
            if (status != TextToSpeech.SUCCESS) {
                Log.w(TAG, "TextToSpeech init failed: $status")
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder = binder

    fun translateText(text: String, isMe: Boolean) {
        val original = text.trim()
        if (original.isBlank()) return

        val fromLanguage = if (isMe) myLanguage else callerLanguage
        val toLanguage = if (isMe) callerLanguage else myLanguage
        onTranslationResult?.invoke(original, "...", isMe)

        scope.launch {
            val translated = runCatching {
                LiveTranslatorEngine.translate(original, fromLanguage, toLanguage)
            }.getOrElse { error ->
                Log.e(TAG, "Translation failed", error)
                onError?.invoke("Translation failed. Try again.")
                return@launch
            }

            onTranslationResult?.invoke(original, translated, isMe)
            speak(translated, toLanguage)
        }
    }

    fun startListening(isMe: Boolean) {
        isListening = true
        onListeningState?.invoke(true)
        onError?.invoke("Voice interpreter is preparing. Type a phrase to translate instantly.")
        isListening = false
        onListeningState?.invoke(false)
    }

    fun stopListening() {
        isListening = false
        onListeningState?.invoke(false)
    }

    private suspend fun speak(text: String, language: String) = withContext(Dispatchers.Main) {
        val engine = tts ?: return@withContext
        val localeTag = LiveTranslatorEngine.LANGUAGE_OPTIONS[language] ?: "en-IN"
        runCatching {
            engine.language = Locale.forLanguageTag(localeTag)
            engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "chatr_voip_translation")
        }.onFailure {
            Log.w(TAG, "Unable to speak translation: ${it.message}")
        }
    }

    override fun onDestroy() {
        tts?.shutdown()
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "VoipTranslatorService"
    }
}
