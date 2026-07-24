package com.chatr.app.webrtc

import android.content.ComponentName
import android.telecom.PhoneAccountHandle
import android.app.Activity
import android.content.Context
import android.os.Bundle
import android.telecom.TelecomManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.util.Log
import com.chatr.app.services.ChatrConnectionService

class TelecomIsolationTestActivity : Activity(), WebRTCAudioBridge {

    private lateinit var statusText: TextView
    private val callId = "test_call_123"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }
        
        statusText = TextView(this).apply {
            text = "Status: Idle"
            textSize = 18f
        }
        layout.addView(statusText)

        val simulateIncomingBtn = Button(this).apply {
            text = "Simulate Incoming Telecom Call"
            setOnClickListener { simulateIncomingCall() }
        }
        layout.addView(simulateIncomingBtn)

        val answerCallBtn = Button(this).apply {
            text = "Answer Telecom Call"
            setOnClickListener { answerCall() }
        }
        layout.addView(answerCallBtn)
        
        val endCallBtn = Button(this).apply {
            text = "End Telecom Call"
            setOnClickListener { endCall() }
        }
        layout.addView(endCallBtn)

        setContentView(layout)
    }


    private fun simulateIncomingCall() {
        val telecomManager = getSystemService(Context.TELECOM_SERVICE) as TelecomManager
        val componentName = ComponentName(this, ChatrConnectionService::class.java)
        val phoneAccountHandle = PhoneAccountHandle(componentName, "chatr_calling")

        val extras = Bundle().apply {
            putString("call_id", callId)
            putString("caller_name", "Test Caller")
            putString("caller_phone", "+1234567890")
        }
        val bundle = Bundle().apply {
            putParcelable(TelecomManager.EXTRA_INCOMING_CALL_EXTRAS, extras)
        }
        
        try {
            telecomManager.addNewIncomingCall(phoneAccountHandle, bundle)
            statusText.text = "Status: Triggering Incoming Call..."
            Log.i("TelecomTest", "Simulated incoming call requested via TelecomManager")
            
            // Give it a moment to create the connection, then attach the bridge
            statusText.postDelayed({
                val connection = ChatrConnectionService.getConnection(callId)
                if (connection != null) {
                    connection.setAudioBridge(this)
                    Log.i("TelecomTest", "Successfully attached audio bridge to Connection")
                } else {
                    Log.e("TelecomTest", "Failed to find ChatrConnection after addNewIncomingCall")
                    statusText.text = "Status: Error - Connection not created!"
                }
            }, 500)
        } catch (e: SecurityException) {
            Log.e("TelecomTest", "SecurityException triggering call", e)
            statusText.text = "Status: Error - Missing permissions"
        }
    }

    private fun answerCall() {
        ChatrConnectionService.answerConnection(callId)
        statusText.text = "Status: Call Answered"
    }

    private fun endCall() {
        ChatrConnectionService.removeConnection(callId)
        statusText.text = "Status: Call Ended"
    }

    override fun onAudioFocusGranted() {
        runOnUiThread {
            statusText.text = "Status: Audio Focus GRANTED (Unmute WebRTC)"
            Log.i("TelecomTest", "WebRTC Audio Track UNMUTED")
        }
    }

    override fun onAudioFocusLost() {
        runOnUiThread {
            statusText.text = "Status: Audio Focus LOST (Mute WebRTC)"
            Log.i("TelecomTest", "WebRTC Audio Track MUTED")
        }
    }

    override fun setAudioRoute(route: String) {
        runOnUiThread {
            statusText.append("\nRoute Changed: $route")
            Log.i("TelecomTest", "Audio Route updated to: $route")
        }
    }
}
