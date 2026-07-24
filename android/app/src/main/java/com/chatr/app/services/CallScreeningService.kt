package com.chatr.app.services

import android.content.Context
import android.content.Intent
import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log
import androidx.annotation.RequiresApi
import com.chatr.app.nativecalls.NativeCallEvent
import com.chatr.app.nativecalls.NativeCallerProfile
import com.chatr.app.nativecalls.NativeCallRepository
import com.chatr.app.nativecalls.NativeGsmDefenseEngine
import com.chatr.app.nativecalls.NativeGsmDefenseResult
import com.chatr.app.nativecalls.NativePhoneNormalizer
import com.chatr.app.nativecalls.SupabaseNativeCallClient
import org.json.JSONObject

@RequiresApi(Build.VERSION_CODES.N)
class ChatrCallScreeningService : CallScreeningService() {

    override fun onScreenCall(callDetails: Call.Details) {
        val number = callDetails.handle?.schemeSpecificPart.orEmpty()
        val normalized = NativePhoneNormalizer.normalize(number)
        Log.i(TAG, "Screening call from: $number")
        startCallerIdOverlay(number, null)

        val result = NativeGsmDefenseEngine.evaluateIncoming(
            context = applicationContext,
            rawNumber = number,
            status = "screening",
            source = "call_screening",
            deviceEventId = if (normalized.isNotBlank()) {
                "screen:$normalized:${System.currentTimeMillis()}"
            } else {
                null
            },
            allowLiveLookup = false,
        )

        startCallerIdOverlay(number, result)

        val shouldBlock = shouldBlockCall(
            number = number,
            callDetails = callDetails,
            riskLevel = result.riskLevel,
            spamReports = result.spamReports,
            trustScore = result.trustScore,
        ) || result.shouldBlock

        val responseBuilder = CallResponse.Builder()
        if (shouldBlock) {
            responseBuilder
                .setDisallowCall(true)
                .setRejectCall(true)
                .setSkipCallLog(false)
                .setSkipNotification(true)
            Log.i(TAG, "Blocking GSM caller by Chatr defenses decision=${result.decision} risk=${result.riskLevel}")
        } else {
            responseBuilder
                .setDisallowCall(false)
                .setRejectCall(false)
            Log.i(TAG, "Allowing GSM caller decision=${result.decision} risk=${result.riskLevel}")
        }

        respondToCall(callDetails, responseBuilder.build())
    }

    private fun startCallerIdOverlay(number: String, result: NativeGsmDefenseResult?) {
        val displayNumber = number.takeIf { it.isNotBlank() } ?: "Unknown"
        val intent = Intent(applicationContext, IncomingCallOverlayService::class.java).apply {
            putExtra("phone_number", displayNumber)
            putExtra("source", "call_screening")
            result?.let {
                putExtra("caller_name", it.displayName)
                putExtra("trust_score", it.trustScore)
                putExtra("spam_reports", it.spamReports)
                putExtra("risk_level", it.riskLevel)
                putExtra("defense_decision", it.decision)
                putExtra("defense_summary", it.summary)
                putExtra("should_challenge", it.shouldChallenge)
            }
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                applicationContext.startForegroundService(intent)
            } else {
                applicationContext.startService(intent)
            }
        } catch (error: Exception) {
            Log.e(TAG, "Could not start caller ID overlay from screening", error)
        }
    }

    private fun shouldBlockCall(
        number: String,
        callDetails: Call.Details,
        riskLevel: String?,
        spamReports: Int,
        trustScore: Int,
    ): Boolean {
        if (isBlacklisted(number)) {
            Log.d(TAG, "Number is blacklisted")
            return true
        }

        if (blockAnonymous && number.isBlank()) {
            Log.d(TAG, "Blocking anonymous call")
            return true
        }

        if (blockUnknown && !isKnownCaller(number)) {
            Log.d(TAG, "Blocking unknown caller")
            return true
        }

        if (riskLevel == "spam" || spamReports >= 5 || trustScore < 25) {
            Log.d(TAG, "Blocking by Chatr intelligence risk=$riskLevel reports=$spamReports trust=$trustScore")
            return true
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            when (callDetails.callerNumberVerificationStatus) {
                2 -> Log.d(TAG, "Caller verification failed")
                1 -> Log.d(TAG, "Caller verification passed")
            }
        }

        return false
    }

    private fun isKnownCaller(number: String): Boolean {
        return number.isNotBlank()
    }

    private fun recordScreeningDecision(
        rawNumber: String,
        decision: String,
        callerName: String?,
        trustScore: Int,
        spamReports: Int,
        riskLevel: String,
    ) {
        val normalized = NativePhoneNormalizer.normalize(rawNumber)
        if (normalized.isBlank()) return

        try {
            NativeCallRepository.getInstance(applicationContext).upsertEvent(
                NativeCallEvent(
                    deviceEventId = "screen:$normalized:${System.currentTimeMillis()}",
                    callLogId = null,
                    phoneNumber = rawNumber,
                    normalizedNumber = normalized,
                    hashedNumber = NativePhoneNormalizer.hash(normalized),
                    contactName = null,
                    callerName = callerName?.takeIf { it != "Unknown Caller" },
                    direction = "incoming",
                    status = decision,
                    startedAt = System.currentTimeMillis(),
                    endedAt = null,
                    durationSeconds = 0,
                    trustScore = trustScore,
                    spamReports = spamReports,
                    riskLevel = riskLevel,
                    source = "call_screening",
                    rawPayload = JSONObject().apply {
                        put("decision", decision)
                    }.toString(),
                )
            )
        } catch (error: Exception) {
            Log.w(TAG, "Failed to record screening decision: ${error.message}")
        }
    }

    companion object {
        private const val TAG = "ChatrCallScreening"

        private val blacklist = mutableSetOf<String>()
        private var blockAnonymous = false
        private var blockUnknown = false
        private var requireNameAnnouncement = false

        fun addToBlacklist(number: String) {
            blacklist.add(normalizeNumber(number))
            Log.i(TAG, "Added to blacklist: $number")
        }

        fun removeFromBlacklist(number: String) {
            blacklist.remove(normalizeNumber(number))
            Log.i(TAG, "Removed from blacklist: $number")
        }

        fun isBlacklisted(number: String): Boolean {
            return blacklist.contains(normalizeNumber(number))
        }

        fun setBlockAnonymous(enabled: Boolean) {
            blockAnonymous = enabled
            Log.i(TAG, "Block anonymous: $enabled")
        }

        fun setBlockUnknown(enabled: Boolean) {
            blockUnknown = enabled
            Log.i(TAG, "Block unknown: $enabled")
        }

        fun setRequireNameAnnouncement(enabled: Boolean) {
            requireNameAnnouncement = enabled
            Log.i(TAG, "Require name announcement: $enabled")
        }

        fun getBlacklist(): Set<String> = blacklist.toSet()

        fun clearBlacklist() {
            blacklist.clear()
            Log.i(TAG, "Blacklist cleared")
        }

        private fun normalizeNumber(number: String): String {
            return number.replace(Regex("[^0-9+]"), "")
        }
    }
}

class CallBlockingManager(private val context: Context) {

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    init {
        loadSettings()
    }

    fun blockNumber(number: String, reason: String? = null) {
        ChatrCallScreeningService.addToBlacklist(number)
        saveBlacklist()
        Log.i(TAG, "Blocked: $number, reason: $reason")
    }

    fun unblockNumber(number: String) {
        ChatrCallScreeningService.removeFromBlacklist(number)
        saveBlacklist()
        Log.i(TAG, "Unblocked: $number")
    }

    fun isBlocked(number: String): Boolean {
        return ChatrCallScreeningService.isBlacklisted(number)
    }

    fun getBlockedNumbers(): Set<String> {
        return ChatrCallScreeningService.getBlacklist()
    }

    fun setBlockAnonymousCalls(enabled: Boolean) {
        ChatrCallScreeningService.setBlockAnonymous(enabled)
        prefs.edit().putBoolean(KEY_BLOCK_ANONYMOUS, enabled).apply()
    }

    fun setBlockUnknownCallers(enabled: Boolean) {
        ChatrCallScreeningService.setBlockUnknown(enabled)
        prefs.edit().putBoolean(KEY_BLOCK_UNKNOWN, enabled).apply()
    }

    fun setRequireNameAnnouncement(enabled: Boolean) {
        ChatrCallScreeningService.setRequireNameAnnouncement(enabled)
        prefs.edit().putBoolean(KEY_REQUIRE_NAME, enabled).apply()
    }

    private fun saveBlacklist() {
        prefs.edit().putStringSet(KEY_BLACKLIST, ChatrCallScreeningService.getBlacklist()).apply()
    }

    private fun loadSettings() {
        prefs.getStringSet(KEY_BLACKLIST, emptySet())?.forEach { number ->
            ChatrCallScreeningService.addToBlacklist(number)
        }

        ChatrCallScreeningService.setBlockAnonymous(
            prefs.getBoolean(KEY_BLOCK_ANONYMOUS, false),
        )
        ChatrCallScreeningService.setBlockUnknown(
            prefs.getBoolean(KEY_BLOCK_UNKNOWN, false),
        )
        ChatrCallScreeningService.setRequireNameAnnouncement(
            prefs.getBoolean(KEY_REQUIRE_NAME, false),
        )

        Log.i(TAG, "Call blocking settings loaded")
    }

    companion object {
        private const val TAG = "CallBlockingManager"
        private const val PREFS_NAME = "chatr_call_blocking"
        private const val KEY_BLACKLIST = "blacklist"
        private const val KEY_BLOCK_ANONYMOUS = "block_anonymous"
        private const val KEY_BLOCK_UNKNOWN = "block_unknown"
        private const val KEY_REQUIRE_NAME = "require_name"

        @Volatile
        private var instance: CallBlockingManager? = null

        fun getInstance(context: Context): CallBlockingManager {
            return instance ?: synchronized(this) {
                instance ?: CallBlockingManager(context.applicationContext).also { instance = it }
            }
        }
    }
}
