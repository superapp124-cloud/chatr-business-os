package com.chatr.app.ondeviceai

import android.content.Context
import android.os.Build
import android.os.SystemClock
import android.util.Log
import com.google.mlkit.genai.common.DownloadCallback
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.common.GenAiException
import com.google.mlkit.genai.prompt.GenerateContentRequest
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.TextPart
import com.google.mlkit.genai.prompt.java.GenerativeModelFutures
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.Locale
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton
import org.json.JSONArray
import org.json.JSONObject

data class OnDeviceAiAvailability(
    val available: Boolean,
    val status: String,
    val downloadable: Boolean,
    val downloading: Boolean,
    val model: String,
    val provider: String,
    val reason: String? = null,
)

data class OnDeviceAiGeneration(
    val text: String,
    val task: String,
    val status: String,
    val model: String,
    val provider: String,
    val latencyMs: Long,
    val jsonText: String? = null,
)

@Singleton
class OnDeviceAiService @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val generativeModel by lazy {
        GenerativeModelFutures.from(Generation.getClient())
    }

    @Synchronized
    fun checkAvailability(downloadIfNeeded: Boolean = false): OnDeviceAiAvailability {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return unavailable("android_api_below_26")
        }

        return try {
            when (val status = generativeModel.checkStatus().get(8, TimeUnit.SECONDS)) {
                FeatureStatus.AVAILABLE -> available("available")
                FeatureStatus.DOWNLOADABLE -> {
                    if (downloadIfNeeded && downloadModelBlocking()) {
                        available("available")
                    } else {
                        OnDeviceAiAvailability(
                            available = false,
                            status = "downloadable",
                            downloadable = true,
                            downloading = false,
                            model = MODEL_NAME,
                            provider = PROVIDER,
                            reason = "model_download_required",
                        )
                    }
                }
                FeatureStatus.DOWNLOADING -> OnDeviceAiAvailability(
                    available = false,
                    status = "downloading",
                    downloadable = true,
                    downloading = true,
                    model = MODEL_NAME,
                    provider = PROVIDER,
                    reason = "model_download_in_progress",
                )
                FeatureStatus.UNAVAILABLE -> unavailable("gemini_nano_unavailable")
                else -> unavailable("unknown_status_$status")
            }
        } catch (error: Exception) {
            Log.w(TAG, "Gemini Nano availability check failed", error)
            unavailable(error.normalizedReason())
        }
    }

    @Synchronized
    fun generate(
        prompt: String,
        task: String,
        maxInputWords: Int = DEFAULT_MAX_INPUT_WORDS,
        maxOutputTokens: Int = DEFAULT_MAX_OUTPUT_TOKENS,
    ): OnDeviceAiGeneration {
        val startedAt = SystemClock.elapsedRealtime()
        val availability = checkAvailability(downloadIfNeeded = true)
        if (!availability.available) {
            throw IllegalStateException(availability.reason ?: availability.status)
        }

        val safeTask = task.ifBlank { "general" }.lowercase(Locale.US)
        val safePrompt = sanitizePrompt(prompt, maxInputWords.coerceIn(64, DEFAULT_MAX_INPUT_WORDS))
        val wrappedPrompt = buildTaskPrompt(safeTask, safePrompt)
        val requestBuilder = GenerateContentRequest.Builder(TextPart(wrappedPrompt)).apply {
            temperature = 0.2f
            topK = 16
            candidateCount = 1
            this.maxOutputTokens = maxOutputTokens.coerceIn(16, 256)
        }
        val request = requestBuilder.build()

        val response = generativeModel.generateContent(request).get(45, TimeUnit.SECONDS)
        val text = sanitizeModelText(response.candidates.firstOrNull()?.text.orEmpty())
        if (text.isBlank()) {
            throw IllegalStateException("empty_on_device_response")
        }

        return OnDeviceAiGeneration(
            text = text,
            task = safeTask,
            status = "available",
            model = MODEL_NAME,
            provider = PROVIDER,
            latencyMs = SystemClock.elapsedRealtime() - startedAt,
            jsonText = extractJson(text),
        )
    }

    private fun downloadModelBlocking(): Boolean {
        var completed = false
        val future = generativeModel.download(object : DownloadCallback {
            override fun onDownloadStarted(bytesToDownload: Long) {
                Log.i(TAG, "Gemini Nano download started: $bytesToDownload bytes")
            }

            override fun onDownloadProgress(totalBytesDownloaded: Long) {
                Log.d(TAG, "Gemini Nano download progress: $totalBytesDownloaded bytes")
            }

            override fun onDownloadCompleted() {
                completed = true
                Log.i(TAG, "Gemini Nano download complete")
            }

            override fun onDownloadFailed(e: GenAiException) {
                Log.w(TAG, "Gemini Nano download failed: ${e.message}", e)
            }
        })

        future.get(90, TimeUnit.SECONDS)
        return completed || generativeModel.checkStatus().get(8, TimeUnit.SECONDS) == FeatureStatus.AVAILABLE
    }

    private fun available(status: String): OnDeviceAiAvailability {
        return OnDeviceAiAvailability(
            available = true,
            status = status,
            downloadable = false,
            downloading = false,
            model = MODEL_NAME,
            provider = PROVIDER,
        )
    }

    private fun unavailable(reason: String): OnDeviceAiAvailability {
        return OnDeviceAiAvailability(
            available = false,
            status = "unavailable",
            downloadable = false,
            downloading = false,
            model = MODEL_NAME,
            provider = PROVIDER,
            reason = reason,
        )
    }

    private fun sanitizePrompt(prompt: String, maxWords: Int): String {
        val cleaned = prompt
            .replace(Regex("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()

        val words = cleaned.split(Regex("\\s+")).filter { it.isNotBlank() }
        return if (words.size <= maxWords) cleaned else words.take(maxWords).joinToString(" ")
    }

    private fun sanitizeModelText(text: String): String {
        return text
            .replace(Regex("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]"), "")
            .trim()
            .trim('`')
            .trim()
    }

    private fun extractJson(text: String): String? {
        val trimmed = sanitizeModelText(text)
        val directJson = runCatching {
            when {
                trimmed.startsWith("{") -> JSONObject(trimmed).toString()
                trimmed.startsWith("[") -> JSONArray(trimmed).toString()
                else -> null
            }
        }.getOrNull()
        if (directJson != null) return directJson

        val arrayStart = trimmed.indexOf('[')
        val arrayEnd = trimmed.lastIndexOf(']')
        if (arrayStart >= 0 && arrayEnd > arrayStart) {
            val candidate = trimmed.substring(arrayStart, arrayEnd + 1)
            runCatching { return JSONArray(candidate).toString() }
        }

        val objectStart = trimmed.indexOf('{')
        val objectEnd = trimmed.lastIndexOf('}')
        if (objectStart >= 0 && objectEnd > objectStart) {
            val candidate = trimmed.substring(objectStart, objectEnd + 1)
            runCatching { return JSONObject(candidate).toString() }
        }

        return null
    }

    private fun buildTaskPrompt(task: String, prompt: String): String {
        val instruction = when (task) {
            "summarize" -> "Summarize the conversation in under 120 words. Use plain text, no markdown."
            "smart_replies", "smart_compose" -> "Return only a JSON array of exactly 3 short natural reply strings. No markdown."
            else -> "Answer concisely for a mobile chat app. Use plain text."
        }

        return """
            You are CHATR on-device AI running through Android AICore Gemini Nano.
            Process the user's private content locally and avoid asking to upload it.
            $instruction

            User content:
            $prompt
        """.trimIndent()
    }

    private fun Exception.normalizedReason(): String {
        val raw = message?.takeIf { it.isNotBlank() } ?: javaClass.simpleName
        return raw
            .lowercase(Locale.US)
            .replace(Regex("[^a-z0-9]+"), "_")
            .trim('_')
            .take(120)
            .ifBlank { "on_device_ai_error" }
    }

    companion object {
        private const val TAG = "OnDeviceAiService"
        private const val MODEL_NAME = "Gemini Nano via ML Kit Prompt API"
        private const val PROVIDER = "Android AICore"
        private const val DEFAULT_MAX_INPUT_WORDS = 2800
        private const val DEFAULT_MAX_OUTPUT_TOKENS = 192
    }
}
