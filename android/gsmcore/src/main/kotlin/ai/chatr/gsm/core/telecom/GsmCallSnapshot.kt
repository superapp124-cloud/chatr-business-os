package ai.chatr.gsm.core.telecom

enum class GsmCallDirection {
    INCOMING,
    OUTGOING,
    UNKNOWN,
}

enum class GsmCallLifecycle {
    RINGING,
    DIALING,
    ACTIVE,
    HOLDING,
    DISCONNECTING,
    DISCONNECTED,
    UNKNOWN,
}

data class GsmCallSnapshot(
    val telecomCallHash: Int,
    val phoneNumber: String?,
    val direction: GsmCallDirection,
    val lifecycle: GsmCallLifecycle,
    val phoneAccountId: String?,
    val simSlotIndex: Int?,
    val capturedAtMillis: Long,
)
