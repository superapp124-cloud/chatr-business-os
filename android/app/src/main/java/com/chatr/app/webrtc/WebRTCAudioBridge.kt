package com.chatr.app.webrtc

interface WebRTCAudioBridge {
    fun onAudioFocusGranted()
    fun onAudioFocusLost()
    fun setAudioRoute(route: String)
}
