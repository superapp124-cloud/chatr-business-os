package com.chatr.app.sos

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * SosRetryScheduler
 *
 * WorkManager-based retry mechanism for SOS SMS delivery.
 * Used when SosService fails to send SMS (e.g., no signal at the time).
 * Retries with exponential backoff up to 3 attempts.
 */
object SosRetryScheduler {

    private const val TAG = "SosRetryScheduler"
    private const val KEY_NUMBER  = "retry_number"
    private const val KEY_MESSAGE = "retry_message"

    fun schedule(context: Context, number: String, message: String) {
        Log.i(TAG, "⏳ Scheduling SOS retry for $number")
        val data = Data.Builder()
            .putString(KEY_NUMBER, number)
            .putString(KEY_MESSAGE, message)
            .build()

        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.NOT_REQUIRED) // SMS doesn't need data
            .build()

        val request = OneTimeWorkRequestBuilder<SosRetryWorker>()
            .setInputData(data)
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(context).enqueue(request)
    }
}

/**
 * SosRetryWorker — WorkManager worker that re-attempts the SOS SMS send.
 */
class SosRetryWorker(appContext: Context, params: WorkerParameters) : Worker(appContext, params) {

    companion object {
        private const val TAG = "SosRetryWorker"
    }

    override fun doWork(): Result {
        val number  = inputData.getString("retry_number") ?: return Result.failure()
        val message = inputData.getString("retry_message") ?: return Result.failure()

        return try {
            val smsParts = android.telephony.SmsManager.getDefault().divideMessage(message)
            android.telephony.SmsManager.getDefault()
                .sendMultipartTextMessage(number, null, smsParts, null, null)
            Log.i(TAG, "✅ SOS retry SMS sent to $number")
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "❌ SOS retry failed for $number — runAttemptCount=$runAttemptCount", e)
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }
}
