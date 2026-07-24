package com.chatr.app.nativecalls

import android.content.Context
import android.os.Build
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

class NativeCallSyncWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val reason = inputData.getString(KEY_REASON) ?: "worker"
        NativeCallLogSync.syncNow(applicationContext, reason)
        Result.success()
    }

    companion object {
        private const val TAG = "NativeCallSyncWorker"
        private const val UNIQUE_WORK = "chatr_native_call_sync"
        private const val KEY_REASON = "reason"
        private const val PREFS_NAME = "chatr_prefs"
        private const val KEY_LAST_ENQUEUE_PREFIX = "native_call_sync_last_enqueue_"
        private const val STARTUP_SYNC_MIN_INTERVAL_MS = 5L * 60L * 1000L
        private const val CALL_STATE_SYNC_MIN_INTERVAL_MS = 30L * 1000L
        private const val BACKGROUND_SYNC_MIN_INTERVAL_MS = 10L * 60L * 1000L

        fun enqueue(context: Context, reason: String, delaySeconds: Long = 0) {
            try {
                val appContext = context.applicationContext
                if (shouldSkipEnqueue(appContext, reason)) return

                val request = OneTimeWorkRequestBuilder<NativeCallSyncWorker>()
                    .setInputData(workDataOf(KEY_REASON to reason))
                    .setInitialDelay(delaySeconds.coerceAtLeast(0), TimeUnit.SECONDS)
                    .build()

                WorkManager.getInstance(appContext).enqueueUniqueWork(
                    UNIQUE_WORK,
                    ExistingWorkPolicy.KEEP,
                    request,
                )
            } catch (e: Exception) {
                Log.w(TAG, "Failed to enqueue native call sync worker (locked storage?): ${e.message}")
            }
        }

        private fun shouldSkipEnqueue(context: Context, reason: String): Boolean =
            synchronized(NativeCallSyncWorker::class.java) {
                try {
                    val now = System.currentTimeMillis()
                    val bucket = throttleBucket(reason)
                    val intervalMs = throttleIntervalMs(bucket)
                    
                    val isLocked = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && !isUserUnlocked(context)
                    val safeContext = if (isLocked) {
                        context.createDeviceProtectedStorageContext()
                    } else {
                        context
                    }
                    
                    val prefs = safeContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    val key = "$KEY_LAST_ENQUEUE_PREFIX$bucket"
                    val lastEnqueueAt = prefs.getLong(key, 0L)

                    if (now - lastEnqueueAt < intervalMs) {
                        Log.i(TAG, "Skipped native call sync enqueue reason=$reason bucket=$bucket")
                        return@synchronized true
                    }

                    prefs.edit().putLong(key, now).apply()
                    false
                } catch (e: Exception) {
                    Log.w(TAG, "Error checking skip enqueue status (locked storage?): ${e.message}")
                    false
                }
            }

        private fun isUserUnlocked(context: Context): Boolean {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                val userManager = context.getSystemService(android.os.UserManager::class.java)
                return userManager?.isUserUnlocked ?: true
            }
            return true
        }

        private fun throttleBucket(reason: String): String {
            return when (reason) {
                "phone_state_idle",
                "overlay_ringing"
                -> "call_state"
                "boot_completed",
                "network_recovered",
                "background_service"
                -> "background"
                else -> "startup"
            }
        }

        private fun throttleIntervalMs(bucket: String): Long {
            return when (bucket) {
                "call_state" -> CALL_STATE_SYNC_MIN_INTERVAL_MS
                "background" -> BACKGROUND_SYNC_MIN_INTERVAL_MS
                else -> STARTUP_SYNC_MIN_INTERVAL_MS
            }
        }
    }
}
