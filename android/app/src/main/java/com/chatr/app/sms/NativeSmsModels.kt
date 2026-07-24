package com.chatr.app.sms

import org.json.JSONArray
import org.json.JSONObject

data class SmsRisk(
    val isOtp: Boolean,
    val otpCode: String?,
    val spamScore: Int,
    val riskLevel: String,
    val reasons: List<String>,
    val categories: List<String> = emptyList(),
    val matchedPhrases: List<String> = emptyList(),
    val summary: String = "",
    val recommendedAction: String = "allow",
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("isOtp", isOtp)
        put("otpCode", otpCode ?: JSONObject.NULL)
        put("spamScore", spamScore)
        put("riskLevel", riskLevel)
        put("reasons", JSONArray(reasons))
        put("categories", JSONArray(categories))
        put("matchedPhrases", JSONArray(matchedPhrases))
        put("summary", summary)
        put("recommendedAction", recommendedAction)
    }
}

data class NativeSmsMessage(
    val id: String,
    val conversationId: String,
    val address: String,
    val displayName: String,
    val direction: String,
    val body: String,
    val timestamp: Long,
    val status: String,
    val read: Boolean,
    val risk: SmsRisk,
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("id", id)
        put("conversationId", conversationId)
        put("address", address)
        put("displayName", displayName)
        put("direction", direction)
        put("body", body)
        put("timestamp", timestamp)
        put("status", status)
        put("read", read)
        put("risk", risk.toJson())
    }
}

data class NativeSmsConversation(
    val conversationId: String,
    val address: String,
    val displayName: String,
    val lastBody: String,
    val lastTimestamp: Long,
    val unreadCount: Int,
    val lastRisk: SmsRisk,
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("conversationId", conversationId)
        put("address", address)
        put("displayName", displayName)
        put("lastBody", lastBody)
        put("lastTimestamp", lastTimestamp)
        put("unreadCount", unreadCount)
        put("lastRisk", lastRisk.toJson())
    }
}
