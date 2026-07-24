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

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

data class ScamAnalysis(
    /** One of: "safe", "suspicious", "high_risk" */
    val riskLevel: String,
    /** 0 (safe) – 100 (certain scam) */
    val riskScore: Int,
    val detectedKeywords: List<String>,
    val warningMessage: String,
    val shouldWarn: Boolean
)

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

class ScamDetectionEngine {

    // -----------------------------------------------------------------------
    // Keyword dictionary
    // -----------------------------------------------------------------------

    private val keywordCategories: Map<String, List<String>> = mapOf(

        "financial" to listOf(
            "otp", "pin", "cvv", "bank account", "transfer", "upi", "paytm", "gpay",
            "account number", "ifsc", "credit card", "debit card", "wallet",
            "net banking", "internet banking", "neft", "rtgs", "imps"
        ),

        "authority" to listOf(
            "rbi", "cybercrime", "police", "court", "warrant", "cbi",
            "income tax", "aadhaar", "pan card", "kyc", "enforcement directorate",
            "it department", "sebi", "trai", "doj", "fbi", "interpol"
        ),

        "threat" to listOf(
            "arrest", "jail", "suspend", "block", "cancel", "freeze",
            "legal action", "case registered", "fir", "summons", "detained",
            "criminal charges", "prosecute"
        ),

        "manipulation" to listOf(
            "urgent", "immediately", "don't tell", "secret", "limited time",
            "expire", "verify now", "confirm now", "act now", "last chance",
            "do not disclose", "confidential", "only you", "special offer",
            "exclusive deal", "right now", "within 24 hours", "before midnight"
        ),

        "prize_fraud" to listOf(
            "lottery", "winner", "prize", "selected", "reward", "gift",
            "cashback", "refund", "compensation", "lucky draw", "jackpot",
            "won", "claim your", "free money", "bonus amount"
        ),

        "impersonation" to listOf(
            "microsoft", "amazon", "flipkart", "meesho", "postman",
            "delivery failed", "parcel", "package", "your order",
            "apple support", "google support", "facebook", "whatsapp team",
            "bank manager", "rbi officer", "insurance agent"
        )
    )

    // Category weight multipliers (higher = more dangerous)
    private val categoryWeights: Map<String, Int> = mapOf(
        "financial"     to 25,
        "authority"     to 20,
        "threat"        to 30,
        "manipulation"  to 15,
        "prize_fraud"   to 20,
        "impersonation" to 25
    )

    // -----------------------------------------------------------------------
    // On-device analysis
    // -----------------------------------------------------------------------

    /**
     * Fast, fully offline analysis of a call transcript.
     * Matches keywords by category and calculates a risk score.
     */
    fun analyzeTranscript(transcript: String): ScamAnalysis {
        val normalized = transcript.lowercase()

        val detectedKeywords = mutableListOf<String>()
        val categoryHits = mutableMapOf<String, Int>()

        for ((category, keywords) in keywordCategories) {
            var hitsInCategory = 0
            for (keyword in keywords) {
                if (normalized.contains(keyword)) {
                    detectedKeywords.add(keyword)
                    hitsInCategory++
                }
            }
            if (hitsInCategory > 0) {
                categoryHits[category] = hitsInCategory
            }
        }

        val riskScore = calculateRiskScore(detectedKeywords, categoryHits)
        val riskLevel = scoreToRiskLevel(riskScore)
        val warningMessage = buildWarningMessage(riskLevel, detectedKeywords, categoryHits)

        return ScamAnalysis(
            riskLevel = riskLevel,
            riskScore = riskScore,
            detectedKeywords = detectedKeywords.distinct(),
            warningMessage = warningMessage,
            shouldWarn = riskScore >= WARN_THRESHOLD
        )
    }

    /**
     * Computes a 0-100 risk score from matched keywords and their categories.
     *
     * Formula:
     *   - Each category contributes (hits * weight) capped at (weight * 2)
     *   - Multi-category hits receive a combo bonus
     *   - Total clamped to [0, 100]
     */
    fun calculateRiskScore(
        detectedKeywords: List<String>,
        categoryHits: Map<String, Int>
    ): Int {
        if (detectedKeywords.isEmpty()) return 0

        var score = 0

        for ((category, hits) in categoryHits) {
            val weight = categoryWeights[category] ?: 10
            // Each category can contribute at most (weight * 2) points
            score += minOf(hits * weight, weight * 2)
        }

        // Combo bonus: every additional category beyond the first adds 10 pts
        val categoryCount = categoryHits.size
        if (categoryCount > 1) {
            score += (categoryCount - 1) * 10
        }

        // High-severity pair bonus: threat + authority together is a major red flag
        if (categoryHits.containsKey("threat") && categoryHits.containsKey("authority")) {
            score += 15
        }

        // Financial + manipulation is a classic social-engineering combo
        if (categoryHits.containsKey("financial") && categoryHits.containsKey("manipulation")) {
            score += 10
        }

        return score.coerceIn(0, 100)
    }

    // -----------------------------------------------------------------------
    // Cloud (Gemini) deep analysis
    // -----------------------------------------------------------------------

    /**
     * Sends the transcript and phone number to Gemini for a deeper classification.
     * Falls back to [analyzeTranscript] if the API call fails.
     */
    suspend fun deepAnalyze(transcript: String, phoneNumber: String): ScamAnalysis =
        withContext(Dispatchers.IO) {

            val apiKey = resolveApiKey()

            if (apiKey == PLACEHOLDER_KEY || apiKey.isBlank()) {
                Log.w(TAG, "Gemini API key not configured – using on-device analysis only.")
                return@withContext analyzeTranscript(transcript)
            }

            // Start with on-device keywords to merge into the final result
            val localAnalysis = analyzeTranscript(transcript)

            return@withContext try {
                val prompt = buildDeepAnalysisPrompt(transcript, phoneNumber)
                val rawJson = callGeminiApi(apiKey, prompt)
                mergeWithGeminiResponse(rawJson, localAnalysis)
            } catch (e: Exception) {
                Log.e(TAG, "Gemini deep analysis failed: ${e.message}", e)
                localAnalysis
            }
        }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private fun scoreToRiskLevel(score: Int): String = when {
        score >= HIGH_RISK_THRESHOLD  -> "high_risk"
        score >= SUSPICIOUS_THRESHOLD -> "suspicious"
        else                          -> "safe"
    }

    private fun buildWarningMessage(
        riskLevel: String,
        detectedKeywords: List<String>,
        categoryHits: Map<String, Int>
    ): String {
        return when (riskLevel) {
            "high_risk" -> {
                val topCategories = categoryHits.keys.take(3).joinToString(", ")
                "⚠️ HIGH RISK: This call shows multiple scam patterns ($topCategories). " +
                    "Do NOT share personal or financial information."
            }
            "suspicious" -> {
                val sample = detectedKeywords.take(3).joinToString(", ")
                "⚠️ SUSPICIOUS: Keywords detected that are commonly used in scam calls ($sample). " +
                    "Be cautious and verify the caller's identity independently."
            }
            else -> "✅ No significant scam indicators detected in this call."
        }
    }

    private fun buildDeepAnalysisPrompt(transcript: String, phoneNumber: String): String = """
You are a scam call detection expert. Analyze the following phone call transcript from number $phoneNumber and classify it.

Transcript:
\"\"\"
$transcript
\"\"\"

Respond ONLY with a valid JSON object (no markdown fences, no extra text):
{
  "riskLevel": "<safe|suspicious|high_risk>",
  "riskScore": <integer 0-100>,
  "reasoning": "<one sentence explanation>",
  "additionalKeywords": ["<keyword1>", "<keyword2>"]
}
    """.trimIndent()

    private fun callGeminiApi(apiKey: String, prompt: String): String {
        val endpoint = "$GEMINI_BASE_URL?key=$apiKey"
        val requestBody = JSONObject().apply {
            put("contents", JSONArray().apply {
                put(JSONObject().apply {
                    put("parts", JSONArray().apply {
                        put(JSONObject().apply { put("text", prompt) })
                    })
                })
            })
            put("generationConfig", JSONObject().apply {
                put("temperature", 0.1)
                put("maxOutputTokens", 256)
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
        val raw = BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { it.readText() }

        if (responseCode !in 200..299) {
            throw RuntimeException("Gemini API error $responseCode: $raw")
        }

        return raw
    }

    private fun mergeWithGeminiResponse(rawJson: String, local: ScamAnalysis): ScamAnalysis {
        return try {
            val root = JSONObject(rawJson)
            val content = root.getJSONArray("candidates")
                .getJSONObject(0)
                .getJSONObject("content")
                .getJSONArray("parts")
                .getJSONObject(0)
                .getString("text")
                .trim()
                .removePrefix("```json")
                .removePrefix("```")
                .removeSuffix("```")
                .trim()

            val result = JSONObject(content)

            val geminiRiskLevel = result.optString("riskLevel", local.riskLevel)
                .let { if (it in setOf("safe", "suspicious", "high_risk")) it else local.riskLevel }

            // Blend scores: 60% Gemini, 40% local keyword score
            val geminiScore = result.optInt("riskScore", local.riskScore)
            val blendedScore = ((geminiScore * 0.6) + (local.riskScore * 0.4)).toInt()
                .coerceIn(0, 100)

            val extraKeywords = result.optJSONArray("additionalKeywords")?.let { arr ->
                (0 until arr.length()).map { arr.getString(it) }
            } ?: emptyList()

            val allKeywords = (local.detectedKeywords + extraKeywords).distinct()

            val finalRiskLevel = scoreToRiskLevel(blendedScore)
            val warning = buildWarningMessage(
                finalRiskLevel,
                allKeywords,
                mapOf() // category breakdown not re-computed here
            )

            ScamAnalysis(
                riskLevel = finalRiskLevel,
                riskScore = blendedScore,
                detectedKeywords = allKeywords,
                warningMessage = warning,
                shouldWarn = blendedScore >= WARN_THRESHOLD
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse Gemini scam response: ${e.message}", e)
            local
        }
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

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    companion object {
        private const val TAG = "ScamDetectionEngine"
        private const val GEMINI_BASE_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
        private const val PLACEHOLDER_KEY = "YOUR_GEMINI_KEY"

        const val SUSPICIOUS_THRESHOLD = 30
        const val HIGH_RISK_THRESHOLD  = 60
        const val WARN_THRESHOLD       = 30
    }
}
