package com.chatr.app.nativecalls

import android.content.Context
import android.util.Log
import org.json.JSONObject

data class NativeGsmDefenseResult(
    val rawNumber: String,
    val normalizedNumber: String,
    val hashedNumber: String,
    val displayName: String?,
    val identitySource: String,
    val trustScore: Int,
    val spamReports: Int,
    val riskScore: Int = 0,
    val scamCategory: String = "unknown",
    val confidence: Double = 0.0,
    val recommendedAction: String = "allow",
    val verificationStatus: String? = null,
    val riskLevel: String,
    val decision: String,
    val summary: String,
    val shouldBlock: Boolean,
    val shouldChallenge: Boolean,
    val source: String,
    val activeDefenses: Map<String, Boolean>,
    val evaluatedAt: Long = System.currentTimeMillis(),
) {
    fun toJson(): JSONObject =
        JSONObject().apply {
            put("rawNumber", rawNumber)
            put("normalizedNumber", normalizedNumber)
            put("hashedNumber", hashedNumber)
            put("displayName", displayName ?: JSONObject.NULL)
            put("identitySource", identitySource)
            put("trustScore", trustScore)
            put("spamReports", spamReports)
            put("riskLevel", riskLevel)
            put("decision", decision)
            put("summary", summary)
            put("shouldBlock", shouldBlock)
            put("shouldChallenge", shouldChallenge)
            put("source", source)
            put("evaluatedAt", evaluatedAt)
            put(
                "activeDefenses",
                JSONObject().apply {
                    activeDefenses.forEach { (key, value) -> put(key, value) }
                },
            )
        }
}

object NativeGsmDefenseEngine {
    private const val TAG = "NativeGsmDefense"
    private const val PREFS_NAME = "chatr_gsm_defenses"
    private const val KEY_LAST_RESULT = "last_result"

    const val FEATURE_AI_CALL_SCREEN = "aiScreen"
    const val FEATURE_SCAM_ENGINE = "scamEngine"
    const val FEATURE_DARK_WEB_SCAN = "darkWeb"
    const val FEATURE_ANTI_TRACKER = "antiTracker"

    private val featureKeys = listOf(
        FEATURE_AI_CALL_SCREEN,
        FEATURE_SCAM_ENGINE,
        FEATURE_DARK_WEB_SCAN,
        FEATURE_ANTI_TRACKER,
    )

    fun isFeatureEnabled(context: Context, key: String): Boolean =
        prefs(context).getBoolean(key, true)

    fun setFeature(context: Context, key: String, enabled: Boolean) {
        if (key !in featureKeys) {
            Log.w(TAG, "Ignoring unknown GSM defense feature: $key")
            return
        }

        prefs(context).edit().putBoolean(key, enabled).apply()
        Log.i(TAG, "GSM defense feature $key enabled=$enabled")
    }

    fun stateJson(context: Context): JSONObject {
        val appContext = context.applicationContext
        return JSONObject().apply {
            put("features", featuresJson(appContext))
            put("lastResult", lastResultJson(appContext) ?: JSONObject.NULL)
            put("schema", 1)
        }
    }

    fun evaluateIncoming(
        context: Context,
        rawNumber: String,
        status: String,
        source: String,
        deviceEventId: String? = null,
        direction: String = "incoming",
        startedAt: Long = System.currentTimeMillis(),
        endedAt: Long? = null,
        durationSeconds: Long = 0,
        allowLiveLookup: Boolean = false,
        persist: Boolean = true,
    ): NativeGsmDefenseResult {
        val appContext = context.applicationContext
        val normalized = NativePhoneNormalizer.normalize(rawNumber)
        val hashed = NativePhoneNormalizer.hash(normalized.ifBlank { rawNumber })
        val features = activeFeatures(appContext)

        if (normalized.isBlank()) {
            return NativeGsmDefenseResult(
                rawNumber = rawNumber,
                normalizedNumber = "",
                hashedNumber = hashed,
                displayName = null,
                identitySource = "unavailable",
                trustScore = 0,
                spamReports = 0,
                riskLevel = "unknown",
                decision = "observe",
                summary = "Caller number unavailable from Android telephony.",
                shouldBlock = false,
                shouldChallenge = features[FEATURE_AI_CALL_SCREEN] == true,
                source = source,
                activeDefenses = features,
            ).also { remember(appContext, it) }
        }

        val repo = NativeCallRepository.getInstance(appContext)
        val contact = NativeContactResolver.lookup(appContext, rawNumber)
        val contactProfile = contact?.let { NativeContactResolver.profileFor(it) }
        if (contactProfile != null) repo.upsertProfile(contactProfile)

        val cachedProfile = repo.findProfile(normalized)
        val antiTracker = features[FEATURE_ANTI_TRACKER] == true
        val liveProfile =
            if (
                contactProfile == null &&
                cachedProfile == null &&
                allowLiveLookup &&
                features[FEATURE_SCAM_ENGINE] == true
            ) {
                try {
                    SupabaseNativeCallClient(appContext)
                        .lookupCaller(normalized, includeRawNumber = !antiTracker)
                        .also { repo.upsertProfile(it) }
                } catch (error: Exception) {
                    Log.w(TAG, "Live caller lookup failed: ${error.message}")
                    null
                }
            } else {
                null
            }

        val profile = contactProfile ?: cachedProfile ?: liveProfile
        var usefulName = profile?.displayName
            ?.takeIf { it.isNotBlank() }
            ?.takeUnless { it.equals("Unknown Caller", ignoreCase = true) }
            ?.takeUnless { isPhoneLikeName(it, normalized) }

        val identitySource = profile?.source ?: "unresolved"
        val trustScore = profile?.trustScore ?: 50
        val spamReports = profile?.spamReports ?: 0
        val riskLevel = profile?.riskLevel ?: "unknown"
        val scamHighRisk =
            features[FEATURE_SCAM_ENGINE] == true &&
                (riskLevel.equals("spam", ignoreCase = true) || trustScore < 25 || spamReports >= 5)
        val suspicious =
            riskLevel.equals("suspicious", ignoreCase = true) || trustScore < 60 || spamReports >= 2
        val shouldChallenge =
            features[FEATURE_AI_CALL_SCREEN] == true &&
                contact == null &&
                !scamHighRisk &&
                (usefulName == null || suspicious)
        val decision = when {
            scamHighRisk -> "block"
            shouldChallenge -> "challenge"
            suspicious -> "warn"
            else -> "allow"
        }
        val summary = when (decision) {
            "block" -> "Chatr AI: High-risk spam detected. Call blocked."
            "challenge" -> "Chatr AI: Call screening required. Identity unverified."
            "warn" -> "Chatr AI: Suspicious behavior. Proceed with caution."
            else -> {
                if (contact != null) "Chatr AI: Safe saved contact calling."
                else "Chatr AI: No risk signals detected."
            }
        }

        val result = NativeGsmDefenseResult(
            rawNumber = rawNumber,
            normalizedNumber = normalized,
            hashedNumber = hashed,
            displayName = usefulName,
            identitySource = identitySource,
            trustScore = trustScore,
            spamReports = spamReports,
            riskLevel = riskLevel,
            decision = decision,
            summary = summary,
            shouldBlock = scamHighRisk,
            shouldChallenge = shouldChallenge,
            source = source,
            activeDefenses = features,
        )

        if (persist) {
            repo.upsertEvent(
                NativeCallEvent(
                    deviceEventId = deviceEventId ?: "gsm:$normalized:${System.currentTimeMillis()}",
                    callLogId = null,
                    phoneNumber = if (antiTracker) normalized else rawNumber,
                    normalizedNumber = normalized,
                    hashedNumber = hashed,
                    contactName = contact?.displayName,
                    callerName = usefulName,
                    direction = direction,
                    status = status,
                    startedAt = startedAt,
                    endedAt = endedAt,
                    durationSeconds = durationSeconds,
                    trustScore = trustScore,
                    spamReports = spamReports,
                    riskLevel = riskLevel,
                    source = source,
                    rawPayload = result.toJson().toString(),
                ),
            )
        }

        remember(appContext, result)
        return result
    }

    private fun featuresJson(context: Context): JSONObject =
        JSONObject().apply {
            activeFeatures(context).forEach { (key, value) -> put(key, value) }
        }

    private fun activeFeatures(context: Context): Map<String, Boolean> =
        featureKeys.associateWith { isFeatureEnabled(context, it) }

    private fun remember(context: Context, result: NativeGsmDefenseResult) {
        prefs(context).edit().putString(KEY_LAST_RESULT, result.toJson().toString()).apply()
    }

    private fun lastResultJson(context: Context): JSONObject? {
        val raw = prefs(context).getString(KEY_LAST_RESULT, null) ?: return null
        return try {
            JSONObject(raw)
        } catch (_: Exception) {
            null
        }
    }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun isPhoneLikeName(name: String, phone: String): Boolean {
        if (Regex("^\\+?[\\d\\s().-]+$").matches(name.trim())) return true
        val nameDigits = NativePhoneNormalizer.digitsOnly(name)
        if (nameDigits.length < 5) return false
        val phoneDigits = NativePhoneNormalizer.digitsOnly(phone)
        return phoneDigits.contains(nameDigits) ||
            nameDigits.contains(phoneDigits.takeLast(10))
    }
}
