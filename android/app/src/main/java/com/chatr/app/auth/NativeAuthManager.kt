package com.chatr.app.auth

import android.content.Context
import android.os.Looper
import android.util.Log
import com.chatr.app.R
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext

object NativeAuthManager {
    private const val TAG = "NativeAuthManager"
    private const val TIMEOUT_MS = 3500
    private const val PREFS_NAME = "chatr_prefs"
    private const val KEY_AUTH_TOKEN = "auth_token"
    private const val KEY_REFRESH_TOKEN = "refresh_token"

    private val refreshLock = Any()

    /**
     * Suspending version to safely call from coroutines.
     * Prevents NetworkOnMainThreadException.
     */
    suspend fun getValidTokenAsync(context: Context): String? = withContext(Dispatchers.IO) {
        getValidTokenInternal(context, enforceWorkerThread = false)
    }

    /**
     * Blocking version for existing background threads (e.g., Thread{} or Workers).
     * Asserts that it's NOT on the main thread to catch accidental UI freezes early.
     */
    fun getValidTokenBlocking(context: Context): String? {
        return getValidTokenInternal(context, enforceWorkerThread = true)
    }

    @Deprecated("Use getValidTokenAsync or getValidTokenBlocking instead.")
    fun getValidToken(context: Context): String? {
        return getValidTokenInternal(context, enforceWorkerThread = false)
    }

    private fun getValidTokenInternal(context: Context, enforceWorkerThread: Boolean): String? {
        if (enforceWorkerThread) {
            check(Looper.myLooper() != Looper.getMainLooper()) {
                "getValidTokenBlocking must not be called on the main thread!"
            }
        }

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        
        // Fast path: Unsynchronized read
        var token = prefs.getString(KEY_AUTH_TOKEN, null)
        if (token.isNullOrBlank()) return null
        
        if (!isTokenExpired(token)) {
            return token
        }

        // Slow path: Synchronized refresh
        synchronized(refreshLock) {
            // Double-check: Another thread might have refreshed it while we were waiting on the lock
            token = prefs.getString(KEY_AUTH_TOKEN, null)
            if (token.isNullOrBlank()) return null
            if (!isTokenExpired(token)) {
                Log.d(TAG, "Token was refreshed by another thread, using new token.")
                return token
            }

            Log.d(TAG, "Token is expired, attempting to refresh...")
            if (refreshAccessTokenLocked(context)) {
                return prefs.getString(KEY_AUTH_TOKEN, null)
            } else {
                Log.e(TAG, "Failed to refresh token")
                return null
            }
        }
    }

    private fun isTokenExpired(token: String): Boolean {
        try {
            val parts = token.split(".")
            if (parts.size != 3) return true
            
            val payload = String(Base64.decode(parts[1], Base64.URL_SAFE), Charsets.UTF_8)
            val json = JSONObject(payload)
            val exp = json.optLong("exp", 0)
            
            // Add 1 minute buffer
            val currentTime = System.currentTimeMillis() / 1000
            return exp < (currentTime + 60)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking token expiration", e)
            return true
        }
    }

    /**
     * Assumes caller holds refreshLock.
     */
    private fun refreshAccessTokenLocked(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val refreshToken = prefs.getString(KEY_REFRESH_TOKEN, null)?.takeIf { it.isNotBlank() } ?: return false

        val url = try {
            context.getString(R.string.supabase_url).takeIf { it.isNotBlank() && !it.startsWith("YOUR_") }
        } catch (e: Exception) { null } ?: return false

        val key = try {
            context.getString(R.string.supabase_anon_key).takeIf { it.isNotBlank() && !it.startsWith("YOUR_") }
        } catch (e: Exception) { null } ?: return false

        try {
            val endpoint = "$url/auth/v1/token?grant_type=refresh_token"
            val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = TIMEOUT_MS
                readTimeout = TIMEOUT_MS
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("apikey", key)
            }
            
            val body = JSONObject().apply {
                put("refresh_token", refreshToken)
            }

            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            if (conn.responseCode in 200..299) {
                val response = BufferedReader(InputStreamReader(conn.inputStream)).readText()
                val json = JSONObject(response)
                val newAccessToken = json.optString("access_token")
                val newRefreshToken = json.optString("refresh_token")
                if (newAccessToken.isNotBlank()) {
                    val editor = prefs.edit()
                    editor.putString(KEY_AUTH_TOKEN, newAccessToken)
                    if (newRefreshToken.isNotBlank()) {
                        editor.putString(KEY_REFRESH_TOKEN, newRefreshToken)
                    }
                    editor.apply()
                    Log.i(TAG, "Successfully refreshed Supabase JWT in native client")
                    // Broadcast refreshed token to all native services
                    NativeTokenEventBus.tryEmit(TokenEvent.Refreshed(newAccessToken))
                    return true
                }
            } else {
                Log.w(TAG, "Failed to refresh Supabase JWT in native client: ${conn.responseCode}")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error refreshing Supabase JWT: ${e.message}")
        }
        // Broadcast failure so services can handle re-auth
        NativeTokenEventBus.tryEmit(TokenEvent.Failed)
        return false
    }
}
