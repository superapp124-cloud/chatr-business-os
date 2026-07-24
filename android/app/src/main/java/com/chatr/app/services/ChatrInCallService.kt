package com.chatr.app.services

import android.telecom.Call
import android.telecom.InCallService
import android.util.Log
import org.json.JSONObject

/**
 * ChatrInCallService — GSM InCall Hook (Tier 2)
 *
 * Android requires an InCallService to receive real-time GSM call events:
 * onCallAdded, onCallRemoved, call state changes, audio mode changes.
 *
 * This service acts as the GSM bridge:
 *   - Forwards call events to the AI overlay (InCallOverlayService)
 *   - Writes call metadata to SharedPreferences for the web layer
 *   - Does NOT touch VoIP/WebRTC stack — GSM only
 *
 * Manifest declaration (added below):
 *   <service android:name=".services.ChatrInCallService"
 *       android:permission="android.permission.BIND_INCALL_SERVICE"
 *       android:exported="true">
 *     <meta-data android:name="android.telecom.IN_CALL_SERVICE_UI" android:value="false"/>
 *     <intent-filter>
 *       <action android:name="android.telecom.InCallService"/>
 *     </intent-filter>
 *   </service>
 *
 * NOTE: android:value="false" means we do NOT replace the system dialer UI.
 * We are a background listener only.
 */
class ChatrInCallService : InCallService() {

    companion object {
        private const val TAG = "ChatrInCallService"
        private const val PREFS = "chatr_gsm_call"

        // State keys readable by the web layer via SharedPreferences
        const val KEY_ACTIVE_CALL_ID = "active_gsm_call_id"
        const val KEY_CALL_STATE     = "gsm_call_state"
        const val KEY_CALLER_NUMBER  = "gsm_caller_number"
        const val KEY_CALL_COUNT     = "gsm_call_count"
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        val number = getNumber(call)
        val state  = stateLabel(call.state)
        Log.i(TAG, "📞 GSM call added: number=$number state=$state")

        writeCallState(call, number, state)
        notifyOverlay("gsm_call_added", number, state)
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        val number = getNumber(call)
        Log.i(TAG, "📞 GSM call removed: number=$number")

        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
            .remove(KEY_ACTIVE_CALL_ID)
            .putString(KEY_CALL_STATE, "DISCONNECTED")
            .apply()

        notifyOverlay("gsm_call_removed", number, "DISCONNECTED")
    }

    override fun onCallAudioStateChanged(audioState: android.telecom.CallAudioState?) {
        super.onCallAudioStateChanged(audioState)
        audioState ?: return
        Log.d(TAG, "🔊 Audio route=${audioState.route} muted=${audioState.isMuted}")
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
            .putBoolean("gsm_muted", audioState.isMuted)
            .putInt("gsm_audio_route", audioState.route)
            .apply()
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private fun getNumber(call: Call): String {
        return try {
            call.details?.handle?.schemeSpecificPart ?: "unknown"
        } catch (e: Exception) { "unknown" }
    }

    private fun stateLabel(state: Int): String = when (state) {
        Call.STATE_RINGING       -> "RINGING"
        Call.STATE_ACTIVE        -> "ACTIVE"
        Call.STATE_HOLDING       -> "HOLDING"
        Call.STATE_DIALING       -> "DIALING"
        Call.STATE_DISCONNECTED  -> "DISCONNECTED"
        Call.STATE_CONNECTING    -> "CONNECTING"
        Call.STATE_NEW           -> "NEW"
        else                     -> "UNKNOWN($state)"
    }

    private fun writeCallState(call: Call, number: String, state: String) {
        val id = System.identityHashCode(call).toString()
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
            .putString(KEY_ACTIVE_CALL_ID, id)
            .putString(KEY_CALL_STATE, state)
            .putString(KEY_CALLER_NUMBER, number)
            .putLong("gsm_call_ts", System.currentTimeMillis())
            .apply()
    }

    private fun notifyOverlay(event: String, number: String, state: String) {
        // Fire a local broadcast — InCallOverlayService and web layer listen for this
        val intent = android.content.Intent("com.chatr.app.GSM_CALL_EVENT").apply {
            setPackage(packageName)
            putExtra("event", event)
            putExtra("number", number)
            putExtra("state", state)
        }
        sendBroadcast(intent)
    }
}
