package com.chatr.app.ondeviceai

sealed class AIResult {
    data class Success(val text: String, val tier: String) : AIResult()
    object GateBlocked : AIResult()
    data class Error(val exception: Exception) : AIResult()
}
