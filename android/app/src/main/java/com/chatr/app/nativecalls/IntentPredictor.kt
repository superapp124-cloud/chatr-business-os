package com.chatr.app.nativecalls

import android.content.Context
import org.json.JSONObject
import java.util.Locale
import java.util.concurrent.TimeUnit

data class IntentPrediction(
    val label: String,
    val confidence: Int,
    val reason: String,
    val suggestedAction: String,
    val source: String,
) {
    fun toJson(): JSONObject =
        JSONObject().apply {
            put("label", label)
            put("confidence", confidence)
            put("reason", reason)
            put("suggestedAction", suggestedAction)
            put("source", source)
        }
}

object IntentPredictor {
    private val deliveryTokens = listOf(
        "delivery", "courier", "parcel", "amazon", "flipkart", "swiggy", "zomato",
        "blinkit", "zepto", "dunzo", "porter", "bluedart", "delhivery", "ekart",
    )
    private val recruiterTokens = listOf("recruiter", "talent", "hr", "hiring", "interview", "job")
    private val businessTokens = listOf("business", "services", "pvt", "ltd", "llp", "company", "support")
    private val familyTokens = listOf("mom", "mother", "dad", "father", "wife", "husband", "brother", "sister", "home")
    private val paymentTokens = listOf("pay", "payment", "upi", "invoice", "refund", "bank")

    fun predict(
        context: Context,
        rawNumber: String,
        defenseResult: NativeGsmDefenseResult? = null,
    ): IntentPrediction {
        return IntentPrediction(
            label = "unknown",
            confidence = 42,
            reason = "No strong local intent signal yet.",
            suggestedAction = "allow_with_shield_context",
            source = "fallback",
        )
    }

    fun buildGeminiNanoPrompt(
        callerNumber: String,
        callerName: String?,
        localHistory: String,
    ): String =
        """
        Predict the likely reason for this incoming GSM call.
        Return JSON only with label, confidence, reason, suggestedAction.

        Caller number: $callerNumber
        Caller name: ${callerName ?: "Unknown"}
        Local history: $localHistory

        Labels: delivery, recruiter, family_or_vip, business, payment, emergency, spam_or_risk, unknown.
        """.trimIndent()

    private fun containsAny(value: String, tokens: List<String>): Boolean =
        tokens.any { value.contains(it) }
}
