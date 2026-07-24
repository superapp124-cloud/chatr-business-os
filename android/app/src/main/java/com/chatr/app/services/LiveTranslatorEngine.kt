package com.chatr.app.services

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * LiveTranslatorEngine – Real-time spoken language translation via Gemini.
 *
 * Used by the AI Interpreter Mode to translate between the user's language
 * and the caller's language, enabling two-way voice communication across
 * language barriers.
 */
object LiveTranslatorEngine {

    private const val TAG = "LiveTranslatorEngine"
    private const val PLACEHOLDER_KEY = "dummy_key"

    // Map of display names to Android TTS locale codes
    val LANGUAGE_OPTIONS = linkedMapOf(
        "Kashmiri"  to "hi-IN",  // Fallback: Hindi TTS for Kashmiri text
        "Hindi"     to "hi-IN",
        "English"   to "en-IN",
        "Punjabi"   to "pa-IN",
        "Urdu"      to "ur-PK",
        "Bengali"   to "bn-IN",
        "Tamil"     to "ta-IN",
        "Telugu"    to "te-IN",
        "Kannada"   to "kn-IN",
        "Marathi"   to "mr-IN",
        "Gujarati"  to "gu-IN"
    )

    // Map of display names to Android SpeechRecognizer locale codes
    val LANGUAGE_STT = linkedMapOf(
        "Kashmiri"  to "ur-PK",  // Best available STT for Kashmiri
        "Hindi"     to "hi-IN",
        "English"   to "en-IN",
        "Punjabi"   to "pa-IN",
        "Urdu"      to "ur-PK",
        "Bengali"   to "bn-IN",
        "Tamil"     to "ta-IN",
        "Telugu"    to "te-IN",
        "Kannada"   to "kn-IN",
        "Marathi"   to "mr-IN",
        "Gujarati"  to "gu-IN"
    )

    /**
     * Translates [text] from [fromLanguage] to [toLanguage] using the Gemini API.
     * Returns the translated string, or an error placeholder on failure.
     */
    suspend fun translate(
        text: String,
        fromLanguage: String,
        toLanguage: String
    ): String = withContext(Dispatchers.IO) {
        if (text.isBlank()) return@withContext ""

        val apiKey = resolveApiKey()
        if (apiKey == PLACEHOLDER_KEY || apiKey.isBlank()) {
            Log.w(TAG, "Gemini API key not configured – returning dummy translation.")
            return@withContext "[Translated from $fromLanguage to $toLanguage]: $text"
        }

        val prompt = buildPrompt(text, fromLanguage, toLanguage)

        return@withContext try {
            callGeminiApi(apiKey, prompt)
        } catch (e: Exception) {
            Log.e(TAG, "Translation Exception: ${e.message}", e)
            "[Translation Error]"
        }
    }

    private fun buildPrompt(text: String, from: String, to: String): String {
        return """You are a live real-time call interpreter for a phone call.
Translate the following spoken phrase from $from to $to.
Keep it natural, conversational, and concise — exactly as you would say it in a real conversation.
Do NOT add any explanations, quotes, or notes. Return ONLY the translated text.

Spoken phrase: "$text"
Translation ($to):"""
    }

    private fun callGeminiApi(apiKey: String, prompt: String): String {
        val jsonBody = JSONObject().apply {
            put("contents", JSONArray().apply {
                put(JSONObject().apply {
                    put("parts", JSONArray().apply {
                        put(JSONObject().apply { put("text", prompt) })
                    })
                })
            })
            put("generationConfig", JSONObject().apply {
                put("temperature", 0.2)
                put("maxOutputTokens", 200)
            })
        }

        val url = URL("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=$apiKey")
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.connectTimeout = 5000
        conn.readTimeout = 8000
        conn.doOutput = true

        OutputStreamWriter(conn.outputStream).use { it.write(jsonBody.toString()) }

        val responseCode = conn.responseCode
        if (responseCode == HttpURLConnection.HTTP_OK) {
            val reader = BufferedReader(InputStreamReader(conn.inputStream))
            val responseStr = reader.readText()
            reader.close()

            val root = JSONObject(responseStr)
            val candidates = root.getJSONArray("candidates")
            if (candidates.length() > 0) {
                val content = candidates.getJSONObject(0).getJSONObject("content")
                val parts = content.getJSONArray("parts")
                if (parts.length() > 0) {
                    return parts.getJSONObject(0).getString("text").trim()
                }
            }
        } else {
            val err = conn.errorStream?.bufferedReader()?.readText() ?: ""
            Log.e(TAG, "Gemini translation failed. Code: $responseCode, Error: $err")
        }
        return "[Translation Error]"
    }

    private fun resolveApiKey(): String {
        return try {
            val clazz = Class.forName("com.chatr.app.BuildConfig")
            val field = clazz.getField("GEMINI_API_KEY")
            (field.get(null) as? String)?.takeIf { it.isNotBlank() } ?: PLACEHOLDER_KEY
        } catch (_: Exception) {
            PLACEHOLDER_KEY
        }
    }

    /**
     * Translates a base64-encoded audio chunk (audio/webm) from [fromLanguage] to [toLanguage].
     * Uses Gemini 1.5/2.0 Flash multimodal capabilities to bypass STT completely.
     */
    suspend fun translateAudio(
        base64Audio: String,
        fromLanguage: String,
        toLanguage: String
    ): String = withContext(Dispatchers.IO) {
        if (base64Audio.isBlank()) return@withContext ""

        val apiKey = resolveApiKey()
        if (apiKey == PLACEHOLDER_KEY || apiKey.isBlank()) {
            Log.w(TAG, "Gemini API key not configured – returning dummy translation.")
            return@withContext "[Audio Translated from $fromLanguage to $toLanguage]"
        }

        val prompt = """You are a live real-time call interpreter for a phone call.
Listen to this audio clip which is spoken in $fromLanguage, and translate what is said into $toLanguage.
Keep it natural, conversational, and concise. Do NOT add any explanations, notes, or pronunciation guides.
Return ONLY the translated text in $toLanguage."""

        val jsonBody = JSONObject().apply {
            put("contents", JSONArray().apply {
                put(JSONObject().apply {
                    put("parts", JSONArray().apply {
                        // 1. Add the text prompt
                        put(JSONObject().apply { put("text", prompt) })
                        // 2. Add the audio data
                        put(JSONObject().apply {
                            put("inlineData", JSONObject().apply {
                                put("mimeType", "audio/webm")
                                put("data", base64Audio)
                            })
                        })
                    })
                })
            })
            put("generationConfig", JSONObject().apply {
                put("temperature", 0.2)
                put("maxOutputTokens", 200)
            })
        }

        val url = URL("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=$apiKey")
        return@withContext try {
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.connectTimeout = 10000
            conn.readTimeout = 15000
            conn.doOutput = true

            OutputStreamWriter(conn.outputStream).use { it.write(jsonBody.toString()) }

            val responseCode = conn.responseCode
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val reader = BufferedReader(InputStreamReader(conn.inputStream))
                val responseStr = reader.readText()
                reader.close()

                val root = JSONObject(responseStr)
                val candidates = root.getJSONArray("candidates")
                if (candidates.length() > 0) {
                    val content = candidates.getJSONObject(0).getJSONObject("content")
                    val parts = content.getJSONArray("parts")
                    if (parts.length() > 0) {
                        parts.getJSONObject(0).getString("text").trim()
                    } else {
                        "[Audio Translation Failed: Empty Response]"
                    }
                } else {
                    "[Audio Translation Failed: No Candidates]"
                }
            } else {
                val err = conn.errorStream?.bufferedReader()?.readText() ?: ""
                Log.e(TAG, "Gemini audio translation failed. Code: $responseCode, Error: $err")
                "[Audio Translation Error]"
            }
        } catch (e: Exception) {
            Log.e(TAG, "Audio Translation Exception: ${e.message}", e)
            "[Audio Translation Exception]"
        }
    }
}
