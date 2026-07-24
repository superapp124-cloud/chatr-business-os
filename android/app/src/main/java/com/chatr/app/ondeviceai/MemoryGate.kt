package com.chatr.app.ondeviceai

import android.app.ActivityManager
import android.content.Context
import android.util.Log

object MemoryGate {
    // Cache the failure result for the entire session to prevent repeated heavy allocation attempts
    @Volatile
    var isTier2UnavailableThisSession: Boolean = false
        private set

    // Minimum required memory immediately prior to Gemma allocation (~1.5GB)
    private const val REQUIRED_AVAIL_MEM_BYTES = 1500L * 1024 * 1024

    fun isRamSufficient(context: Context): Boolean {
        if (isTier2UnavailableThisSession) return false

        val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memoryInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memoryInfo)

        val sufficient = memoryInfo.availMem >= REQUIRED_AVAIL_MEM_BYTES
        
        if (!sufficient) {
            Log.w("MemoryGate", "Insufficient memory for Tier 2 AI. Available: ${memoryInfo.availMem / (1024 * 1024)}MB. Marking unavailable for session.")
            isTier2UnavailableThisSession = true
        }
        
        return sufficient
    }
}
