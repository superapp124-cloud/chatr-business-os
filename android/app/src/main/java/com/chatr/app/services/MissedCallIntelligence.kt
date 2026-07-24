package com.chatr.app.services

import android.content.Context
import com.chatr.app.nativecalls.IntentPrediction
import com.chatr.app.nativecalls.IntentPredictor
import com.chatr.app.nativecalls.NativeGsmDefenseResult

data class MissedCallInsight(
    val title: String,
    val body: String,
    val urgencyScore: Int,
    val prediction: IntentPrediction,
    val actions: List<String>,
)

object MissedCallIntelligence {
    fun generate(
        context: Context,
        phoneNumber: String,
        contactName: String?,
        defenseResult: NativeGsmDefenseResult? = null,
    ): MissedCallInsight {
        val prediction = IntentPredictor.predict(context, phoneNumber, defenseResult)
        val caller = contactName?.takeIf { it.isNotBlank() } ?: defenseResult?.displayName ?: phoneNumber
        val urgency = when (prediction.label) {
            "family_or_vip", "urgent_follow_up" -> 86
            "delivery", "recruiter", "business" -> 68
            "payment" -> 56
            "spam_or_risk" -> 18
            else -> 42
        }
        val recommendation = when (prediction.label) {
            "delivery" -> "Likely delivery call. Prepare gate or location instructions."
            "recruiter" -> "Likely recruiter. Schedule a callback if relevant."
            "family_or_vip" -> "Trusted or repeated caller. Call back soon."
            "urgent_follow_up" -> "Repeated missed call. Check whether this is urgent."
            "business" -> "Likely business context. Capture notes before calling back."
            "payment" -> "Payment-related signal. Verify identity before sharing details."
            "spam_or_risk" -> "Risk signals detected. Ignore or report if unwanted."
            else -> "Unknown intent. Call back only if expected."
        }

        return MissedCallInsight(
            title = "$caller · ${prediction.label.replace('_', ' ')}",
            body = recommendation,
            urgencyScore = urgency,
            prediction = prediction,
            actions = when (prediction.label) {
                "spam_or_risk" -> listOf("Ignore", "Report spam", "Block")
                "delivery" -> listOf("Call back", "Send directions", "Save note")
                else -> listOf("Call back", "Message caller", "Remind me")
            },
        )
    }
}
