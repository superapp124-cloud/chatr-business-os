package com.chatr.app.nativecalls

import android.content.Context
import android.util.Log
import org.json.JSONObject

enum class PhoneCoreRouteType(val wireValue: String) {
    CHATR_VOIP("chatr_voip"),
    GSM("gsm"),
    PSTN_BRIDGE("pstn_bridge"),
    INVALID("invalid"),
}

enum class PhoneCoreShieldDisposition(val wireValue: String) {
    ALLOW("allow"),
    WARN("warn"),
    HIGH_RISK("high_risk"),
    INVALID("invalid"),
}

data class PhoneCoreRouteDecision(
    val callId: String?,
    val requestedNumber: String,
    val normalizedNumber: String,
    val hashedNumber: String,
    val primaryRoute: PhoneCoreRouteType,
    val fallbackRoute: PhoneCoreRouteType?,
    val shieldDisposition: PhoneCoreShieldDisposition,
    val trustScore: Int,
    val riskLevel: String,
    val identitySource: String,
    val identityLabel: String?,
    val reason: String,
    val confidence: Int,
    val resolvedAt: Long = System.currentTimeMillis(),
) {
    fun toJson(): JSONObject {
        return JSONObject().apply {
            put("callId", callId)
            put("requestedNumber", requestedNumber)
            put("normalizedNumber", normalizedNumber)
            put("hashedNumber", hashedNumber)
            put("primaryRoute", primaryRoute.wireValue)
            put("fallbackRoute", fallbackRoute?.wireValue)
            put("shieldDisposition", shieldDisposition.wireValue)
            put("trustScore", trustScore)
            put("riskLevel", riskLevel)
            put("identitySource", identitySource)
            put("identityLabel", identityLabel)
            put("reason", reason)
            put("confidence", confidence)
            put("resolvedAt", resolvedAt)
        }
    }
}

object PhoneCoreRouter {
    private const val TAG = "PhoneCoreRouter"

    private val emergencyNumbers = setOf("100", "101", "102", "108", "112", "911", "999")

    fun resolveOutgoing(
        context: Context,
        rawPhoneNumber: String,
        callId: String? = null,
    ): PhoneCoreRouteDecision {
        val normalized = NativePhoneNormalizer.normalize(rawPhoneNumber)
        val hashed = NativePhoneNormalizer.hash(normalized.ifBlank { rawPhoneNumber })

        if (normalized.isBlank()) {
            return PhoneCoreRouteDecision(
                callId = callId,
                requestedNumber = rawPhoneNumber,
                normalizedNumber = "",
                hashedNumber = hashed,
                primaryRoute = PhoneCoreRouteType.INVALID,
                fallbackRoute = null,
                shieldDisposition = PhoneCoreShieldDisposition.INVALID,
                trustScore = 0,
                riskLevel = "invalid",
                identitySource = "none",
                identityLabel = null,
                reason = "invalid_phone_number",
                confidence = 0,
            )
        }

        val defenseResult = try {
            NativeGsmDefenseEngine.evaluateIncoming(
                context = context.applicationContext,
                rawNumber = rawPhoneNumber,
                status = "outgoing_route",
                source = "phone_core_router",
                direction = "outgoing",
                allowLiveLookup = true,
            )
        } catch (error: Exception) {
            Log.w(TAG, "Outgoing GSM defense evaluation failed: ${error.message}")
            null
        }

        val trustScore = defenseResult?.trustScore ?: 50
        val spamReports = defenseResult?.spamReports ?: 0
        val riskLevel = defenseResult?.riskLevel ?: "unknown"
        val shieldDisposition = shieldDisposition(riskLevel, trustScore, spamReports)
        val digits = NativePhoneNormalizer.digitsOnly(rawPhoneNumber)
        val emergency = digits in emergencyNumbers

        val primaryRoute = when {
            emergency -> PhoneCoreRouteType.GSM
            else -> PhoneCoreRouteType.CHATR_VOIP
        }

        val fallbackRoute = when (primaryRoute) {
            PhoneCoreRouteType.CHATR_VOIP -> PhoneCoreRouteType.GSM
            else -> null
        }

        val reason = when {
            emergency -> "emergency_number_uses_system_gsm"
            defenseResult?.displayName != null -> "chatr_voip_with_gsm_defense_identity"
            else -> "chatr_voip_first_with_gsm_fallback"
        }

        val confidence = when {
            emergency -> 100
            defenseResult?.displayName != null -> 80
            else -> 45
        }

        return PhoneCoreRouteDecision(
            callId = callId,
            requestedNumber = rawPhoneNumber,
            normalizedNumber = normalized,
            hashedNumber = hashed,
            primaryRoute = primaryRoute,
            fallbackRoute = fallbackRoute,
            shieldDisposition = shieldDisposition,
            trustScore = trustScore,
            riskLevel = riskLevel,
            identitySource = defenseResult?.identitySource ?: "unresolved",
            identityLabel = defenseResult?.displayName,
            reason = reason,
            confidence = confidence,
        )
    }

    private fun shieldDisposition(
        riskLevel: String,
        trustScore: Int,
        spamReports: Int,
    ): PhoneCoreShieldDisposition {
        return when {
            riskLevel.equals("spam", ignoreCase = true) || trustScore < 25 || spamReports >= 5 ->
                PhoneCoreShieldDisposition.HIGH_RISK
            riskLevel.equals("suspicious", ignoreCase = true) || trustScore < 60 || spamReports >= 2 ->
                PhoneCoreShieldDisposition.WARN
            else -> PhoneCoreShieldDisposition.ALLOW
        }
    }
}
