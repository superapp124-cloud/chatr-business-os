package com.chatr.app.nativecalls

import android.content.Context
import android.util.Log
import org.json.JSONObject
object NativeVoipCallLog {
    private const val TAG = "NativeVoipCallLog"

    fun record(
        context: Context,
        callId: String,
        phoneNumber: String?,
        displayName: String?,
        direction: String,
        status: String,
        startedAt: Long,
        endedAt: Long? = null,
        durationSeconds: Long = 0,
        callType: String = "audio",
    ) {
        if (callId.isBlank()) return

        val appContext = context.applicationContext
        Thread {
            val rawNumber = phoneNumber.orEmpty()
            val normalized = NativePhoneNormalizer.normalize(rawNumber)
            val storedNumber = normalized.ifBlank { rawNumber.ifBlank { displayName.orEmpty() } }
            val hashed = NativePhoneNormalizer.hash(storedNumber)
            val contact = NativeContactResolver.lookup(appContext, storedNumber)
            val name = displayName?.takeIf { it.isNotBlank() }
                ?: contact?.displayName
                ?: storedNumber.takeIf { it.isNotBlank() }

            val event = NativeCallEvent(
                deviceEventId = "chatr_voip:$callId",
                callLogId = null,
                phoneNumber = storedNumber,
                normalizedNumber = normalized.ifBlank { storedNumber },
                hashedNumber = hashed,
                contactName = contact?.displayName,
                callerName = name,
                direction = if (direction.equals("outgoing", ignoreCase = true)) "outgoing" else "incoming",
                status = status,
                startedAt = startedAt,
                endedAt = endedAt,
                durationSeconds = durationSeconds.coerceAtLeast(0),
                trustScore = 100,
                spamReports = 0,
                riskLevel = "safe",
                source = "chatr_voip",
                rawPayload = JSONObject().apply {
                    put("call_id", callId)
                    put("call_type", callType)
                    put("voip", true)
                }.toString(),
            )

            try {
                val repo = NativeCallRepository.getInstance(appContext)
                repo.upsertEvent(event)
                SupabaseNativeCallClient(appContext).syncEvent(event)
            } catch (error: Exception) {
                Log.w(TAG, "Could not persist Chatr VoIP call log for $callId", error)
            }

            Log.i(TAG, "Persisted Chatr VoIP call log locally for $callId; system CallLog write is handled by AffinityUpdateWorker")
        }.start()
    }
}
