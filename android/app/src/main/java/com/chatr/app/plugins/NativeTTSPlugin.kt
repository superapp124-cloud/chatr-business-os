package com.chatr.app.plugins

import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.Locale
import java.util.UUID

/**
 * NativeTTSPlugin
 *
 * Capacitor plugin exposing Android TextToSpeech to the web layer.
 * Called by the web app for AI screening voice prompts and live translation readouts.
 *
 * JS usage:
 *   import { Plugins } from '@capacitor/core';
 *   const { NativeTTS } = Plugins;
 *   await NativeTTS.speak({ text: 'Hello', rate: 1.0, pitch: 1.0 });
 */
@CapacitorPlugin(name = "NativeTTS")
class NativeTTSPlugin : Plugin() {

    companion object {
        private const val TAG = "NativeTTSPlugin"
    }

    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private val pendingCalls = mutableListOf<Pair<PluginCall, String>>()

    override fun load() {
        tts = TextToSpeech(context) { status ->
            ttsReady = (status == TextToSpeech.SUCCESS)
            if (ttsReady) {
                tts?.language = Locale.getDefault()
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {}
                    override fun onDone(utteranceId: String?) {
                        Log.d(TAG, "TTS utterance done: $utteranceId")
                    }
                    @Deprecated("Deprecated in Java")
                    override fun onError(utteranceId: String?) {
                        Log.e(TAG, "TTS error: $utteranceId")
                    }
                })
                // Flush any queued speaks
                for ((call, text) in pendingCalls) {
                    speakInternal(call, text)
                }
                pendingCalls.clear()
                Log.i(TAG, "✅ TTS engine ready")
            } else {
                Log.e(TAG, "❌ TTS engine init failed, status=$status")
            }
        }
    }

    @PluginMethod
    fun speak(call: PluginCall) {
        val text = call.getString("text")
        if (text.isNullOrBlank()) {
            call.reject("text is required")
            return
        }
        val rate = call.getFloat("rate", 1.0f) ?: 1.0f
        val pitch = call.getFloat("pitch", 1.0f) ?: 1.0f
        tts?.setSpeechRate(rate)
        tts?.setPitch(pitch)

        if (!ttsReady) {
            pendingCalls.add(Pair(call, text))
            return
        }
        speakInternal(call, text)
    }

    private fun speakInternal(call: PluginCall, text: String) {
        val id = UUID.randomUUID().toString()
        val result = tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, id)
        if (result == TextToSpeech.SUCCESS) {
            call.resolve(JSObject().apply { put("utteranceId", id) })
        } else {
            call.reject("TTS speak failed")
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        tts?.stop()
        call.resolve()
    }

    @PluginMethod
    fun isSpeaking(call: PluginCall) {
        val speaking = tts?.isSpeaking ?: false
        call.resolve(JSObject().apply { put("speaking", speaking) })
    }

    @PluginMethod
    fun setLanguage(call: PluginCall) {
        val lang = call.getString("language") ?: "en-US"
        val locale = Locale.forLanguageTag(lang)
        val result = tts?.setLanguage(locale)
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            call.reject("Language not supported: $lang")
        } else {
            call.resolve()
        }
    }

    @PluginMethod
    fun getAvailableVoices(call: PluginCall) {
        if (!ttsReady) {
            call.reject("TTS not ready")
            return
        }
        val voices = tts?.voices ?: emptySet()
        val arr = JSArray()
        for (v in voices) {
            arr.put(JSObject().apply {
                put("name", v.name)
                put("locale", v.locale.toLanguageTag())
                put("quality", v.quality)
                put("latency", v.latency)
            })
        }
        call.resolve(JSObject().apply { put("voices", arr) })
    }

    override fun handleOnDestroy() {
        tts?.stop()
        tts?.shutdown()
        super.handleOnDestroy()
    }
}
