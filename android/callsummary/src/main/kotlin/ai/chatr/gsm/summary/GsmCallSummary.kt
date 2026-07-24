package ai.chatr.gsm.summary

data class GsmActionItem(
    val text: String,
    val dueAtMillis: Long?,
    val confidence: Float,
)

data class GsmCallSummary(
    val callId: String,
    val summary: String,
    val actionItems: List<GsmActionItem>,
    val generatedAtMillis: Long,
)
