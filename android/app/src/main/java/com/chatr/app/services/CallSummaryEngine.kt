package com.chatr.app.services

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

data class CalendarEvent(val title: String, val date: String, val time: String)

data class CallSummary(
    val phoneNumber: String,
    val contactName: String?,
    val durationSeconds: Long,
    val summary: String,
    val keyPoints: List<String>,
    val actionItems: List<String>,
    val calendarEvents: List<CalendarEvent>,
    /** One of: "positive", "neutral", "negative", "scam_risk" */
    val sentiment: String,
    val generatedAt: Long = System.currentTimeMillis()
)

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

class CallSummaryEngine {

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Generates an AI-powered post-call summary via the Gemini API.
     * Falls back to a basic local summary if the API call fails or the key is absent.
     */
    suspend fun generateCallSummary(
        phoneNumber: String,
        contactName: String?,
        durationSeconds: Long,
        callNotes: String = ""
    ): CallSummary = withContext(Dispatchers.IO) {

        val apiKey = resolveApiKey()

        if (apiKey == PLACEHOLDER_KEY || apiKey.isBlank()) {
            Log.w(TAG, "Gemini API key not configured – returning basic summary.")
            return@withContext buildBasicSummary(phoneNumber, contactName, durationSeconds)
        }

        val prompt = buildPrompt(phoneNumber, contactName, durationSeconds, callNotes)

        return@withContext try {
            val rawJson = callGeminiApi(apiKey, prompt)
            parseGeminiResponse(rawJson, phoneNumber, contactName, durationSeconds)
        } catch (e: Exception) {
            Log.e(TAG, "Gemini API call failed: ${e.message}", e)
            buildBasicSummary(phoneNumber, contactName, durationSeconds)
        }
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private fun resolveApiKey(): String {
        return try {
            // Reads BuildConfig.GEMINI_API_KEY when compiled into the app
            val clazz = Class.forName("com.chatr.app.BuildConfig")
            val field = clazz.getField("GEMINI_API_KEY")
            (field.get(null) as? String)?.takeIf { it.isNotBlank() } ?: PLACEHOLDER_KEY
        } catch (_: Exception) {
            PLACEHOLDER_KEY
        }
    }

    private fun buildPrompt(
        phoneNumber: String,
        contactName: String?,
        durationSeconds: Long,
        callNotes: String
    ): String {
        val callerLabel = if (!contactName.isNullOrBlank()) "$contactName ($phoneNumber)" else "Unknown Caller ($phoneNumber)"
        val durationLabel = formatDuration(durationSeconds)
        val notesSection = if (callNotes.isNotBlank()) "The user took the following notes during the call:\n\"$callNotes\"\n\nMake sure to incorporate these notes into the summary, key points, action items, and calendar events as ground truth. " else ""

        return """
You are an AI call assistant. A phone call just ended with $callerLabel lasting $durationLabel.
${notesSection}
Generate a structured call summary with:
1. A one-sentence summary
2. Key points discussed (as bullet points, max 4)
3. Action items needed (max 3)
4. Calendar events mentioned
5. Overall sentiment of the call

Return ONLY a valid JSON object (no markdown, no extra text) with these exact fields:
{
  "summary": "...",
  "keyPoints": ["..."],
  "actionItems": ["..."],
  "calendarEvents": [{"title": "...", "date": "YYYY-MM-DD", "time": "HH:MM"}],
  "sentiment": "..."
}
        """.trimIndent()
    }

    private fun callGeminiApi(apiKey: String, prompt: String): String {
        val endpoint = "$GEMINI_BASE_URL?key=$apiKey"
        val requestBody = JSONObject().apply {
            put("contents", JSONArray().apply {
                put(JSONObject().apply {
                    put("parts", JSONArray().apply {
                        put(JSONObject().apply {
                            put("text", prompt)
                        })
                    })
                })
            })
            put("generationConfig", JSONObject().apply {
                put("temperature", 0.3)
                put("maxOutputTokens", 512)
            })
        }.toString()

        val url = URL(endpoint)
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            doOutput = true
            connectTimeout = 15_000
            readTimeout = 30_000
        }

        OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(requestBody) }

        val responseCode = conn.responseCode
        val stream = if (responseCode in 200..299) conn.inputStream else conn.errorStream
        val rawResponse = BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { it.readText() }

        if (responseCode !in 200..299) {
            throw RuntimeException("Gemini API error $responseCode: $rawResponse")
        }

        return rawResponse
    }

    private fun parseGeminiResponse(
        rawJson: String,
        phoneNumber: String,
        contactName: String?,
        durationSeconds: Long
    ): CallSummary {
        return try {
            val root = JSONObject(rawJson)
            val candidates = root.getJSONArray("candidates")
            val content = candidates.getJSONObject(0)
                .getJSONObject("content")
                .getJSONArray("parts")
                .getJSONObject(0)
                .getString("text")
                .trim()

            // Strip optional markdown fences
            val cleanedContent = content
                .removePrefix("```json")
                .removePrefix("```")
                .removeSuffix("```")
                .trim()

            val resultJson = JSONObject(cleanedContent)

            val keyPoints = resultJson.optJSONArray("keyPoints")?.let { arr ->
                (0 until arr.length()).map { arr.getString(it) }
            } ?: emptyList()

            val actionItems = resultJson.optJSONArray("actionItems")?.let { arr ->
                (0 until arr.length()).map { arr.getString(it) }
            } ?: emptyList()

            val calendarEvents = resultJson.optJSONArray("calendarEvents")?.let { arr ->
                (0 until arr.length()).mapNotNull { i ->
                    val obj = arr.optJSONObject(i) ?: return@mapNotNull null
                    CalendarEvent(
                        title = obj.optString("title", "Untitled"),
                        date = obj.optString("date", ""),
                        time = obj.optString("time", "")
                    )
                }
            } ?: emptyList()

            val sentiment = resultJson.optString("sentiment", "neutral")
                .lowercase()
                .let { s ->
                    if (s in setOf("positive", "neutral", "negative", "scam_risk")) s else "neutral"
                }

            CallSummary(
                phoneNumber = phoneNumber,
                contactName = contactName,
                durationSeconds = durationSeconds,
                summary = resultJson.optString("summary", "Call summary unavailable."),
                keyPoints = keyPoints,
                actionItems = actionItems,
                calendarEvents = calendarEvents,
                sentiment = sentiment
            )
        } catch (e: JSONException) {
            Log.e(TAG, "Failed to parse Gemini response: ${e.message}", e)
            buildBasicSummary(phoneNumber, contactName, durationSeconds)
        }
    }

    private fun buildBasicSummary(
        phoneNumber: String,
        contactName: String?,
        durationSeconds: Long
    ): CallSummary {
        val callerLabel = contactName ?: "Unknown Caller"
        return CallSummary(
            phoneNumber = phoneNumber,
            contactName = contactName,
            durationSeconds = durationSeconds,
            summary = "Call with $callerLabel lasting ${formatDuration(durationSeconds)} ended.",
            keyPoints = emptyList(),
            actionItems = emptyList(),
            calendarEvents = emptyList(),
            sentiment = "neutral"
        )
    }

    private fun formatDuration(seconds: Long): String {
        val mins = seconds / 60
        val secs = seconds % 60
        return if (mins > 0) "${mins}m ${secs}s" else "${secs}s"
    }

    // -----------------------------------------------------------------------
    // Companion – persistence
    // -----------------------------------------------------------------------

    companion object {

        private const val TAG = "CallSummaryEngine"
        private const val GEMINI_BASE_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
        private const val PLACEHOLDER_KEY = "YOUR_GEMINI_KEY"

        private const val PREFS_NAME = "chatr_call_summaries"
        private const val KEY_SUMMARIES = "summaries"
        private const val MAX_STORED = 50

        /**
         * Persists [summary] to SharedPreferences (FIFO, max [MAX_STORED] entries).
         */
        fun saveSummary(context: Context, summary: CallSummary) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val existing = loadRawArray(prefs)

            // Prepend new summary
            val newArray = JSONArray()
            newArray.put(summaryToJson(summary))
            for (i in 0 until minOf(existing.length(), MAX_STORED - 1)) {
                newArray.put(existing.getJSONObject(i))
            }

            prefs.edit().putString(KEY_SUMMARIES, newArray.toString()).apply()
        }

        /**
         * Returns up to [MAX_STORED] recent [CallSummary] objects, newest first.
         */
        fun getRecentSummaries(context: Context): List<CallSummary> {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val array = loadRawArray(prefs)
            return (0 until array.length()).mapNotNull { i ->
                try {
                    jsonToSummary(array.getJSONObject(i))
                } catch (_: JSONException) {
                    null
                }
            }
        }

        /**
         * Returns the most recent summary for [phoneNumber], if any.
         */
        fun getLatestSummaryForNumber(context: Context, phoneNumber: String): CallSummary? {
            val normalized = com.chatr.app.nativecalls.NativePhoneNormalizer.normalize(phoneNumber)
            val summaries = getRecentSummaries(context)
            return summaries.firstOrNull { 
                com.chatr.app.nativecalls.NativePhoneNormalizer.normalize(it.phoneNumber) == normalized 
            }
        }

        // ---- JSON <-> CallSummary serialisation ----

        private fun summaryToJson(s: CallSummary): JSONObject = JSONObject().apply {
            put("phoneNumber", s.phoneNumber)
            put("contactName", s.contactName ?: JSONObject.NULL)
            put("durationSeconds", s.durationSeconds)
            put("summary", s.summary)
            put("keyPoints", JSONArray(s.keyPoints))
            put("actionItems", JSONArray(s.actionItems))
            put("calendarEvents", JSONArray().apply {
                s.calendarEvents.forEach { ev ->
                    put(JSONObject().apply {
                        put("title", ev.title)
                        put("date", ev.date)
                        put("time", ev.time)
                    })
                }
            })
            put("sentiment", s.sentiment)
            put("generatedAt", s.generatedAt)
        }

        private fun jsonToSummary(o: JSONObject): CallSummary {
            val keyPoints = o.optJSONArray("keyPoints")?.let { arr ->
                (0 until arr.length()).map { arr.getString(it) }
            } ?: emptyList()

            val actionItems = o.optJSONArray("actionItems")?.let { arr ->
                (0 until arr.length()).map { arr.getString(it) }
            } ?: emptyList()

            val calendarEvents = o.optJSONArray("calendarEvents")?.let { arr ->
                (0 until arr.length()).mapNotNull { i ->
                    val obj = arr.optJSONObject(i) ?: return@mapNotNull null
                    CalendarEvent(
                        title = obj.optString("title", ""),
                        date = obj.optString("date", ""),
                        time = obj.optString("time", "")
                    )
                }
            } ?: emptyList()

            return CallSummary(
                phoneNumber = o.getString("phoneNumber"),
                contactName = o.optString("contactName").takeIf { it.isNotEmpty() && it != "null" },
                durationSeconds = o.getLong("durationSeconds"),
                summary = o.getString("summary"),
                keyPoints = keyPoints,
                actionItems = actionItems,
                calendarEvents = calendarEvents,
                sentiment = o.optString("sentiment", "neutral"),
                generatedAt = o.getLong("generatedAt")
            )
        }

        private fun loadRawArray(prefs: android.content.SharedPreferences): JSONArray {
            val raw = prefs.getString(KEY_SUMMARIES, null) ?: return JSONArray()
            return try {
                JSONArray(raw)
            } catch (_: JSONException) {
                JSONArray()
            }
        }
    }
}
