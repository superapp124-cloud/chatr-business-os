package com.chatr.app.plugins

import android.content.ComponentName
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.util.Log
import com.chatr.app.services.VoipTranslatorService
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * VoiceTranslationPlugin
 *
 * Capacitor bridge giving the web layer control over real-time call translation.
 * Delegates to VoipTranslatorService (already exists in :app/services/).
 *
 * JS usage:
 *   const { VoiceTranslation } = Plugins;
 *   await VoiceTranslation.startTranslation({ sourceLang: 'en', targetLang: 'fr' });
 */
@CapacitorPlugin(name = "VoiceTranslation")
class VoiceTranslationPlugin : Plugin() {

    companion object {
        private const val TAG = "VoiceTranslationPlugin"

        const val ACTION_START = "com.chatr.app.TRANSLATION_START"
        const val ACTION_STOP  = "com.chatr.app.TRANSLATION_STOP"
        const val EXTRA_SOURCE = "sourceLang"
        const val EXTRA_TARGET = "targetLang"
        const val EXTRA_CALL_ID = "callId"
    }

    @PluginMethod
    fun startTranslation(call: PluginCall) {
        val sourceLang = call.getString("sourceLang", "en") ?: "en"
        val targetLang = call.getString("targetLang", "es") ?: "es"
        val callId = call.getString("callId", "") ?: ""

        try {
            val intent = Intent(context, VoipTranslatorService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_SOURCE, sourceLang)
                putExtra(EXTRA_TARGET, targetLang)
                putExtra(EXTRA_CALL_ID, callId)
            }
            context.startService(intent)
            Log.i(TAG, "🌐 Translation started: $sourceLang → $targetLang")
            call.resolve(JSObject().apply {
                put("started", true)
                put("sourceLang", sourceLang)
                put("targetLang", targetLang)
            })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start translation", e)
            call.reject(e.message ?: "Failed to start translation")
        }
    }

    @PluginMethod
    fun stopTranslation(call: PluginCall) {
        try {
            val intent = Intent(context, VoipTranslatorService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
            Log.i(TAG, "🛑 Translation stopped")
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop translation", e)
            call.reject(e.message ?: "Failed to stop translation")
        }
    }

    @PluginMethod
    fun getSupportedLanguages(call: PluginCall) {
        // Return the language pairs supported for live translation
        val languages = listOf(
            "en", "es", "fr", "de", "it", "pt", "ru", "zh", "ja", "ko",
            "ar", "hi", "tr", "pl", "nl", "sv", "da", "fi", "nb", "cs"
        )
        val result = JSObject()
        val arr = com.getcapacitor.JSArray()
        languages.forEach { arr.put(it) }
        result.put("languages", arr)
        call.resolve(result)
    }

    @PluginMethod
    fun isTranslating(call: PluginCall) {
        // Check shared pref set by VoipTranslatorService
        val prefs = context.getSharedPreferences("chatr_translation", android.content.Context.MODE_PRIVATE)
        val active = prefs.getBoolean("translation_active", false)
        call.resolve(JSObject().apply { put("active", active) })
    }
}
