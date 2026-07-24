package com.chatr.app.postcall

import android.content.Context
import android.util.Log
import com.chatr.app.sms.NativeSmsSender
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * ViralSmsDispatcher
 *
 * After a highly-rated call (AI score >= threshold), sends a smart referral SMS
 * to the caller's number inviting them to try Chatr+.
 *
 * Rules:
 *   - Only fires if the call lasted > MIN_DURATION_SEC
 *   - Only fires if AI quality score >= MIN_AI_SCORE
 *   - Never sends to the same number twice (checked via CallRecordStore.viralSent)
 *   - Respects user's "viral referral" opt-in preference in SharedPreferences
 *
 * Called by: PostCallSummaryActivity after summary is generated
 */
object ViralSmsDispatcher {

    private const val TAG = "ViralSmsDispatcher"
    private const val PREFS_KEY = "chatr_viral_opt_in"
    private const val MIN_DURATION_SEC = 30
    private const val MIN_AI_SCORE = 0.75

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    /**
     * Evaluate a completed call and dispatch referral SMS if eligible.
     *
     * @param context      Android context
     * @param callId       Unique call identifier
     * @param callerNumber Caller's phone number
     * @param durationSec  Actual call duration in seconds
     * @param aiScore      AI quality score (0.0 – 1.0)
     * @param summaryText  AI-generated call summary (appended to message)
     */
    fun maybeDispatch(
        context: Context,
        callId: String,
        callerNumber: String,
        durationSec: Int,
        aiScore: Double,
        summaryText: String? = null
    ) {
        // Check user opt-in
        val prefs = context.getSharedPreferences(PREFS_KEY, Context.MODE_PRIVATE)
        val optedIn = prefs.getBoolean("viral_enabled", false)
        if (!optedIn) {
            Log.d(TAG, "Viral referral disabled by user — skipping")
            return
        }

        // Check eligibility criteria
        if (durationSec < MIN_DURATION_SEC) {
            Log.d(TAG, "Call too short ($durationSec s < $MIN_DURATION_SEC s) — skipping viral")
            return
        }
        if (aiScore < MIN_AI_SCORE) {
            Log.d(TAG, "AI score too low ($aiScore < $MIN_AI_SCORE) — skipping viral")
            return
        }

        scope.launch {
            val store = CallRecordStore.getInstance(context)

            // Check if already sent for this call
            val existing = store.getPendingViralRecords(MIN_AI_SCORE)
            val alreadySent = existing.none { it["callId"] == callId }
            if (alreadySent) {
                Log.d(TAG, "Viral already sent for callId=$callId — skipping")
                return@launch
            }

            val message = buildReferralMessage(summaryText)
            Log.i(TAG, "📨 Sending viral referral to $callerNumber")

            try {
                NativeSmsSender.send(context, callerNumber, message)
                store.markViralSent(callId)
                Log.i(TAG, "✅ Viral referral sent to $callerNumber")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to send viral referral to $callerNumber", e)
            }
        }
    }

    private fun buildReferralMessage(summaryText: String?): String {
        val base = "Hey! We just had a great call. I'm using Chatr+ — it has AI call screening, " +
                "live translation & smart summaries. Try it free: https://chatr.app"
        return if (!summaryText.isNullOrBlank() && summaryText.length < 80) {
            "$base\n\nOur call: $summaryText"
        } else base
    }

    /**
     * Enable or disable viral referral sending.
     * Stored in SharedPreferences so the setting persists across restarts.
     */
    fun setEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS_KEY, Context.MODE_PRIVATE)
            .edit().putBoolean("viral_enabled", enabled).apply()
        Log.i(TAG, "Viral referral enabled=$enabled")
    }

    fun isEnabled(context: Context): Boolean {
        return context.getSharedPreferences(PREFS_KEY, Context.MODE_PRIVATE)
            .getBoolean("viral_enabled", false)
    }
}
