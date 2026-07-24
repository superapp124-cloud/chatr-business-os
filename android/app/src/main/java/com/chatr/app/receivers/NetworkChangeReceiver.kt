package com.chatr.app.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.util.Log
import android.webkit.WebView
import com.chatr.app.nativecalls.NativeCallSyncWorker
import com.chatr.app.services.BackgroundSyncService

/**
 * NETWORK CHANGE RECEIVER
 *
 * Triggers background sync when network becomes available.
 * Also notifies the WebView via a CustomEvent so the JS layer
 * can proactively restart ICE before the 5–15 s natural timeout
 * (eliminating mid-call audio drops on WiFi ↔ LTE transitions).
 */
class NetworkChangeReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "NetworkChangeReceiver"

        /** Weak reference to the main WebView — set by MainActivity after bridge setup. */
        @Volatile
        var webViewRef: WebView? = null
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null) return

        val isConnected = isNetworkAvailable(context)
        val networkType = getNetworkType(context)
        Log.i(TAG, "📶 Network state changed: connected=$isConnected type=$networkType")

        // Notify JS networkMonitor so WebRTC can do a proactive ICE restart
        notifyWebView(networkType, isConnected)

        if (isConnected) {
            val syncIntent = Intent(context, BackgroundSyncService::class.java).apply {
                action = BackgroundSyncService.ACTION_SYNC_MESSAGES
            }
            try {
                context.startForegroundService(syncIntent)
                NativeCallSyncWorker.enqueue(context, "network_recovered")
                Log.i(TAG, "✅ Sync triggered on network recovery")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to trigger sync", e)
            }
        }
    }

    private fun notifyWebView(networkType: String, isConnected: Boolean) {
        val wv = webViewRef ?: return
        try {
            val js = """
                window.dispatchEvent(new CustomEvent('nativeNetworkChanged', {
                    detail: { type: '$networkType', connected: $isConnected, ts: Date.now() }
                }));
            """.trimIndent()
            wv.post { wv.evaluateJavascript(js, null) }
        } catch (e: Exception) {
            Log.d(TAG, "WebView notify skipped: ${e.message}")
        }
    }

    private fun isNetworkAvailable(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val net = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(net) ?: return false
        return caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
               caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
               caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
    }

    private fun getNetworkType(context: Context): String {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val net = cm.activeNetwork ?: return "offline"
        val caps = cm.getNetworkCapabilities(net) ?: return "offline"
        return when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)     -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            else -> "unknown"
        }
    }
}

