package com.chatr.app.ondeviceai

object StabilityGateConfig {
    // Hard boundary: set to true ONLY when calling stability conditions (JWT Auth, Telecom conflicts, OEM Push) are verified in production.
    @Volatile
    var isCallingStable: Boolean = false
}
