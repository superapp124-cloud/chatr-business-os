package com.chatr.app.nativecalls

import android.content.Context
import kotlinx.coroutines.runBlocking
import java.util.concurrent.TimeUnit

data class CallerScoreLayer(
    val name: String,
    val score: Int,
    val signal: String,
)

data class CallerScore(
    val result: NativeGsmDefenseResult,
    val layers: List<CallerScoreLayer>,
    val disposition: String,
)

object CallerScorer {
    fun scoreIncoming(
        context: Context,
        rawNumber: String,
        status: String,
        source: String,
        deviceEventId: String? = null,
        allowLiveLookup: Boolean = false,
    ): CallerScore {
        val result = NativeGsmDefenseEngine.evaluateIncoming(
            context = context.applicationContext,
            rawNumber = rawNumber,
            status = status,
            source = source,
            deviceEventId = deviceEventId,
            allowLiveLookup = allowLiveLookup,
        )
        return fromResult(context, result)
    }

    fun fromResult(context: Context, result: NativeGsmDefenseResult): CallerScore {
        val repo = NativeCallRepository.getInstance(context.applicationContext)
        val normalized = result.normalizedNumber
        val cachedProfile = repo.findProfile(normalized)
        val postCallScore: Int? = null
        val recent24h = repo.countEventsForNumber(
            normalized,
            System.currentTimeMillis() - TimeUnit.HOURS.toMillis(24),
        )
        val highRisk30d = repo.countHighRiskEventsForNumber(
            normalized,
            System.currentTimeMillis() - TimeUnit.DAYS.toMillis(30),
        )
        val hasChatrHistory = repo.hasChatrVoipHistoryForNumber(normalized)

        val layers = listOf(
            CallerScoreLayer(
                name = "room_db",
                score = postCallScore ?: cachedProfile?.trustScore ?: 50,
                signal = when {
                    postCallScore != null -> "post_call_memory"
                    cachedProfile != null -> cachedProfile.source
                    else -> "no_local_profile"
                },
            ),
            CallerScoreLayer(
                name = "contacts",
                score = if (result.verificationStatus == "trusted_contact") 96 else 40,
                signal = result.verificationStatus ?: "not_in_contacts",
            ),
            CallerScoreLayer(
                name = "community",
                score = (100 - (result.spamReports * 12)).coerceIn(0, 100),
                signal = "spam_reports=${result.spamReports}",
            ),
            CallerScoreLayer(
                name = "spam_pattern",
                score = (100 - result.riskScore).coerceIn(0, 100),
                signal = "${result.riskLevel}:${result.scamCategory}:recent=$recent24h:highRisk=$highRisk30d",
            ),
            CallerScoreLayer(
                name = "identity_graph",
                score = when {
                    hasChatrHistory -> 86
                    result.identitySource != "unresolved" -> 72
                    else -> 45
                },
                signal = if (hasChatrHistory) "chatr_history" else result.identitySource,
            ),
        )

        val disposition = when {
            result.shouldBlock -> "block"
            result.shouldChallenge -> "challenge"
            result.decision == "warn" -> "silence"
            else -> "allow"
        }

        return CallerScore(
            result = result,
            layers = layers,
            disposition = disposition,
        )
    }
}
